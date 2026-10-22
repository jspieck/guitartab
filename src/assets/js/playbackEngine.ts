import { selectionState } from '../../stores/selectionState';
import workerFunction from './audioIntervalWorker';
import Settings, { EPSILON } from '../../stores/settingsState';
import Song, { Note, Beat, Interval } from './songData';
import { audioEngine } from './audioEngine';
import liveInput from '../../services/midi/liveInput';
import Duration from '../../utils/duration';
import * as playbackController from '../../services/editor/playbackController';
import * as navigationController from '../../services/editor/navigationController';
import {
  publishPlaybackPosition,
  publishPlaybackUiStarted,
  publishPlaybackUiStopped,
} from '../../services/editor/playbackEngineBridge';
import { tab } from './tab';
import { typedEventBus } from '../../utils/typedEventBus';
import { clearPlaybackNotes, showPlaybackBeat } from '../../stores/soundingNotesState';
import { currentLoopInterval } from '../../services/editor/rangeSelection';
import { setSequencerIndicator } from '../../stores/sequencerState';
import {
  didCrossLoopBoundary,
  getEffectiveBlockLengthForLoop,
  resolveNextBlockAfterCurrent,
  shouldTruncateNoteAtLoopEnd,
} from '../../services/playbackLoopController';
import {
  computeCountIn,
  getBarBeatPositions,
  nextTrainerRate,
  secondsPerWhole,
  wholesPerSecond,
} from '../../services/practiceTiming';
import { getPlaybackRate, practiceState, setPlaybackRate } from '../../stores/practiceState';

/** Seconds per whole note at the effective (speed-adjusted) tempo. */
function spw(bpm: number): number {
  return secondsPerWhole(bpm, getPlaybackRate());
}

/** Whole notes per second at the effective (speed-adjusted) tempo. */
function wps(bpm: number): number {
  return wholesPerSecond(bpm, getPlaybackRate());
}

/** Lead time before the first count-in click / first note, so nothing is scheduled in the past. */
const START_LEAD_SECONDS = 0.05;

/** Fret of the next beat's note on `string` (for slides), or null when there is none. */
function nextFretOnString(
  trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
): number | null {
  const lastBeat = Song.measures[trackId][blockId][voiceId].length - 1;
  let next = { trackId, blockId, voiceId, beatId: beatId + 1 };
  if (beatId >= lastBeat) {
    if (blockId + 1 >= Song.measures[trackId].length) return null;
    next = { trackId, blockId: blockId + 1, voiceId, beatId: 0 };
  }
  return Song.findBeat(next)?.notes?.[string]?.fret ?? null;
}

class PlayBackLogic {
  lookahead: number;

  nextNoteTime: ({time: number, blockId: number, beatId: number, sequenceIndex: number} | null)[][];

  playEpoch: number;

  playJumpBackPosition: number;

  playingIteration: number;

  currentBlockId: number;

  notesInQueue: {
    notes: (Note | null)[],
    time: number,
    block: number,
    voiceId: number,
    beat: number,
    nextBlock: number,
    nextBeat: number,
    nextTime: number,
  }[];

  globalIncreasingTime: number;

  playPosition: { block: number, positionInBlock: number };

  timerWorker: Worker;

  lastMeasuredTime: number;

  alwaysIncreasingBlockNumber: number;

  absoluteTimeToSynchronize: number;

  scheduleAhead: number;

  playingBlockSequence: { playingIteration: number, blockId: number }[];

  playingSequenceCounter: number;

  BUFFER_SIZE: number;

  loopPreScheduled: number[][];

  nextMidiNoteFetching: number;

  /** Last metronome click scheduled, as `sequenceIndex * 64 + beat`. */
  lastClickKey: number;

  /** Audio time at which playback (after an optional count-in) begins. */
  playStartAudioTime: number;

  noteFetchingQuantization: number;

  lastBlockPP: number;

  currentBlockPP: number;

  currentBeatPP: number;

  startTimesOfBlocks: number[];

  playBackMoveQueue: {type: string, params: number[]}[];

  wasTrackChanged: boolean;

  lastRow: number;

  trackChange: boolean;

  jumpBackPositions: number[];

  constructor() {
    this.lookahead = 25.0; // How frequently to call scheduling function (in milliseconds)
    this.nextNoteTime = []; // when the next note is due.

    this.playEpoch = 0;
    this.playJumpBackPosition = 0;
    this.playingIteration = 1;
    this.currentBlockId = 0;

    this.notesInQueue = [];

    this.globalIncreasingTime = 0;

    this.playPosition = {
      block: 0,
      positionInBlock: 0,
    };

    this.timerWorker = new Worker(URL.createObjectURL(
      new Blob(
        [`(${workerFunction.toString()})()`],
        { type: 'text/javascript' },
      ),
    ));

    this.lastMeasuredTime = 0;
    // number of blocks that was played
    this.alwaysIncreasingBlockNumber = 0;
    // 0.25 means that 1/4 of the time in the block has passed
    this.absoluteTimeToSynchronize = 0;
    this.scheduleAhead = 0.4; // seconds of audio scheduled ahead of the clock

    // TODO nextNote is scheduled at beginning of old loopInterval
    this.playingBlockSequence = [];
    this.playingSequenceCounter = 0;
    this.BUFFER_SIZE = 15;

    this.loopPreScheduled = [];
    this.nextMidiNoteFetching = 0;
    this.lastClickKey = -1;
    this.playStartAudioTime = 0;
    this.noteFetchingQuantization = 1 / 32;

    this.lastBlockPP = 0;
    this.currentBlockPP = 0;
    this.currentBeatPP = 0;

    this.startTimesOfBlocks = [];

    this.playBackMoveQueue = [];

    this.wasTrackChanged = false;
    this.lastRow = -1;
    this.trackChange = false;

    this.jumpBackPositions = [];
  }

  // TODO this is not the current block, but the block of the scheduled next note
  getCurrentBlock(): number {
    if (Settings.songPlaying) {
      return this.getBlockFromSequence(this.alwaysIncreasingBlockNumber);
    }
    return selectionState.cursor.blockId;
  }

  /** Where `beatIdTo` starts inside its bar, in duration units. */
  static positionOfBeat(trackId: number, blockId: number, voiceId: number, beatIdTo: number): number {
    let dur = 0;
    for (let beatId = 0; beatId < beatIdTo; beatId += 1) {
      dur += Duration.getDurationOfNote(
        Song.getBeat({ trackId, blockId, voiceId, beatId }),
        false,
      );
    }
    return dur;
  }

  setPlayPosition(
    trackId: number, blockId: number, voiceId: number, beatIdTo: number,
  ) {
    this.playPosition.block = blockId;
    const dur = PlayBackLogic.positionOfBeat(trackId, blockId, voiceId, beatIdTo);
    this.playPosition.positionInBlock = dur;
    publishPlaybackPosition(blockId, beatIdTo, dur);
  }

  /** Moves running playback to a beat (a click in the tab); when stopped, only sets the start. */
  jumpToBeat(trackId: number, blockId: number, voiceId: number, beatId: number) {
    if (!Settings.songPlaying) {
      this.setPlayPosition(trackId, blockId, voiceId, beatId);
      return;
    }
    this.jumpToPosition(blockId, PlayBackLogic.positionOfBeat(trackId, blockId, voiceId, beatId), beatId);
  }

  /**
   * Builds the sample buffers for the first bars from the play position (called when the
   * pointer reaches Play), so the first scheduled notes don't each convert a sample.
   */
  preloadStart(numBlocks = 2) {
    if (Settings.songPlaying) return;
    const firstBlock = this.playPosition.block;
    for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
      const blocks = Song.measures[trackId];
      const lastBlock = Math.min(firstBlock + numBlocks, blocks.length);
      for (let blockId = firstBlock; blockId < lastBlock; blockId += 1) {
        for (const voice of blocks[blockId]) {
          for (const beat of voice) {
            beat.notes.forEach((note, string) => {
              if (note != null && note.fret >= 0) audioEngine.preloadSF2(trackId, string, note.fret);
            });
          }
        }
      }
    }
  }

  resetPlayBack() {
    this.playingIteration = 1;
    this.playPosition.block = 0;
    this.playPosition.positionInBlock = 0;
  }

  initTimerWorker() {
    this.timerWorker.onmessage = (e) => {
      if (e.data === 'tick') {
        this.scheduler();
      } else {
        console.log(`message: ${e.data}`);
      }
    };
    this.timerWorker.postMessage({ interval: this.lookahead });
  }

  stopSong() {
    Settings.songPlaying = false;
    this.timerWorker.postMessage('stop');
    // Stop all audio playback immediately
    audioEngine.stopAllSources();
    playbackController.hidePlayBackBars();
    clearPlaybackNotes();
    this.setPlayPosition(Song.currentTrackId, 0, Song.currentVoiceId, 0);
    publishPlaybackUiStopped();
  }

  moveOneForward() {
    console.log(`FORWARD ${this.currentBlockPP} ${this.alwaysIncreasingBlockNumber}`);
    if (this.currentBlockPP + 1 < Song.measures[Song.currentTrackId].length) {
      this.jumpToPosition(this.currentBlockPP + 1, 0, 0);
    }
  }

  moveOneBackward() {
    if (this.currentBlockPP - 1 >= 0) {
      this.jumpToPosition(this.currentBlockPP - 1, 0, 0);
    }
  }

  jumpToPosition(blockId: number, posInBlock: number, beatId: number) {
    this.notesInQueue.length = 0;
    this.globalIncreasingTime = 0;
    this.alwaysIncreasingBlockNumber += 1;
    this.currentBlockId = blockId;
    this.addToPlayingSequence(this.alwaysIncreasingBlockNumber, {
      blockId,
      playingIteration: 1,
    });
    if (Settings.songPlaying) {
      this.precomputeNextBlocks(this.alwaysIncreasingBlockNumber, 10);
      for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
        for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
          this.nextNoteTime[trackId][voiceId] = {
            time: 0,
            blockId,
            beatId: 0,
            sequenceIndex: this.alwaysIncreasingBlockNumber,
          }; // TODO
        }
      }
      this.absoluteTimeToSynchronize = 0;
      this.playBackMoveQueue.length = 0;
      const beatToMoveTo = posInBlock == null ? 0 : beatId;
      this.playBackMoveQueue.push({
        type: 'ToBeat',
        params: [Song.currentTrackId, blockId, Song.currentVoiceId, beatToMoveTo, 0],
      });
      if (posInBlock != null) {
        this.setStartInformationPerVoice(blockId, posInBlock);
      }
    }
    playbackController.setJumped();
    audioEngine.stopAllSources();
    publishPlaybackPosition(blockId, beatId, posInBlock ?? this.playPosition.positionInBlock);
  }

  static returnNextMeasure(trackId: number, blockId: number, voiceId: number, beatId: number) {
    const mT = Song.measures[trackId][blockId][voiceId];
    if (mT.length <= beatId + 1) {
      if (Song.measures[trackId].length <= blockId + 1) {
        return null;
      }
      return [trackId, blockId + 1, 0];
    }
    return [trackId, blockId, beatId + 1];
  }

  // chord is of form [1,,2,,4], that are the notes that are pressed in
  // TODO: consider tuning
  static playChord(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    chordDuration: number, chordStart: number, beat: Beat,
  ) {
    const chord = Song.getBeat({ trackId, blockId, voiceId, beatId }).notes;
    let isOtherSolo = false;
    for (let i = 0; i < Song.playBackInstrument.length; i += 1) {
      isOtherSolo = isOtherSolo || Song.playBackInstrument[i].solo;
    }
    if (Song.playBackInstrument[trackId].mute
      || (isOtherSolo && !Song.playBackInstrument[trackId].solo)) return;

    // TODO multiple ties, but samples not long enough
    const nM = PlayBackLogic.returnNextMeasure(trackId, blockId, voiceId, beatId);
    let nextM;
    let nextNoteDuration = 0;
    if (nM != null) {
      nextM = Song.measures[nM[0]][nM[1]][voiceId][nM[2]];
      const duration = Duration.getDurationOfNote(nextM, false);
      nextNoteDuration += (duration / 64) * spw(Song.bpm);
    }
    // Only play when hearable
    if (Song.playBackInstrument[trackId].volume < 5) {
      return;
    }
    let volume = 1.0;
    // Play normal notes
    const { numStrings } = Song.tracks[trackId];
    for (let string = 0; string < numStrings; string += 1) {
      if (chord[string] != null && !chord[string]!.tied) {
        let duration = chordDuration;
        if (nM != null && nextM != null
          && nextM.notes[string] != null
          && nextM.notes[string]!.tied) {
          duration += nextNoteDuration;
        }
        if (chord[string]!.ghost) {
          volume = 0.5;
        }
        PlayBackLogic.playNote(trackId, blockId, voiceId, beatId, string, beat, chord[string]!,
          chordStart, duration, volume);
      }
    }
    // PLay GPX Notes not on guitar
    if (beat.otherNotes != null) {
      for (const note of beat.otherNotes) {
        if (note.ghost) {
          volume = 0.5;
        }
        audioEngine.playNoteInstrument(trackId, voiceId, note.height, volume,
          Song.playBackInstrument[trackId].instrument, chordStart, chordDuration, beat, note, null);
      }
    }
  }

  static playNote(trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, beat: Beat, note: Note, noteStartIn: number, durationIn: number,
    volume: number) {
    let noteStart = noteStartIn;
    let duration = durationIn;
    const beatEffects = beat.effects;
    if (string !== -1 && beatEffects?.stroke != null) {
      const { numStrings } = Song.tracks[trackId];
      const { strokeLength, strokeType } = beatEffects.stroke;
      // strokeLength is 128 for 1/128 and 8 for eighth
      const laterStart = 1 / strokeLength / (2 * 6); // divided through the number of frets
      const secFactor = 1;// 0.8;
      // Strings are stored lowest first: a down strum reaches string 0 first, an up strum last.
      const order = strokeType === 'down' ? string : numStrings - 1 - string;
      noteStart += (laterStart * spw(Song.bpm)) * order * secFactor;
      duration -= (laterStart * spw(Song.bpm)) * order * secFactor;
    }

    const nextFret = nextFretOnString(trackId, blockId, voiceId, beatId, string);
    const instr = Song.playBackInstrument[trackId].instrument;
    const { fret } = note;
    if (instr === 'guitar' || instr === 'eguitar' || instr === 'disteguitar'
      || instr === 'nylonGuitar' || instr === 'bass' || instr === 'overdriveguitar') {
      if (note.graceObj != null) {
        const timeBefore = (Duration.getDurationOfType(note.graceObj!.duration) / 64)
          * spw(Song.bpm);
        audioEngine.playSF2(trackId, voiceId, string, note.graceObj!.fret, volume,
          noteStart, timeBefore, beat, null, instr, nextFret);
        audioEngine.playSF2(trackId, voiceId, string, fret, volume,
          noteStart + timeBefore, duration, beat, null, instr, nextFret);
      } else {
        audioEngine.playSF2(trackId, voiceId, string, fret, volume, noteStart,
          duration, beat, note, instr, nextFret);
      }
    } else if (instr === 'drums') {
      audioEngine.playSF2(trackId, voiceId, 0, fret, volume, noteStart,
        duration, beat, null, instr, nextFret);
    } else if (note.graceObj != null) {
      const timeBefore = (Duration.getDurationOfType(note.graceObj!.duration) / 64)
        * spw(Song.bpm);
      audioEngine.playSF2(trackId, voiceId, string, note.graceObj!.fret, volume,
        noteStart, duration, beat, note, instr, nextFret);
      audioEngine.playSF2(trackId, voiceId, string, fret, volume, noteStart + timeBefore,
        duration, beat, note, instr, nextFret);
    } else {
      audioEngine.playSF2(trackId, voiceId, string, fret, volume, noteStart,
        duration, beat, note, instr, nextFret);
    }
  }

  /**
   * Schedule metronome clicks for the current and next bar that fall inside the
   * look-ahead window: one click per beat of the bar's meter, accented on beat 1.
   * Bars are followed through the playing sequence, so repeats, loops, meter
   * and tempo changes stay aligned.
   */
  /**
   * How far ahead of the song clock to schedule, in whole notes. `scheduleAhead` is in
   * seconds; the song clock counts whole notes, so convert at the current effective tempo.
   * (Comparing seconds with whole notes directly queued up to 3 s at slow practice speeds,
   * so speed changes and trainer steps arrived late.)
   */
  scheduleHorizon(): number {
    return this.globalIncreasingTime + this.scheduleAhead * wps(Song.bpm);
  }

  scheduleMetronomeClicks(currentTime: number) {
    const loopInterval = currentLoopInterval();
    const horizon = this.scheduleHorizon();
    let barStart = this.globalIncreasingTime - this.absoluteTimeToSynchronize;

    for (let offset = 0; offset < 2 && barStart < horizon; offset += 1) {
      const sequenceIndex = this.alwaysIncreasingBlockNumber + offset;
      const blockId = this.getBlockFromSequence(sequenceIndex);
      const meta = Song.measureMeta[blockId];
      if (meta == null) {
        return;
      }
      const length = getEffectiveBlockLengthForLoop(blockId, loopInterval, meta.numerator / meta.denominator);
      // After a loop jump the bar clock restarts at the loop start, not at the bar start.
      const restartsLoop = loopInterval != null && sequenceIndex > 0 && blockId === loopInterval.startBlock
        && this.getBlockFromSequence(sequenceIndex - 1) === loopInterval.endBlock;
      const skipped = restartsLoop ? loopInterval!.startRatio : 0;
      const bpm = offset === 0 || meta.bpm == null ? Song.bpm : meta.bpm;

      const beats = getBarBeatPositions(meta.numerator, meta.denominator, length);
      for (let beat = 0; beat < beats.length; beat += 1) {
        const key = sequenceIndex * 64 + beat;
        if (key <= this.lastClickKey || beats[beat] < skipped - EPSILON) {
          continue;
        }
        const tickTime = barStart + beats[beat] - skipped;
        if (tickTime >= horizon) {
          return;
        }
        this.lastClickKey = key;
        if (tickTime >= this.globalIncreasingTime - EPSILON) {
          const when = currentTime + (tickTime - this.globalIncreasingTime) * spw(bpm);
          audioEngine.playMetronomeNote(when, beat === 0);
        }
      }
      barStart += length - skipped;
    }
  }

  getCurrentTime(): {blockId: number, positionInBlock: number} {
    return {
      blockId: this.currentBlockId,
      positionInBlock: this.absoluteTimeToSynchronize,
    };
  }

  // FIND nextNote for loop interval
  // relativeTimeBegin = in 64ths: start of loop interval,
  // timeFrameAfterBegin = in 64ths; how much this.scheduleAhead is available in this block;
  // timeAtLoopBegin = currentTime + distance to loop end

  static beatIdToRatio(trackId: number, blockId: number, voiceId: number, endBeatId: number) {
    let accumulateTime = 0;
    for (let beatId = 0; beatId < endBeatId; beatId += 1) {
      accumulateTime += Duration.getDurationOfNote(
        Song.getBeat({ trackId, blockId, voiceId, beatId }), true,
      );
    }
    return accumulateTime / 64;
  }

  /* Find next beat to play, when end of looping-interval is reached */
  findNextBeat(
    trackId: number, voiceId: number, startBlock: number, startRatio: number,
    endBlock: number, endRatio: number, sequenceIndex: number,
  ) {
    // check for next note between start and end
    let accumulateTime = 0;
    const n = Song.measures[trackId][startBlock][voiceId].length;
    for (let beatId = 0; beatId < n; beatId += 1) {
      if (accumulateTime / 64 >= startRatio - EPSILON) {
        if (startBlock === endBlock && accumulateTime / 64 >= endRatio - EPSILON) {
          return null;
        }
        return {
          beatId,
          blockId: startBlock,
          sequenceIndex,
          distanceToNextNote: accumulateTime / 64 - startRatio,
        };
      }
      const ms = Song.getBeat({ trackId, blockId: startBlock, voiceId, beatId });
      accumulateTime += Duration.getDurationOfNote(ms, true);
    }
    if (endBlock !== startBlock) {
      console.log('STRONG CASE');
      const lengthOfBlock = Song.measureMeta[startBlock].numerator
        / Song.measureMeta[startBlock].denominator;
      return {
        beatId: 0,
        blockId: this.getBlockFromSequence(sequenceIndex + 1),
        sequenceIndex: sequenceIndex + 1,
        distanceToNextNote: lengthOfBlock - startRatio,
      };
    }
    return null;
  }

  /* Find next beat given a start block + ratio and loopingInterval */
  findNextBeatGeneral(
    trackId: number, voiceId: number, startBlock: number, startRatio: number,
    loopingInterval: Interval | null,
    sequenceIndex: number,
  ) {
    // First case: there is a beat after startRatio in current block
    let accumulateTime = 0;
    const n = Song.measures[trackId][startBlock][voiceId].length;
    for (let beatId = 0; beatId < n; beatId += 1) {
      if (accumulateTime / 64 >= startRatio - EPSILON) {
        if (loopingInterval != null && loopingInterval.endBlock === startBlock
          && accumulateTime / 64 >= loopingInterval.endRatio - EPSILON) {
          break;
        } else {
          return {
            beatId,
            blockId: startBlock,
            sequenceIndex,
            time: this.globalIncreasingTime + accumulateTime / 64 - startRatio,
          };
        }
      }
      const ms = Song.getBeat({ trackId, blockId: startBlock, voiceId, beatId });
      accumulateTime += Duration.getDurationOfNote(ms, true);
    }
    // Second case: there is no note in the given looping area -> return null
    if (loopingInterval != null && loopingInterval.startBlock === loopingInterval.endBlock) {
      let noteFound = false;
      const n2 = Song.measures[trackId][startBlock][voiceId].length;
      for (let beatId = 0; beatId < n2; beatId += 1) {
        if (accumulateTime / 64 >= loopingInterval.startRatio - EPSILON
          && accumulateTime / 64 < loopingInterval.endRatio - EPSILON) {
          noteFound = true;
          break;
        }
        const ms = Song.getBeat({ trackId, blockId: startBlock, voiceId, beatId });
        accumulateTime += Duration.getDurationOfNote(ms, true);
      }
      if (!noteFound) {
        return null;
      }
    }
    // Third case: note is at the start of the next block
    console.log('THIRD CASE');
    const lengthOfBlock = Song.measureMeta[startBlock].numerator
      / Song.measureMeta[startBlock].denominator;
    return {
      beatId: 0,
      blockId: this.getBlockFromSequence(sequenceIndex + 1),
      sequenceIndex: sequenceIndex + 1,
      time: this.globalIncreasingTime + lengthOfBlock - startRatio,
    };
  }

  nextNote(trackId: number, blockId: number, voiceId: number, currentTime: number) {
    const nextNoteObj = this.nextNoteTime[trackId][voiceId];
    if (nextNoteObj == null) {
      return false;
    }
    let distanceToNextNoteInCurrentBlock = Math.max(0, nextNoteObj.time
      - this.globalIncreasingTime);
    let distanceToNextNoteInNextBlock = 0;

    const { beatId } = nextNoteObj;
    const currentBlock = this.getBlockFromSequence(this.alwaysIncreasingBlockNumber);

    let lengthOfBlock = Song.measureMeta[currentBlock].numerator
      / Song.measureMeta[currentBlock].denominator;
    const loopInterval = currentLoopInterval();
    lengthOfBlock = getEffectiveBlockLengthForLoop(currentBlock, loopInterval, lengthOfBlock);
    if (lengthOfBlock - this.absoluteTimeToSynchronize < distanceToNextNoteInCurrentBlock) {
      distanceToNextNoteInNextBlock = distanceToNextNoteInCurrentBlock
        - (lengthOfBlock - this.absoluteTimeToSynchronize);
      distanceToNextNoteInCurrentBlock -= distanceToNextNoteInNextBlock;
    }

    // Throws a descriptive error for a missing beat (this used to log and then crash).
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId });

    let bpmInBlock = Song.bpm;
    const blockBpm = Song.measureMeta[blockId].bpm;
    if (blockBpm != null && blockBpm !== Song.bpm) {
      bpmInBlock = blockBpm;
    }

    // TODO nextNotePoint when after loop interval
    // TODO Fix duration to jump back point
    const durationOfNextNote = Duration.getDurationOfNote(beat, false);

    // COMPUTE time of note after nextNote
    let nextNotePoint = nextNoteObj.time + durationOfNextNote / 64;
    // correction, because tuplets compute with small error, to get it to the full beat
    if (Math.abs(nextNotePoint - Math.round(nextNotePoint)) < EPSILON) {
      nextNotePoint = Math.round(nextNotePoint);
    }
    const durTime = (durationOfNextNote / 64) * spw(bpmInBlock);
    const whenWillTheNextNoteBePlayed = currentTime + distanceToNextNoteInCurrentBlock * spw(Song.bpm)
      + distanceToNextNoteInNextBlock * spw(bpmInBlock);

    // TODO SPECIAL CASE: we jump because of a loop interval
    const currentRatio = PlayBackLogic.beatIdToRatio(trackId, blockId, voiceId, beatId);
    let nextBeat = beatId + 1;
    let nextBlock = blockId;
    let { sequenceIndex } = nextNoteObj;
    if (nextBeat >= Song.measures[trackId][blockId][voiceId].length
      || shouldTruncateNoteAtLoopEnd(
        blockId,
        currentRatio,
        durationOfNextNote / 64,
        loopInterval,
      )
    ) {
      nextBeat = 0;
      sequenceIndex += 1;
      nextBlock = this.getBlockFromSequence(sequenceIndex);
      if (loopInterval != null && nextBlock === loopInterval.startBlock) {
        const followingNote = this.findNextBeat(trackId, voiceId, loopInterval.startBlock,
          loopInterval.startRatio, loopInterval.endBlock, loopInterval.endRatio, sequenceIndex);
        if (followingNote != null && this.nextNoteTime[trackId][voiceId] != null) {
          nextBlock = followingNote.blockId;
          nextBeat = followingNote.beatId;
          sequenceIndex = followingNote.sequenceIndex;
          nextNotePoint = this.nextNoteTime[trackId][voiceId]!.time
            + (loopInterval.endRatio - currentRatio) + followingNote.distanceToNextNote;
        } else {
          nextBeat = -1;
        }
        if (sequenceIndex + 5 > this.playingSequenceCounter) {
          this.precomputeNextBlocks(sequenceIndex, 10);
        }
      }
    }
    // If note is already scheduled, do not schedule it again
    PlayBackLogic.playChord(
      trackId, blockId, voiceId, beatId, durTime, whenWillTheNextNoteBePlayed, beat,
    );

    // SAVE NOTE FOR DRAWING
    if (Song.currentTrackId === trackId && Song.currentVoiceId === voiceId) {
      const { notes } = Song.getBeat({ trackId, blockId, voiceId, beatId });
      this.notesInQueue.push({
        notes,
        time: whenWillTheNextNoteBePlayed,
        block: blockId,
        voiceId,
        beat: beatId,
        nextBlock,
        nextBeat,
        nextTime: whenWillTheNextNoteBePlayed + durTime,
      });
    }
    if (nextBeat !== -1) {
      this.nextNoteTime[trackId][voiceId] = {
        time: nextNotePoint, blockId: nextBlock, beatId: nextBeat, sequenceIndex,
      };
    } else {
      this.nextNoteTime[trackId][voiceId] = null;
    }
    return true;
  }

  getBlockFromSequence(id: number) {
    return this.playingBlockSequence[id % this.BUFFER_SIZE].blockId;
  }

  getPlayingIteration(id: number) {
    return this.playingBlockSequence[id % this.BUFFER_SIZE].playingIteration;
  }

  addToPlayingSequence(id: number, obj: { playingIteration: number, blockId: number }) {
    this.playingBlockSequence[id % this.BUFFER_SIZE] = obj;
  }

  adaptPlayBackToLoopIntervalChange(
    oldInterval: Interval | null,
    loopInterval: Interval | null,
  ) {
    // Precompute new blocks TODO: test if recomputation is necessary
    this.precomputeNextBlocks(this.alwaysIncreasingBlockNumber, 10);
    for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
      for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
        audioEngine.stopSourceOfTrack(trackId, voiceId);
        const startBlock = this.getBlockFromSequence(this.alwaysIncreasingBlockNumber);
        this.nextNoteTime[trackId][voiceId] = this.findNextBeatGeneral(trackId, voiceId, startBlock,
          this.absoluteTimeToSynchronize, loopInterval, this.alwaysIncreasingBlockNumber);
      }
    }
  }

  precomputeNextBlocks(currentSequencePosition: number, numberToPrecompute: number) {
    /** Precomputes the next @numberToPrecompute blocks and repeat alternatives to be played */
    let currentBlock = this.getBlockFromSequence(currentSequencePosition);
    this.playingIteration = this.getPlayingIteration(currentSequencePosition);
    const loopingInterval = currentLoopInterval();

    for (let i = 0; i < numberToPrecompute; i += 1) {
      const resolved = resolveNextBlockAfterCurrent(
        currentBlock,
        this.playingIteration,
        loopingInterval,
        Song.measureMeta,
        this.jumpBackPositions,
      );
      const nextBlock = resolved.nextBlock;
      this.playingIteration = resolved.playingIteration;

      currentBlock = nextBlock;
      const sequencePosition = currentSequencePosition + i + 1;
      this.addToPlayingSequence(sequencePosition, {
        blockId: nextBlock,
        playingIteration: this.playingIteration,
      });
    }
    this.playingSequenceCounter = currentSequencePosition + numberToPrecompute;
  }

  scheduler() {
    // compute new absolute time
    // During a count-in the song clock stands still at its start time.
    const currentTime = Math.max(audioEngine.getCurrentTime(), this.playStartAudioTime);
    const currentBlock = this.getBlockFromSequence(this.alwaysIncreasingBlockNumber);
    const currentBlockBpm = Song.measureMeta[currentBlock].bpm;
    if (currentBlockBpm != null && Song.bpm !== currentBlockBpm) {
      Song.setTempo(currentBlockBpm);
    }
    const loopInterval = currentLoopInterval();
    const extraTime = (currentTime - this.lastMeasuredTime) * wps(Song.bpm);

    // increase blockNumberOnBlockChange
    let lengthOfBlock = Song.measureMeta[currentBlock].numerator
      / Song.measureMeta[currentBlock].denominator;
    lengthOfBlock = getEffectiveBlockLengthForLoop(currentBlock, loopInterval, lengthOfBlock);
    if (this.absoluteTimeToSynchronize + extraTime >= lengthOfBlock) {
      this.alwaysIncreasingBlockNumber += 1;
      // a part of the time scheme has the old block info (bpm), the rest the new one
      const partOfTimeToReachNewBlock = (lengthOfBlock - this.absoluteTimeToSynchronize)
        * spw(Song.bpm);
      // now compute the next gone time with the new blockInfos
      const timeForNewBlock = (currentTime - this.lastMeasuredTime - partOfTimeToReachNewBlock);
      const nextBlock = this.getBlockFromSequence(this.alwaysIncreasingBlockNumber);
      this.currentBlockId = nextBlock;
      if (didCrossLoopBoundary(currentBlock, nextBlock, loopInterval)) {
        playbackController.setJumped();
        if (practiceState.trainer) {
          setPlaybackRate(nextTrainerRate(
            practiceState.playbackRate, practiceState.trainerStep, practiceState.trainerTarget,
          ));
        }
        if (loopInterval != null) {
          publishPlaybackPosition(
            loopInterval.startBlock,
            loopInterval.startBeat,
            loopInterval.startRatio * 64,
          );
        }
      }
      if (nextBlock >= Song.measures[0].length) {
        this.stopSong();
        return;
      }
      const nextBlockBpm = Song.measureMeta[nextBlock].bpm;
      if (nextBlockBpm != null && Song.bpm !== nextBlockBpm) {
        Song.setTempo(nextBlockBpm);
      }
      this.globalIncreasingTime += lengthOfBlock - this.absoluteTimeToSynchronize
        + timeForNewBlock * wps(Song.bpm);
      this.absoluteTimeToSynchronize = timeForNewBlock * wps(Song.bpm);
    } else {
      this.absoluteTimeToSynchronize += extraTime;
      this.globalIncreasingTime += extraTime;
    }

    if (this.alwaysIncreasingBlockNumber + 5 > this.playingSequenceCounter) {
      this.precomputeNextBlocks(this.alwaysIncreasingBlockNumber, 10);
    }
    // while there are notes before the next interval, schedule them and advance the pointer.
    const horizon = this.scheduleHorizon();
    for (let trackId = 0; trackId < Song.measures.length; trackId += 1) {
      for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
        let nextNoteObj = this.nextNoteTime[trackId][voiceId];
        if (nextNoteObj != null) {
          const { blockId } = nextNoteObj;
          if (Song.measures[trackId][blockId] != null) {
            while (nextNoteObj.time < horizon) {
              const ret = this.nextNote(trackId, blockId, voiceId, currentTime);
              if (!ret) return;
              if (this.nextNoteTime[trackId][voiceId] == null) {
                break;
              }
              nextNoteObj = this.nextNoteTime[trackId][voiceId]!;
            }
          }
        }
      }
    }

    // metronome (always while recording MIDI, otherwise when enabled)
    if (practiceState.metronome || liveInput.isRecording) {
      this.scheduleMetronomeClicks(currentTime);
    }
    if (liveInput.isRecording) {
      if (this.nextMidiNoteFetching < this.globalIncreasingTime) {
        this.nextMidiNoteFetching += this.noteFetchingQuantization;
        liveInput.writeRecordedNotes();
      }
    }
    this.lastMeasuredTime = currentTime;
  }

  setStartInformationPerVoice(blockId: number, completeDuration: number) {
    this.absoluteTimeToSynchronize = completeDuration / 64;
    this.globalIncreasingTime = this.absoluteTimeToSynchronize;

    for (let trackId = 0, n = Song.measures.length; trackId < n; trackId += 1) {
      // we assume the same block sizes
      this.nextNoteTime[trackId] = [];
      for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
        // Problem: not every block has a beat at the same spot
        let reachedDuration = 0;
        let beatIdFound = 0;
        let sequenceIndex = this.alwaysIncreasingBlockNumber + 1;
        let nextBlock = this.getBlockFromSequence(sequenceIndex);

        for (let k = 0, m = Song.measures[trackId][blockId][voiceId].length; k < m; k += 1) {
          if (reachedDuration >= completeDuration) {
            beatIdFound = k;
            nextBlock = blockId;
            sequenceIndex = this.alwaysIncreasingBlockNumber;
            break;
          }
          const ms = Song.getBeat({ trackId, blockId, voiceId, beatId: k });
          reachedDuration += Duration.getDurationOfNote(ms, false);
        }
        this.nextNoteTime[trackId][voiceId] = {
          time: reachedDuration / 64, blockId: nextBlock, sequenceIndex, beatId: beatIdFound,
        };
      }
    }
  }

  startPlayback() {
    void audioEngine.ensureContextRunning();
    Settings.songPlaying = true;
    audioEngine.drawVolumes();

    this.playJumpBackPosition = 0;
    this.playingIteration = 1;
    this.nextNoteTime.length = 0;
    this.playingBlockSequence.length = 0;
    this.playingSequenceCounter = 0;
    this.lastClickKey = -1;
    this.playStartAudioTime = audioEngine.getCurrentTime() + START_LEAD_SECONDS;
    if (practiceState.countIn) {
      this.playStartAudioTime += this.scheduleCountIn(this.playStartAudioTime + this.getCountInDuration());
    }
    this.lastMeasuredTime = this.playStartAudioTime;
    this.nextMidiNoteFetching = 0;

    // default jump-back-position is 0
    let lastRepeatOpenPosition = 0;
    // for remembering number of repetitions
    for (let j = 0; j < Song.measures[0].length; j += 1) {
      if (Song.measureMeta[j].repeatOpen) {
        lastRepeatOpenPosition = j;
      }
      if (Song.measureMeta[j].repeatClose != null) {
        this.jumpBackPositions[j] = lastRepeatOpenPosition;
      }
    }

    this.alwaysIncreasingBlockNumber = 0;
    this.currentBlockId = this.playPosition.block;
    this.addToPlayingSequence(0, {
      blockId: this.currentBlockId, playingIteration: 1,
    }); // 1-indexed
    this.precomputeNextBlocks(0, 10);
    this.setStartInformationPerVoice(this.playPosition.block, this.playPosition.positionInBlock);

    this.loopPreScheduled.length = 0;
    for (let trackId = 0, n = Song.tracks.length; trackId < n; trackId += 1) {
      this.loopPreScheduled[trackId] = [];
    }

    // 4/4 blocks have the length 1, 2/4 only the length 0.5 and so on
    let lastBlockStart = 0;
    let blockId = 0;
    const numBlocks = Song.measures.length;
    for (blockId = 0; blockId < numBlocks; blockId += 1) {
      this.startTimesOfBlocks[blockId] = lastBlockStart;
      lastBlockStart += Song.measureMeta[blockId].numerator
        / Song.measureMeta[blockId].denominator;
    }
    this.startTimesOfBlocks[blockId + 1] = lastBlockStart; // makes coding easier later

    if (liveInput.isRecording) {
      liveInput.recordMidi();
    }

    this.timerWorker.postMessage('start');
    this.triggerPiano();

    playbackController.initPlayBackParameters();
    playbackController.movePlayBackBarToPosInBlock(Song.currentTrackId, this.playPosition.block,
      Song.currentVoiceId, this.playPosition.positionInBlock, 0);
    publishPlaybackUiStarted(liveInput.isRecording);
    publishPlaybackPosition(
      this.playPosition.block,
      0,
      this.playPosition.positionInBlock,
    );
  }

  private getCountInBar(): { numerator: number, denominator: number, bpm: number } {
    const meta = Song.measureMeta[this.playPosition.block] ?? Song.measureMeta[0];
    return {
      numerator: meta?.numerator ?? 4,
      denominator: meta?.denominator ?? 4,
      bpm: meta?.bpm ?? Song.bpm,
    };
  }

  getCountInDuration(): number {
    const { numerator, denominator, bpm } = this.getCountInBar();
    return computeCountIn(numerator, denominator, bpm, getPlaybackRate(), 0).duration;
  }

  /** Schedule one bar of clicks ending at `startTime`; returns the count-in length in seconds. */
  scheduleCountIn(startTime: number): number {
    const { numerator, denominator, bpm } = this.getCountInBar();
    const { clicks, duration } = computeCountIn(numerator, denominator, bpm, getPlaybackRate(), startTime);
    clicks.forEach((click) => audioEngine.playMetronomeNote(click.time, click.accent));
    return duration;
  }

  playSongB() {
    this.playEpoch += 1;
    if (Settings.songPlaying) {
      // difference to stop button, we save last position
      const blockId = Math.max(0, this.currentBlockPP);
      const beatId = Math.max(0, this.currentBeatPP);
      this.stopSong();
      this.setPlayPosition(Song.currentTrackId, blockId, Song.currentVoiceId, beatId);
      // The edit cursor follows: pausing leaves it on the beat that was playing.
      if (Song.findBeat({
        trackId: Song.currentTrackId, blockId, voiceId: Song.currentVoiceId, beatId,
      })) {
        typedEventBus.emit('navigation.setClickedPos', {
          trackId: Song.currentTrackId,
          blockId,
          voiceId: Song.currentVoiceId,
          beatId,
          string: selectionState.cursor.string,
        });
      }
    } else {
      this.startPlayback();
    }
  }

  clearQueueAndSetNewBlock(blockId: number) {
    this.notesInQueue.length = 0;
    this.currentBlockPP = blockId;
    publishPlaybackPosition(blockId, this.currentBeatPP, this.playPosition.positionInBlock);
  }

  resetFaderVars() {
    this.lastBlockPP = 0;
    this.lastRow = -1;
    this.currentBlockPP = -1;
    this.wasTrackChanged = false;
  }

  triggerPiano() {
    if (Settings.songPlaying === false) {
      this.resetFaderVars();
      this.notesInQueue.length = 0;
      return;
    }
    if (this.trackChange) {
      this.notesInQueue.length = 0;
      this.currentBeatPP = 0;
      this.trackChange = false;
      this.wasTrackChanged = true;
    }
    let nextBeat = 0;
    let nextBlock = 0;
    let nextTime = 0;
    let currentNote: (Note | null)[] | null = null;
    let voiceId = 0;
    const currentTime = audioEngine.getCurrentTime();
    while (this.notesInQueue.length > 0 && this.notesInQueue[0].time < currentTime) {
      voiceId = this.notesInQueue[0].voiceId;
      currentNote = this.notesInQueue[0].notes;
      this.currentBlockPP = this.notesInQueue[0].block;
      this.currentBeatPP = this.notesInQueue[0].beat;
      nextBlock = this.notesInQueue[0].nextBlock;
      nextBeat = this.notesInQueue[0].nextBeat;
      nextTime = this.notesInQueue[0].nextTime;
      this.notesInQueue.splice(0, 1); // remove note from queue
    }
    setSequencerIndicator(Song.currentTrackId, this.currentBlockPP);

    // only draw on note change
    if (currentNote != null) {
      publishPlaybackPosition(
        this.currentBlockPP,
        this.currentBeatPP,
        this.playPosition.positionInBlock,
      );
      const track = Song.tracks[Song.currentTrackId];
      showPlaybackBeat(currentNote, track.strings, track.capo);

      // change row if necessary - guard against uninitialized data
      if (!tab.blockToRow?.[Song.currentTrackId]?.[voiceId]?.[this.currentBlockPP]) {
        return;
      }
      const currentRow = tab.blockToRow[Song.currentTrackId][voiceId][this.currentBlockPP].rowId;
      if (this.lastRow !== currentRow || this.wasTrackChanged) {
        if (Settings.scrollingEnabled) {
          navigationController.scrollToSvgPos(
            Song.currentTrackId,
            voiceId,
            currentRow,
            this.currentBlockPP,
          );
        }
        this.lastRow = currentRow;
        this.wasTrackChanged = false;
      }
      const transformTime = (nextTime - audioEngine.getCurrentTime()) * 1000;

      if (playbackController.hasBeenJumped()) {
        // Dirty quick fix: do not add the new row jump twice
        if (this.playBackMoveQueue.length === 0
          || this.playBackMoveQueue[this.playBackMoveQueue.length - 1].type !== 'ToBeat') {
          this.playBackMoveQueue.push({
            type: 'ToBeat',
            params: [
              Song.currentTrackId, this.currentBlockPP, Song.currentVoiceId, this.currentBeatPP, 0,
            ],
          });
        }
      }

      const longerFactor = 1.2;
      this.playBackMoveQueue.push({
        type: 'ToPosition',
        params: [Song.currentTrackId, nextBlock, voiceId,
          nextBeat, transformTime, longerFactor, this.currentBlockPP, this.currentBeatPP],
      });
    }
    if (this.playBackMoveQueue.length > 0) {
      this.movePlayBackBar();
    }

    if (this.currentBlockPP !== this.lastBlockPP) {
      this.lastBlockPP = this.currentBlockPP;
    }
    // set up to draw again
    window.requestAnimationFrame(this.triggerPiano.bind(this));
  }

  movePlayBackBar() {
    /** Moves marker indicating current position in tab based on the playBackMoveQueue */
    const playBackbarMovement = this.playBackMoveQueue.shift();
    if (playBackbarMovement != null) {
      const p = playBackbarMovement.params;
      if (playBackbarMovement.type === 'ToBeat') { // FOR SETTING INIT POS
        playbackController.movePlayBackBarToBeat(p[0], p[1], p[2], p[3], p[4]);
      } else if (playBackbarMovement.type === 'ToPosition') { // FOR TRANSFORMING FROM BEGINNING POSITION
        playbackController.movePlayBackBarToPosition(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
      }
    }
  }
}

const playBackLogic = new PlayBackLogic();
export default playBackLogic;
