import fastdom from 'fastdom';
import workerFunction from './audioIntervalWorker';
import Settings from './settingManager';
import Song, { Note, Measure, Interval } from './songData';
import { audioEngine } from './audioEngine';
import midiEngine from './midiReceiver';
import Duration from './duration';
import { svgDrawer } from './svgDrawer';
import { tab } from './tab';
import { visualInstruments } from './visualInstruments';
import Helper from './helper';
import { overlayHandler } from './overlayHandler';
import { sequencer } from './sequencer';

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

  lastBlock: HTMLElement | null;

  nextMetronomeTime: number;

  metronomeCounter: number;

  lastMeasuredTime: number;

  alwaysIncreasingBlockNumber: number;

  absoluteTimeToSynchronize: number;

  scheduleAhead: number;

  playingBlockSequence: { playingIteration: number, blockId: number }[];

  playingSequenceCounter: number;

  BUFFER_SIZE: number;

  loopPreScheduled: number[][];

  nextMidiNoteFetching: number;

  metronomeQuantization: number;

  noteFetchingQuantization: number;

  lastMarkedBlock: { trackId: number, voiceId: number, blockId: number,
    beatId: number, string: number };

  lastBlockPP: number;

  currentBlockPP: number;

  currentBeatPP: number;

  startTimesOfBlocks: number[];

  playBackMoveQueue: {type: string, params: number[]}[];

  wasTrackChanged: boolean;

  lastRow: number;

  trackChange: boolean;

  lastFader: HTMLElement | null;

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
    this.lastBlock = null;

    this.nextMetronomeTime = 0;
    this.metronomeCounter = 0;

    this.lastMeasuredTime = 0;
    // number of blocks that was played
    this.alwaysIncreasingBlockNumber = 0;
    // 0.25 means that 1/4 of the time in the block has passed
    this.absoluteTimeToSynchronize = 0;
    this.scheduleAhead = 0.4;

    // TODO nextNote is scheduled at beginning of old loopInterval
    this.playingBlockSequence = [];
    this.playingSequenceCounter = 0;
    this.BUFFER_SIZE = 15;

    this.loopPreScheduled = [];
    this.nextMidiNoteFetching = 0;
    this.metronomeQuantization = 1 / 8;
    this.noteFetchingQuantization = 1 / 32;
    this.lastMarkedBlock = {
      trackId: 0,
      voiceId: 0,
      blockId: 0,
      beatId: 0,
      string: 0,
    };

    this.lastBlockPP = 0;
    this.currentBlockPP = 0;
    this.currentBeatPP = 0;

    this.startTimesOfBlocks = [];

    this.playBackMoveQueue = [];

    this.wasTrackChanged = false;
    this.lastRow = -1;
    this.trackChange = false;
    this.lastFader = null;

    this.jumpBackPositions = [];
  }

  // TODO this is not the current block, but the block of the scheduled next note
  getCurrentBlock(): number {
    if (Settings.songPlaying) {
      return this.getBlockFromSequence(this.alwaysIncreasingBlockNumber);
    }
    return tab.markedNoteObj.blockId;
  }

  setPlayPosition(
    trackId: number, blockId: number, voiceId: number, beatIdTo: number,
  ) {
    this.playPosition.block = blockId;
    let dur = 0;
    for (let beatId = 0; beatId < beatIdTo; beatId += 1) {
      dur += Duration.getDurationOfNote(
        Song.measures[trackId][blockId][voiceId][beatId],
        false,
      );
    }
    this.playPosition.positionInBlock = dur;
  }

  resetPlayBack() {
    this.playingIteration = 1;
    this.playPosition.block = 0;
    this.playPosition.positionInBlock = 0;
  }

  initTimerWorker() {
    // this.timerWorker = new Worker('./js/audioIntervalWorker');
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
    fastdom.mutate(() => {
      document.getElementById('play')?.classList.remove('playing');
      if (this.lastBlock != null) {
        this.lastBlock.style.background = 'transparent';
      }
      // document.getElementById("completeBar").style.display = 'block';
      document.getElementById('barButtons')!.style.display = 'block';
      document.getElementById('statusBars')!.style.display = 'inline-block';
    });
    this.timerWorker.postMessage('stop');
    document.getElementById('recordButton')?.classList.remove('recording');
    // Stop all audio playback immediately
    audioEngine.stopAllSources();
    svgDrawer.hidePlayBackBars();
    visualInstruments.unmarkVisualInstruments();
    svgDrawer.unmarkCurrentNotes();
    this.setPlayPosition(Song.currentTrackId, 0, Song.currentVoiceId, 0);
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
          this.nextMetronomeTime = 0;
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
    svgDrawer.setJumped();
    audioEngine.stopAllSources();
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
    chordDuration: number, chordStart: number, beat: Measure,
  ) {
    const chord = Song.measures[trackId][blockId][voiceId][beatId].notes;
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
      nextNoteDuration += (duration / 64) * (240 / Song.bpm);
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
    string: number, beat: Measure, note: Note, noteStartIn: number, durationIn: number,
    volume: number) {
    let noteStart = noteStartIn;
    let duration = durationIn;
    const beatEffects = beat.effects;
    if (string !== -1 && beatEffects != null && beatEffects.strokePresent) {
      const { numStrings } = Song.tracks[trackId];
      const { strokeLength, strokeType } = beatEffects.stroke;
      // strokeLength is 128 for 1/128 and 8 for eighth
      const laterStart = 1 / strokeLength / (2 * 6); // divided through the number of frets
      // var laterStart = Duration.getDurationOfType(strokeLength)/64;
      const secFactor = 1;// 0.8;
      if (strokeType === 'down') {
        noteStart += ((laterStart * 240) / Song.bpm) * (numStrings - 1 - string) * secFactor;
        duration -= ((laterStart * 240) / Song.bpm) * (numStrings - 1 - string) * secFactor;
      } else {
        noteStart += ((laterStart * 240) / Song.bpm) * string * secFactor;
        duration -= ((laterStart * 240) / Song.bpm) * string * secFactor;
      }
    }

    const nextFret = Helper.findNextNote(trackId, blockId, voiceId, beatId, string);
    const instr = Song.playBackInstrument[trackId].instrument;
    /* if(instrumentList[instr] != null)
            volume *= instrumentList[instr][3]; */
    const { fret } = note;
    if (instr === 'guitar' || instr === 'eguitar' || instr === 'disteguitar'
      || instr === 'nylonGuitar' || instr === 'bass' || instr === 'overdriveguitar') {
      // const tuningDiff = tuning.getTuningDifference(trackId, string);
      // const myCapo = Song.tracks[trackId].capo;
      // let baseHeight = parseInt(myCapo, 10) + tuningDiff;
      // bass is one octave lower so +12
      // if (instr === 'bass') {
      //   baseHeight += 12;
      // }
      // let nextNote = null;
      // if (nextFret != null) {
      //   nextNote = nextFret + parseInt(myCapo, 10) + tuningDiff;
      // }

      if (note.gracePresent) {
        const timeBefore = (Duration.getDurationOfType(note.graceObj.duration) / 64)
          * (240 / Song.bpm);
        // first grace
        audioEngine.playSF2(trackId, voiceId, string, note.graceObj.fret, volume,
          noteStart, timeBefore, beat, null, instr, nextFret);
        // then normal note
        audioEngine.playSF2(trackId, voiceId, string, fret, volume,
          noteStart + timeBefore, duration, beat, null, instr, nextFret);
      } else {
        audioEngine.playSF2(trackId, voiceId, string, fret, volume, noteStart,
          duration, beat, note, instr, nextFret);
      }
    } else if (instr === 'drums') {
      // audioEngine.playDrums(trackId, voiceId, fret, volume, noteStart, beat);
      audioEngine.playSF2(trackId, voiceId, 0, fret, volume, noteStart,
        duration, beat, null, instr, nextFret);
    }
    // lowest guitar note = 40 E3
    // 40 + bundNoten[5-i] + parseInt(chord[i].fret) + parseInt(myCapo);
    if (note.gracePresent) {
      const timeBefore = (Duration.getDurationOfType(note.graceObj.duration) / 64)
        * (240 / Song.bpm);
      audioEngine.playSF2(trackId, voiceId, string, note.graceObj.fret, volume,
        noteStart, duration, beat, note, instr, nextFret);
      audioEngine.playSF2(trackId, voiceId, string, fret, volume, noteStart + timeBefore,
        duration, beat, note, instr, nextFret);
    } else {
      audioEngine.playSF2(trackId, voiceId, string, fret, volume, noteStart,
        duration, beat, note, instr, nextFret);
    }
  }

  initMetronome() {
    // find next start time
    console.log(this.absoluteTimeToSynchronize);
    let startTime = 0;
    while (startTime < this.absoluteTimeToSynchronize) {
      startTime += this.metronomeQuantization;
    }
    console.log('STT', startTime);
    this.nextMetronomeTime = this.alwaysIncreasingBlockNumber + startTime;
    this.metronomeCounter = 0;
  }

  nextMetronomeNote(currentTime: number) {
    let distanceToNextNoteInCurrentBlock = this.nextMetronomeTime - this.globalIncreasingTime;
    let distanceToNextNoteInNextBlock = 0;

    const currentBlock = this.getBlockFromSequence(this.alwaysIncreasingBlockNumber);
    const lengthOfBlock = Song.measureMeta[currentBlock].numerator
      / Song.measureMeta[currentBlock].denominator;
    if (lengthOfBlock - this.absoluteTimeToSynchronize < distanceToNextNoteInCurrentBlock) {
      distanceToNextNoteInNextBlock = distanceToNextNoteInCurrentBlock
        - (lengthOfBlock - this.absoluteTimeToSynchronize);
      distanceToNextNoteInCurrentBlock -= distanceToNextNoteInNextBlock;
    }

    let bpmInBlock = Song.bpm;
    const nextBlock = this.getBlockFromSequence(this.alwaysIncreasingBlockNumber + 1);
    if (Song.measureMeta[nextBlock] != null && Song.measureMeta[nextBlock].bpmPresent
      && Song.measureMeta[nextBlock].bpm !== Song.bpm) {
      bpmInBlock = Song.measureMeta[nextBlock].bpm;
    }
    const whenWillTheNextNoteBePlayed = currentTime + (distanceToNextNoteInCurrentBlock * 240)
      / Song.bpm + (distanceToNextNoteInNextBlock * 240) / bpmInBlock;

    audioEngine.playMetronomeNote(whenWillTheNextNoteBePlayed, this.metronomeCounter === 0);
    this.metronomeCounter = (this.metronomeCounter + 1) % 4;
  }

  getAbsoluteTime() {
    return this.absoluteTimeToSynchronize;
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
  /* static scheduleNoteAtLoopBegin(trackId, blockId, voiceId, relativeTimeBegin,
    timeFrameAfterBegin, timeAtLoopBegin) {
    let accumulateTime = 0;
    console.log('scheduleNoteAtLoopBegin ', relativeTimeBegin,
      timeFrameAfterBegin, timeAtLoopBegin);

    console.log(trackId, voiceId, blockId, Song.measures[trackId][blockId][voiceId]);
    const n = Song.measures[trackId][blockId][voiceId].length;
    for (let beatId = 0; beatId < n; beatId += 1) {
      const beat = Song.measures[trackId][blockId][voiceId][beatId];
      accumulateTime += Duration.getDurationOfNote(beat, true);
      if (accumulateTime > relativeTimeBegin
        && accumulateTime < relativeTimeBegin + timeFrameAfterBegin) {
        // const duration = Duration.getDurationOfNote(beat);
        // let bpmInBlock = Song.bpm;
        if (Song.measureMeta[blockId].bpmPresent && Song.measureMeta[blockId].bpm !== Song.bpm) {
          bpmInBlock = Song.measureMeta[blockId].bpm;
        }
        // const durTime = (duration / 64) * (240 / bpmInBlock);
        // const timeToThisNote = ((accumulateTime - relativeTimeBegin) / 64) * (240 / Song.bpm);
        // const whenWillTheNextNoteBePlayed = timeAtLoopBegin + timeToThisNote;
        // TODO if interval changed -> cancel scheduled notes and schedule new
        // console.log("CHORD SCHEDULE NEW "+beatId);
        // playChord(trackId, blockId, voiceId, beatId, durTime, whenWillTheNextNoteBePlayed, beat);
        // this.loopPreScheduled[trackId][voiceId] = beatId;
        // break;
      }
    }
  } */

  static beatIdToRatio(trackId: number, blockId: number, voiceId: number, endBeatId: number) {
    let accumulateTime = 0;
    for (let beatId = 0; beatId < endBeatId; beatId += 1) {
      accumulateTime += Duration.getDurationOfNote(
        Song.measures[trackId][blockId][voiceId][beatId], true,
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
      if (accumulateTime / 64 >= startRatio - Settings.EPSILON) {
        if (startBlock === endBlock && accumulateTime / 64 >= endRatio - Settings.EPSILON) {
          return null;
        }
        return {
          beatId,
          blockId: startBlock,
          sequenceIndex,
          distanceToNextNote: accumulateTime / 64 - startRatio,
        };
      }
      const ms = Song.measures[trackId][startBlock][voiceId][beatId];
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
      if (accumulateTime / 64 >= startRatio - Settings.EPSILON) {
        if (loopingInterval != null && loopingInterval.endBlock === startBlock
          && accumulateTime / 64 >= loopingInterval.endRatio - Settings.EPSILON) {
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
      const ms = Song.measures[trackId][startBlock][voiceId][beatId];
      accumulateTime += Duration.getDurationOfNote(ms, true);
    }
    // Second case: there is no note in the given looping area -> return null
    if (loopingInterval != null && loopingInterval.startBlock === loopingInterval.endBlock) {
      let noteFound = false;
      const n2 = Song.measures[trackId][startBlock][voiceId].length;
      for (let beatId = 0; beatId < n2; beatId += 1) {
        if (accumulateTime / 64 >= loopingInterval.startRatio - Settings.EPSILON
          && accumulateTime / 64 < loopingInterval.endRatio - Settings.EPSILON) {
          noteFound = true;
          break;
        }
        const ms = Song.measures[trackId][startBlock][voiceId][beatId];
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
    const loopInterval = overlayHandler.getLoopingInterval();
    if (loopInterval != null && loopInterval.endBlock === currentBlock) {
      lengthOfBlock = loopInterval.endRatio;
    }
    if (lengthOfBlock - this.absoluteTimeToSynchronize < distanceToNextNoteInCurrentBlock) {
      distanceToNextNoteInNextBlock = distanceToNextNoteInCurrentBlock
        - (lengthOfBlock - this.absoluteTimeToSynchronize);
      distanceToNextNoteInCurrentBlock -= distanceToNextNoteInNextBlock;
    }

    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    if (beat == null) {
      console.log(`BEAT ERROR ${trackId} ${blockId} ${voiceId} ${beatId}`);
    }

    let bpmInBlock = Song.bpm;
    if (Song.measureMeta[blockId].bpmPresent && Song.measureMeta[blockId].bpm !== Song.bpm) {
      bpmInBlock = Song.measureMeta[blockId].bpm;
    }

    // TODO nextNotePoint when after loop interval
    // TODO Fix duration to jump back point
    const durationOfNextNote = Duration.getDurationOfNote(beat, false);

    // COMPUTE time of note after nextNote
    let nextNotePoint = nextNoteObj.time + durationOfNextNote / 64;
    // correction, because tuplets compute with small error, to get it to the full beat
    if (Math.abs(nextNotePoint - Math.round(nextNotePoint)) < Settings.EPSILON) {
      nextNotePoint = Math.round(nextNotePoint);
    }
    const durTime = (durationOfNextNote / 64) * (240 / bpmInBlock);
    const whenWillTheNextNoteBePlayed = currentTime + (distanceToNextNoteInCurrentBlock * 240)
      / Song.bpm + (distanceToNextNoteInNextBlock * 240) / bpmInBlock;

    // TODO SPECIAL CASE: we jump because of a loop interval
    const currentRatio = PlayBackLogic.beatIdToRatio(trackId, blockId, voiceId, beatId);
    let nextBeat = beatId + 1;
    let nextBlock = blockId;
    let { sequenceIndex } = nextNoteObj;
    if (nextBeat >= Song.measures[trackId][blockId][voiceId].length
      || (loopInterval != null && loopInterval.endBlock === blockId
      && loopInterval.endRatio <= currentRatio + durationOfNextNote / 64)
    ) {
      nextBeat = 0;
      sequenceIndex += 1;
      nextBlock = this.getBlockFromSequence(sequenceIndex);
      if (loopInterval != null && nextBlock === loopInterval.startBlock) {
        const followingNote = this.findNextBeat(trackId, voiceId, loopInterval.startBlock,
          loopInterval.startRatio, loopInterval.endBlock, loopInterval.endRatio, sequenceIndex);
        // console.log(followingNote);
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
      // console.log("NEXT BLOCK ", nextBlock, nextBeat, trackId, voiceId);
    }
    // If note is already scheduled, do not schedule it again
    // if(this.loopPreScheduled[trackId][voiceId] != null){
    //    this.loopPreScheduled[trackId][voiceId] = null;
    // }else{
    PlayBackLogic.playChord(
      trackId, blockId, voiceId, beatId, durTime, whenWillTheNextNoteBePlayed, beat,
    );
    // }

    // SAVE NOTE FOR DRAWING
    if (Song.currentTrackId === trackId && Song.currentVoiceId === voiceId) {
      const { notes } = Song.measures[trackId][blockId][voiceId][beatId];
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
        // console.log("REPEAT", this.nextNoteTime[trackId][voiceId], this.playingBlockSequence);
      }
    }
  }

  precomputeNextBlocks(currentSequencePosition: number, numberToPrecompute: number) {
    /** Precomputes the next @numberToPrecompute blocks and repeat alternatives to be played */
    // console.log(currentSequencePosition, numberToPrecompute);
    let currentBlock = this.getBlockFromSequence(currentSequencePosition);
    this.playingIteration = this.getPlayingIteration(currentSequencePosition);

    for (let i = 0; i < numberToPrecompute; i += 1) {
      let nextBlock = currentBlock;
      let newplayingIteration = this.playingIteration;

      const loopingInterval = overlayHandler.getLoopingInterval();
      // Consider repititions by a looping interval or tab repeats
      if (loopingInterval != null && currentBlock === loopingInterval.endBlock) {
        nextBlock = loopingInterval.startBlock;
      } else if (Song.measureMeta[currentBlock] != null
        && Song.measureMeta[currentBlock].repeatClosePresent
        && Song.measureMeta[currentBlock].repeatClose >= this.playingIteration) {
        nextBlock = this.jumpBackPositions[currentBlock];
        // hasJumpedBack = true;
        if (nextBlock == null) nextBlock = 0;

        newplayingIteration = this.playingIteration + 1;
      } else {
        nextBlock += 1;
      }
      // Manage repeatAlternative
      if (Song.measureMeta[nextBlock] != null
        && Song.measureMeta[nextBlock].repeatAlternative != null) {
        const bitP = (Song.measureMeta[nextBlock].repeatAlternative
          >> (this.playingIteration - 1)) & 1;
        if (bitP === 0) {
          // find next repeatAlternative
          for (let j = 1; j < 50; j += 1) { // SECURITY REASONS NO WHILE
            if (Song.measureMeta[nextBlock + j] == null) break;
            if (((Song.measureMeta[nextBlock + j].repeatAlternative
              >> (this.playingIteration - 1)) & 1) === 1) {
              nextBlock += j;
              break;
            }
          }
        }
      }
      this.playingIteration = newplayingIteration;

      // check if next block resets playingIteration
      if (Song.measureMeta[nextBlock] != null
        && Song.measureMeta[nextBlock].repeatOpen && currentBlock < nextBlock) {
        this.playingIteration = 1;
      }

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
    const currentTime = audioEngine.getCurrentTime();
    const currentBlock = this.getBlockFromSequence(this.alwaysIncreasingBlockNumber);
    if (Song.measureMeta[currentBlock].bpmPresent && Song.bpm
      !== Song.measureMeta[currentBlock].bpm) {
      Song.setTempo(Song.measureMeta[currentBlock].bpm);
    }
    const loopInterval = overlayHandler.getLoopingInterval();
    const extraTime = (currentTime - this.lastMeasuredTime) * (Song.bpm / 240);

    // increase blockNumberOnBlockChange
    let lengthOfBlock = Song.measureMeta[currentBlock].numerator
      / Song.measureMeta[currentBlock].denominator;
    if (loopInterval != null && loopInterval.endBlock === currentBlock) {
      lengthOfBlock = loopInterval.endRatio;
    }
    // console.log('AIB', this.absoluteTimeToSynchronize, extraTime, lengthOfBlock);
    if (this.absoluteTimeToSynchronize + extraTime >= lengthOfBlock) {
      this.alwaysIncreasingBlockNumber += 1;
      // a part of the time scheme has the old block info (bpm), the rest the new one
      const partOfTimeToReachNewBlock = ((lengthOfBlock - this.absoluteTimeToSynchronize)
        * 240) / Song.bpm;
      // now compute the next gone time with the new blockInfos
      const timeForNewBlock = (currentTime - this.lastMeasuredTime - partOfTimeToReachNewBlock);
      const nextBlock = this.getBlockFromSequence(this.alwaysIncreasingBlockNumber);
      this.currentBlockId = nextBlock;
      if (nextBlock >= Song.measures[0].length) {
        this.stopSong();
        return;
      }
      if (Song.measureMeta[nextBlock].bpmPresent && Song.bpm !== Song.measureMeta[nextBlock].bpm) {
        Song.setTempo(Song.measureMeta[nextBlock].bpm);
      }
      this.globalIncreasingTime += lengthOfBlock - this.absoluteTimeToSynchronize
        + (timeForNewBlock * Song.bpm) / 240;
      this.absoluteTimeToSynchronize = timeForNewBlock * (Song.bpm / 240);
    } else {
      this.absoluteTimeToSynchronize += extraTime;
      this.globalIncreasingTime += extraTime;
    }

    if (this.alwaysIncreasingBlockNumber + 5 > this.playingSequenceCounter) {
      this.precomputeNextBlocks(this.alwaysIncreasingBlockNumber, 10);
    }
    // while there are notes before the next interval, schedule them and advance the pointer.
    for (let trackId = 0; trackId < Song.measures.length; trackId += 1) {
      for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
        let nextNoteObj = this.nextNoteTime[trackId][voiceId];
        if (nextNoteObj != null) {
          const { blockId } = nextNoteObj;
          if (Song.measures[trackId][blockId] != null) {
            while (nextNoteObj.time < this.globalIncreasingTime + this.scheduleAhead) {
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

    if (this.lastMarkedBlock == null
      || this.lastMarkedBlock.trackId !== Song.currentTrackId
      || this.lastMarkedBlock.blockId !== currentBlock
      || this.lastMarkedBlock.voiceId !== Song.currentVoiceId) {
      this.updateMarkedBlock(Song.currentTrackId, currentBlock, Song.currentVoiceId);
    }

    // metronome
    if (midiEngine.isRecording) {
      while (this.nextMetronomeTime < this.globalIncreasingTime + this.scheduleAhead / 2) {
        this.nextMetronomeNote(currentTime);
        this.nextMetronomeTime += this.metronomeQuantization;
      }
      if (this.nextMidiNoteFetching < this.globalIncreasingTime) {
        this.nextMidiNoteFetching += this.noteFetchingQuantization;
        midiEngine.midiToNote();
      }
    }
    this.lastMeasuredTime = currentTime;
  }

  updateMarkedBlock(trackId: number, blockId: number, voiceId: number) {
    fastdom.mutate(() => {
      // mark block
      if (this.lastBlock != null) {
        // this.lastBlock.style.background = "transparent";
        this.lastBlock.classList.remove('currentMarkedBlock');
      }
      const currentLineBlock = document.getElementById(`lineBlock_${trackId}_${blockId}_${voiceId}`);
      if (currentLineBlock != null) {
        // currentLineBlock.style.background = "rgba(255, 255, 129, 0.25)";
        currentLineBlock.classList.add('currentMarkedBlock');
        this.lastBlock = currentLineBlock;
      }
      this.lastMarkedBlock = {
        trackId, blockId, voiceId, beatId: 0, string: 0,
      };
    });
  }

  setStartInformationPerVoice(blockId: number, completeDuration: number) {
    this.absoluteTimeToSynchronize = completeDuration / 64;
    this.nextMetronomeTime = completeDuration / 64;
    this.globalIncreasingTime = this.absoluteTimeToSynchronize;
    // console.log(this.absoluteTimeToSynchronize, completeDuration, timeQuotient);

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
          const ms = Song.measures[trackId][blockId][voiceId][k];
          reachedDuration += Duration.getDurationOfNote(ms, false);
        }
        this.nextNoteTime[trackId][voiceId] = {
          time: reachedDuration / 64, blockId: nextBlock, sequenceIndex, beatId: beatIdFound,
        };
      }
    }
  }

  startPlayback() {
    fastdom.mutate(() => {
      Settings.songPlaying = true;
      audioEngine.drawVolumes();
      document.getElementById('play')?.classList.add('playing');

      this.playJumpBackPosition = 0;
      this.playingIteration = 1;
      this.nextNoteTime.length = 0;
      this.playingBlockSequence.length = 0;
      this.playingSequenceCounter = 0;
      this.lastBlock = null;
      this.lastMeasuredTime = audioEngine.getCurrentTime();
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

      document.getElementById('barButtons')!.style.display = 'none';
      document.getElementById('statusBars')!.style.display = 'none';
      if (midiEngine.isRecording) {
        this.initMetronome();
        document.getElementById('recordButton')?.classList.add('recording');
        midiEngine.recordMidi();
      }

      this.timerWorker.postMessage('start');
      this.triggerPiano();

      svgDrawer.initPlayBackParameters();
      svgDrawer.movePlayBackBarToPosInBlock(Song.currentTrackId, this.playPosition.block,
        Song.currentVoiceId, this.playPosition.positionInBlock, 0);
      // playSong(0,this.playEpoch,0,0);
      // waveSurfer.play();
    });
  }

  playSongB() {
    this.playEpoch += 1;
    if (Settings.songPlaying) {
      // difference to stop button, we save last position
      this.stopSong();
      this.setPlayPosition(Song.currentTrackId, this.currentBlockPP,
        Song.currentVoiceId, this.currentBeatPP);
      // waveSurfer.stop();
    } else {
      this.startPlayback();
    }
  }

  clearQueueAndSetNewBlock(blockId: number) {
    this.notesInQueue.length = 0;
    this.currentBlockPP = blockId;
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
      if (this.lastFader != null) {
        fastdom.mutate(() => {
          this.lastFader!.style.display = "none";
        });
      }
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
    sequencer.setIndicator(Song.currentTrackId, this.currentBlockPP);

    // only draw on note change
    if (currentNote != null) {
      svgDrawer.markCurrentNotes(currentNote);
      visualInstruments.updatePianoAndGuitar(currentNote);

      // change row if necessary
      const currentRow = tab.blockToRow[Song.currentTrackId][voiceId][this.currentBlockPP].rowId;
      if (this.lastRow !== currentRow || this.wasTrackChanged) {
        if (this.lastRow !== -1 && !this.wasTrackChanged) {
          document.getElementById(`songFader_${Song.currentTrackId}_${voiceId}_${this.lastRow}`)!.style.display = "none";
        }
        if (Settings.scrollingEnabled) {
          svgDrawer.scrollToSvgPos(currentRow, this.currentBlockPP);
        }
        // scrollToBlock(this.currentBlockPP);
        this.lastRow = currentRow;
        this.wasTrackChanged = false;
      }
      const transformTime = (nextTime - audioEngine.getCurrentTime()) * 1000;

      /* trick if next beat is not in horizontal increasing distance set beat new
      var rowId = tab.blockToRow[Song.currentTrackId][
        Song.currentVoiceId][this.currentBlockPP].rowId;
      var isNewRow = this.currentBeatPP == 0
        && tab.blocksPerRow[Song.currentTrackId][Song.currentVoiceId][rowId].start
        == this.currentBlockPP;
      var isRepeatJump = this.currentBeatPP == 0 && (this.lastBlockPP + 1 != this.currentBlockPP);
      if(isNewRow || isRepeatJump){ */
      if (svgDrawer.hasBeenJumped()) {
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
    // console.log(playBackbarMovement);
    if (playBackbarMovement != null) {
      const p = playBackbarMovement.params;
      if (playBackbarMovement.type === 'ToBeat') { // FOR SETTING INIT POS
        svgDrawer.movePlayBackBarToBeat(p[0], p[1], p[2], p[3], p[4]);
      } else if (playBackbarMovement.type === 'ToPosition') { // FOR TRANSFORMING FROM BEGINNING POSITION
        svgDrawer.movePlayBackBarToPosition(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
      }
    }
  }
}

const playBackLogic = new PlayBackLogic();
export default playBackLogic;
