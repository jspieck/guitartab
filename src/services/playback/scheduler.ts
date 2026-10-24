import Song, { type Interval } from '../../stores/song'
import { getPlaybackRate, practiceState, setPlaybackRate } from '../../stores/practiceState'
import Settings, { EPSILON } from '../../stores/settingsState'
import { clearPlaybackNotes } from '../../stores/soundingNotesState'
import Duration from '../../utils/duration'
import { audioGraph } from '../audio/audioGraph'
import { drawMeters } from '../audio/meters'
import { metronome } from '../audio/metronome'
import { samplePlayer } from '../audio/samplePlayer'
import {
  publishPlaybackPosition,
  publishPlaybackUiStarted,
  publishPlaybackUiStopped,
} from '../editor/playbackEngineBridge'
import * as playbackController from '../editor/playbackController'
import { currentLoopInterval } from '../editor/rangeSelection'
import liveInput from '../midi/liveInput'
import {
  didCrossLoopBoundary,
  getEffectiveBlockLengthForLoop,
  shouldTruncateNoteAtLoopEnd,
} from '../playbackLoopController'
import { computeCountIn, getBarBeatPositions, nextTrainerRate } from '../practiceTiming'
import { notePlayback } from './notePlayback'
import { playhead } from './playhead'
import {
  BarSequence,
  barLength,
  beatsFromPosition,
  firstBeatOfLoop,
  nextBeatFrom,
  repeatJumpBackPositions,
  ticksBefore,
  type NextBeat,
} from './songCursor'
import { setStartPosition, startPosition } from './startPosition'
import { spw, wps } from './tempo'
import { createTimerWorker } from './timerWorker'

/**
 * The playback clock. A worker ticks `tick()` every 25 ms; each tick advances the song clock
 * (whole notes) by the audio time that passed (at the bar's tempo and the practice speed),
 * moves on to the next bar of the bar sequence when the bar is over, and schedules every
 * beat (each track and voice) and metronome click that starts within `scheduleAhead`
 * seconds, on the AudioContext clock. Also: count-in, the speed trainer (one step per loop
 * pass), jumps, and the periodic flush of MIDI recording.
 */

const TICK_MS = 25
/** Lead time before the first count-in click / first note, so nothing is scheduled in the past. */
const START_LEAD_SECONDS = 0.05
/** Bars the sequence is filled ahead. */
const SEQUENCE_AHEAD = 10
/** Recorded MIDI notes are written into the song this often (whole notes). */
const RECORDING_FLUSH = 1 / 32

class PlaybackScheduler {
  readonly sequence = new BarSequence()

  /** seconds of audio scheduled ahead of the clock */
  scheduleAhead = 0.4

  timerWorker: Worker = createTimerWorker()

  /** Audio time at which playback (after an optional count-in) begins. */
  playStartAudioTime = 0

  /** song clock: whole notes since playback started (or since the last jump) */
  private songTime = 0

  /** whole notes into the bar playing now */
  private timeInBar = 0

  /** index of the playing bar in the bar sequence */
  private barIndex = 0

  /** the bar playing now */
  private currentBar = 0

  /** per track and voice: the next beat to schedule (null: none left in the loop) */
  private nextBeats: (NextBeat | null)[][] = []

  private lastAudioTime = 0

  private jumpBackPositions: number[] = []

  /** last metronome click scheduled, as `sequenceIndex * 64 + beat` */
  private lastClickKey = -1

  private nextRecordingFlush = 0

  init(): void {
    this.timerWorker.onmessage = (event) => {
      if (event.data === 'tick') this.tick()
    }
    this.timerWorker.postMessage({ interval: TICK_MS })
  }

  /** The bar of the next beat to schedule while playing (the cursor's bar otherwise is the caller's). */
  scheduledBar(): number {
    return this.sequence.blockAt(this.barIndex)
  }

  /** The bar playing now and how far into it (whole notes): where recorded notes go. */
  songPosition(): { blockId: number; positionInBlock: number } {
    return { blockId: this.currentBar, positionInBlock: this.timeInBar }
  }

  start(): void {
    void audioGraph.ensureContextRunning()
    Settings.songPlaying = true
    drawMeters()

    this.nextBeats = []
    this.sequence.reset()
    this.lastClickKey = -1
    this.playStartAudioTime = audioGraph.getCurrentTime() + START_LEAD_SECONDS
    if (practiceState.countIn) {
      this.playStartAudioTime += this.scheduleCountIn(this.playStartAudioTime + this.countInDuration())
    }
    this.lastAudioTime = this.playStartAudioTime
    this.nextRecordingFlush = 0
    this.jumpBackPositions = repeatJumpBackPositions(Song.measureMeta)

    this.barIndex = 0
    this.currentBar = startPosition.block
    this.sequence.set(0, this.currentBar, 1)
    this.precompute(0)
    this.startVoicesAt(startPosition.block, startPosition.positionInBlock)

    if (liveInput.isRecording) liveInput.recordMidi()

    this.timerWorker.postMessage('start')
    playhead.start()

    playbackController.initPlayBackParameters()
    playbackController.movePlayBackBarToPosInBlock(
      Song.currentTrackId,
      startPosition.block,
      Song.currentVoiceId,
      startPosition.positionInBlock,
      0,
    )
    publishPlaybackUiStarted(liveInput.isRecording)
    publishPlaybackPosition(startPosition.block, 0, startPosition.positionInBlock)
  }

  stop(): void {
    Settings.songPlaying = false
    this.timerWorker.postMessage('stop')
    samplePlayer.stopAll()
    playbackController.hidePlayBackBars()
    clearPlaybackNotes()
    setStartPosition(Song.currentTrackId, 0, Song.currentVoiceId, 0)
    publishPlaybackUiStopped()
  }

  /**
   * Moves playback to `ticks` into a bar (the beat there is `beatId`). While stopped this
   * only restarts the bar sequence there; Play starts from `startPosition`.
   */
  jumpToPosition(blockId: number, ticks: number, beatId: number): void {
    playhead.clearQueue()
    this.songTime = 0
    this.barIndex += 1
    this.currentBar = blockId
    this.sequence.set(this.barIndex, blockId, 1)
    if (Settings.songPlaying) {
      this.precompute(this.barIndex)
      playhead.jumpTo(Song.currentTrackId, blockId, Song.currentVoiceId, beatId)
      this.startVoicesAt(blockId, ticks)
    }
    playbackController.setJumped()
    samplePlayer.stopAll()
    publishPlaybackPosition(blockId, beatId, ticks)
  }

  /** The loop interval changed while playing: continue each voice from the clock's position under the new loop. */
  adaptToLoopChange(loop: Interval | null): void {
    this.precompute(this.barIndex)
    for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
      for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
        samplePlayer.stopVoice(trackId, voiceId)
        this.nextBeats[trackId][voiceId] = nextBeatFrom(
          Song,
          this.sequence,
          trackId,
          voiceId,
          this.sequence.blockAt(this.barIndex),
          this.timeInBar,
          loop,
          this.barIndex,
          this.songTime,
        )
      }
    }
  }

  private precompute(index: number): void {
    this.sequence.precompute(
      index,
      SEQUENCE_AHEAD,
      currentLoopInterval(),
      Song.measureMeta,
      this.jumpBackPositions,
    )
  }

  /** Sets the clock to `ticks` into a bar and every voice to its first beat from there. */
  private startVoicesAt(blockId: number, ticks: number): void {
    this.timeInBar = ticks / 64
    this.songTime = this.timeInBar
    this.nextBeats = beatsFromPosition(Song, this.sequence, blockId, ticks, this.barIndex)
  }

  /** How far ahead of the song clock to schedule, in whole notes (`scheduleAhead` at the current tempo). */
  private horizon(): number {
    return this.songTime + this.scheduleAhead * wps(Song.bpm)
  }

  /** One worker tick. */
  tick(): void {
    // During a count-in the song clock stands still at its start time.
    const currentTime = Math.max(audioGraph.getCurrentTime(), this.playStartAudioTime)
    const currentBar = this.sequence.blockAt(this.barIndex)
    const barBpm = Song.measureMeta[currentBar].bpm
    if (barBpm != null && Song.bpm !== barBpm) Song.setTempo(barBpm)
    const loop = currentLoopInterval()
    const passed = (currentTime - this.lastAudioTime) * wps(Song.bpm)
    const length = getEffectiveBlockLengthForLoop(currentBar, loop, barLength(Song, currentBar))

    if (this.timeInBar + passed >= length) {
      if (!this.enterNextBar(currentBar, length, currentTime, loop)) return
    } else {
      this.timeInBar += passed
      this.songTime += passed
    }

    if (this.barIndex + 5 > this.sequence.filledUntil) this.precompute(this.barIndex)
    this.scheduleDueBeats(currentTime)

    // metronome (always while recording MIDI, otherwise when enabled)
    if (practiceState.metronome || liveInput.isRecording) this.scheduleMetronomeClicks(currentTime)
    if (liveInput.isRecording && this.nextRecordingFlush < this.songTime) {
      this.nextRecordingFlush += RECORDING_FLUSH
      liveInput.writeRecordedNotes()
    }
    this.lastAudioTime = currentTime
  }

  /** The bar is over: move the clock into the next bar of the sequence. False when the song ended. */
  private enterNextBar(
    currentBar: number,
    length: number,
    currentTime: number,
    loop: Interval | null,
  ): boolean {
    this.barIndex += 1
    // the time up to the bar end runs at the old bar's tempo, the rest at the new one's
    const toBarEnd = (length - this.timeInBar) * spw(Song.bpm)
    const intoNewBar = currentTime - this.lastAudioTime - toBarEnd
    const nextBar = this.sequence.blockAt(this.barIndex)
    this.currentBar = nextBar
    const restartsLoop = didCrossLoopBoundary(currentBar, nextBar, loop)
    if (restartsLoop) {
      playbackController.setJumped()
      if (practiceState.trainer) {
        setPlaybackRate(
          nextTrainerRate(practiceState.playbackRate, practiceState.trainerStep, practiceState.trainerTarget),
        )
      }
      if (loop != null) publishPlaybackPosition(loop.startBlock, loop.startBeat, loop.startRatio * 64)
    }
    if (nextBar >= Song.measures[0].length) {
      this.stop()
      return false
    }
    const nextBpm = Song.measureMeta[nextBar].bpm
    if (nextBpm != null && Song.bpm !== nextBpm) Song.setTempo(nextBpm)
    this.songTime += length - this.timeInBar + intoNewBar * wps(Song.bpm)
    // the loop restarts mid-bar: the bar clock starts at the loop start, not at 0
    this.timeInBar = (restartsLoop ? loop!.startRatio : 0) + intoNewBar * wps(Song.bpm)
    return true
  }

  /** Schedules every beat that starts before the horizon, voice by voice. */
  private scheduleDueBeats(currentTime: number): void {
    const horizon = this.horizon()
    for (let trackId = 0; trackId < Song.measures.length; trackId += 1) {
      for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
        let next = this.nextBeats[trackId][voiceId]
        // (each beat in its own bar: one tick can reach into the next bar after a start or jump)
        while (next != null && next.time < horizon && Song.measures[trackId][next.blockId] != null) {
          this.scheduleBeat(trackId, voiceId, next, currentTime)
          next = this.nextBeats[trackId][voiceId]
        }
      }
    }
  }

  /** Schedules a voice's next beat and works out the one after it. */
  private scheduleBeat(trackId: number, voiceId: number, next: NextBeat, currentTime: number): void {
    const { blockId } = next
    let toBeatInBar = Math.max(0, next.time - this.songTime)
    let toBeatInNextBar = 0
    const { beatId } = next
    const currentBar = this.sequence.blockAt(this.barIndex)
    const loop = currentLoopInterval()
    const length = getEffectiveBlockLengthForLoop(currentBar, loop, barLength(Song, currentBar))
    if (length - this.timeInBar < toBeatInBar) {
      toBeatInNextBar = toBeatInBar - (length - this.timeInBar)
      toBeatInBar -= toBeatInNextBar
    }

    // Throws a descriptive error for a missing beat.
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
    const barBpm = Song.measureMeta[blockId].bpm
    const bpmInBar = barBpm != null && barBpm !== Song.bpm ? barBpm : Song.bpm
    const ticks = Duration.getDurationOfNote(beat, false)

    let followingTime = next.time + ticks / 64
    // tuplets add up with a small error: snap to the full beat
    if (Math.abs(followingTime - Math.round(followingTime)) < EPSILON)
      followingTime = Math.round(followingTime)
    const duration = (ticks / 64) * spw(bpmInBar)
    const start = currentTime + toBeatInBar * spw(Song.bpm) + toBeatInNextBar * spw(bpmInBar)

    // (tuplets at their played length, as the loop ends are measured)
    const ratio = ticksBefore(Song, trackId, blockId, voiceId, beatId) / 64
    let followingBeat = beatId + 1
    let followingBlock = blockId
    let { sequenceIndex } = next
    if (
      followingBeat >= Song.measures[trackId][blockId][voiceId].length ||
      shouldTruncateNoteAtLoopEnd(blockId, ratio, ticks / 64, loop)
    ) {
      followingBeat = 0
      sequenceIndex += 1
      followingBlock = this.sequence.blockAt(sequenceIndex)
      if (loop != null && followingBlock === loop.startBlock) {
        const first = firstBeatOfLoop(Song, this.sequence, trackId, voiceId, loop, sequenceIndex)
        if (first != null) {
          followingBlock = first.blockId
          followingBeat = first.beatId
          sequenceIndex = first.sequenceIndex
          followingTime = next.time + (loop.endRatio - ratio) + first.distanceToNextNote
        } else {
          followingBeat = -1
        }
        if (sequenceIndex + 5 > this.sequence.filledUntil) this.precompute(sequenceIndex)
      }
    }
    notePlayback.playBeat(trackId, blockId, voiceId, beatId, duration, start, beat)

    if (Song.currentTrackId === trackId && Song.currentVoiceId === voiceId) {
      playhead.queueBeat({
        notes: beat.notes,
        time: start,
        block: blockId,
        voiceId,
        beat: beatId,
        nextBlock: followingBlock,
        nextBeat: followingBeat,
        nextTime: start + duration,
      })
    }
    this.nextBeats[trackId][voiceId] =
      followingBeat !== -1
        ? { time: followingTime, blockId: followingBlock, beatId: followingBeat, sequenceIndex }
        : null
  }

  /**
   * Metronome clicks for the current and next bar that fall inside the look-ahead window: one
   * per beat of the bar's meter, accented on beat 1. Bars are followed through the bar
   * sequence, so repeats, loops, meter and tempo changes stay aligned.
   */
  private scheduleMetronomeClicks(currentTime: number): void {
    const loop = currentLoopInterval()
    const horizon = this.horizon()
    /** song time of the bar's position 0 (before the loop start when the loop restarts mid-bar) */
    let barZero = this.songTime - this.timeInBar
    for (let offset = 0; offset < 2 && barZero < horizon; offset += 1) {
      const sequenceIndex = this.barIndex + offset
      const blockId = this.sequence.blockAt(sequenceIndex)
      const meta = Song.measureMeta[blockId]
      if (meta == null) return
      const length = getEffectiveBlockLengthForLoop(blockId, loop, meta.numerator / meta.denominator)
      const skipped = this.loopEntryOffset(sequenceIndex, loop)
      if (offset > 0) barZero -= skipped
      const bpm = offset === 0 || meta.bpm == null ? Song.bpm : meta.bpm

      const beats = getBarBeatPositions(meta.numerator, meta.denominator, length)
      for (let beat = 0; beat < beats.length; beat += 1) {
        const key = sequenceIndex * 64 + beat
        if (key <= this.lastClickKey || beats[beat] < skipped - EPSILON) continue
        const tickTime = barZero + beats[beat]
        if (tickTime >= horizon) return
        this.lastClickKey = key
        if (tickTime >= this.songTime - EPSILON) {
          metronome.playClick(currentTime + (tickTime - this.songTime) * spw(bpm), beat === 0)
        }
      }
      barZero += length
    }
  }

  /** After a loop jump a bar is entered at the loop start: how far into it that is (else 0). */
  private loopEntryOffset(sequenceIndex: number, loop: Interval | null): number {
    const restartsLoop =
      loop != null &&
      sequenceIndex > 0 &&
      this.sequence.blockAt(sequenceIndex) === loop.startBlock &&
      this.sequence.blockAt(sequenceIndex - 1) === loop.endBlock
    return restartsLoop ? loop.startRatio : 0
  }

  private countInBar(): { numerator: number; denominator: number; bpm: number } {
    const meta = Song.measureMeta[startPosition.block] ?? Song.measureMeta[0]
    return {
      numerator: meta?.numerator ?? 4,
      denominator: meta?.denominator ?? 4,
      bpm: meta?.bpm ?? Song.bpm,
    }
  }

  private countInDuration(): number {
    const { numerator, denominator, bpm } = this.countInBar()
    return computeCountIn(numerator, denominator, bpm, getPlaybackRate(), 0).duration
  }

  /** Schedules one bar of clicks ending at `startTime`; returns the count-in length in seconds. */
  private scheduleCountIn(startTime: number): number {
    const { numerator, denominator, bpm } = this.countInBar()
    const { clicks, duration } = computeCountIn(numerator, denominator, bpm, getPlaybackRate(), startTime)
    clicks.forEach((click) => metronome.playClick(click.time, click.accent))
    return duration
  }
}

export type { PlaybackScheduler }

export const scheduler = new PlaybackScheduler()
