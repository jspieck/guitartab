import type { Beat, Interval, MeasureMetaInfo } from '../../stores/song'
import { EPSILON } from '../../stores/settingsState'
import Duration from '../../utils/duration'
import {
  nextPlayedBar,
  playOrderContext,
  skipAlternative,
  startOfPlayOrder,
  type PlayedBar,
  type PlayOrderBar,
  type PlayOrderContext,
} from './playOrder'

/**
 * The song cursor: which bar plays after which (repeats, voltas, the loop interval) and
 * which beat comes next in a voice. Pure: it reads the song it is given and keeps no clock.
 * Positions inside a bar are in whole notes ("ratio": a 4/4 bar is 1.0 long) or in ticks
 * (whole = 64) where they say so.
 */

export interface PlaybackSong {
  measures: Beat[][][][]
  measureMeta: MeasureMetaInfo[]
  numVoices: number
}

/** The next beat a voice will play, and its start on the song clock (whole notes). */
export interface NextBeat {
  time: number
  blockId: number
  beatId: number
  /** index of its bar in the bar sequence */
  sequenceIndex: number
}

/** Length of a bar in whole notes (4/4 = 1, 3/4 = 0.75). */
export function barLength(song: PlaybackSong, blockId: number): number {
  const meta = song.measureMeta[blockId]
  return meta.numerator / meta.denominator
}

/** Ticks from the bar start to a beat. */
export function ticksBefore(
  song: PlaybackSong,
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
): number {
  const beats = song.measures[trackId][blockId][voiceId]
  let ticks = 0
  for (let i = 0; i < beatId; i += 1) ticks += Duration.getDurationOfNote(beats[i], false)
  return ticks
}

/** The beat after this one in the same voice (first beat of the next bar), or null at the song end. */
export function nextBeatRef(
  song: PlaybackSong,
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
): { blockId: number; beatId: number } | null {
  if (song.measures[trackId][blockId][voiceId].length <= beatId + 1) {
    if (song.measures[trackId].length <= blockId + 1) return null
    return { blockId: blockId + 1, beatId: 0 }
  }
  return { blockId, beatId: beatId + 1 }
}

const SEQUENCE_SIZE = 15

/**
 * The bars in playing order, from the bar playing now on: a ring buffer that is filled a few
 * bars ahead (`precompute`) with the steps of the play order (repeats, voltas, D.C./D.S.,
 * `playOrder.ts`), plus the loop interval: after the loop's end bar comes its start bar.
 * Indexes only grow, one per bar played (or jumped to).
 */
export class BarSequence {
  private readonly bars: PlayedBar[] = []

  private context: PlayOrderContext = playOrderContext([])

  /** The last index filled in. */
  filledUntil = 0

  /** Starts over on a song's bars (call when playback starts: the song may have changed). */
  reset(bars: readonly PlayOrderBar[] = this.context.bars): void {
    this.bars.length = 0
    this.filledUntil = 0
    this.context = playOrderContext(bars)
  }

  blockAt(index: number): number {
    return this.bars[index % SEQUENCE_SIZE].blockId
  }

  /** Playback continues at a bar as if it had started there (first pass, no jump taken). */
  set(index: number, blockId: number): void {
    this.bars[index % SEQUENCE_SIZE] = startOfPlayOrder(blockId)
  }

  /** Fills in the `count` bars after `index`. */
  precompute(index: number, count: number, loop: Interval | null): void {
    let current = this.bars[index % SEQUENCE_SIZE]
    for (let i = 1; i <= count; i += 1) {
      current =
        loop != null && current.blockId === loop.endBlock
          ? { ...current, blockId: skipAlternative(this.context.bars, loop.startBlock, current.pass) }
          : nextPlayedBar(this.context, current)
      this.bars[(index + i) % SEQUENCE_SIZE] = current
    }
    this.filledUntil = index + count
  }
}

/**
 * Where a voice continues after the loop end: the first beat at or after the loop start
 * (its distance from the loop start in whole notes), the next bar when the loop spans bars
 * and the start bar has none, or null when the loop holds no beat.
 */
export function firstBeatOfLoop(
  song: PlaybackSong,
  sequence: BarSequence,
  trackId: number,
  voiceId: number,
  loop: Interval,
  sequenceIndex: number,
): { beatId: number; blockId: number; sequenceIndex: number; distanceToNextNote: number } | null {
  const { startBlock, startRatio, endBlock, endRatio } = loop
  const beats = song.measures[trackId][startBlock][voiceId]
  let ticks = 0
  for (let beatId = 0; beatId < beats.length; beatId += 1) {
    if (ticks / 64 >= startRatio - EPSILON) {
      if (startBlock === endBlock && ticks / 64 >= endRatio - EPSILON) return null
      return { beatId, blockId: startBlock, sequenceIndex, distanceToNextNote: ticks / 64 - startRatio }
    }
    ticks += Duration.getDurationOfNote(beats[beatId], false)
  }
  if (endBlock !== startBlock) {
    return {
      beatId: 0,
      blockId: sequence.blockAt(sequenceIndex + 1),
      sequenceIndex: sequenceIndex + 1,
      distanceToNextNote: barLength(song, startBlock) - startRatio,
    }
  }
  return null
}

/**
 * The next beat of a voice from a position in a bar (whole notes), respecting the loop
 * interval's end; `songTime` is the song clock at that position. Null when the loop
 * (inside one bar) holds no beat of this voice.
 */
export function nextBeatFrom(
  song: PlaybackSong,
  sequence: BarSequence,
  trackId: number,
  voiceId: number,
  blockId: number,
  ratio: number,
  loop: Interval | null,
  sequenceIndex: number,
  songTime: number,
): NextBeat | null {
  const beats = song.measures[trackId][blockId][voiceId]
  let ticks = 0
  for (let beatId = 0; beatId < beats.length; beatId += 1) {
    if (ticks / 64 >= ratio - EPSILON) {
      if (loop != null && loop.endBlock === blockId && ticks / 64 >= loop.endRatio - EPSILON) break
      return { beatId, blockId, sequenceIndex, time: songTime + ticks / 64 - ratio }
    }
    ticks += Duration.getDurationOfNote(beats[beatId], false)
  }
  if (loop != null && loop.startBlock === loop.endBlock) {
    // (counts on from where the search above stopped, as the original did)
    let found = false
    for (let beatId = 0; beatId < beats.length; beatId += 1) {
      if (ticks / 64 >= loop.startRatio - EPSILON && ticks / 64 < loop.endRatio - EPSILON) {
        found = true
        break
      }
      ticks += Duration.getDurationOfNote(beats[beatId], false)
    }
    if (!found) return null
  }
  return {
    beatId: 0,
    blockId: sequence.blockAt(sequenceIndex + 1),
    sequenceIndex: sequenceIndex + 1,
    time: songTime + barLength(song, blockId) - ratio,
  }
}

/**
 * For every track and voice, the first beat at or after `ticks` into a bar (the sequence's
 * bar at `sequenceIndex`), or the next bar's first beat when the voice has none there.
 */
export function beatsFromPosition(
  song: PlaybackSong,
  sequence: BarSequence,
  blockId: number,
  ticks: number,
  sequenceIndex: number,
): (NextBeat | null)[][] {
  return song.measures.map((track) => {
    const voices: (NextBeat | null)[] = []
    for (let voiceId = 0; voiceId < song.numVoices; voiceId += 1) {
      const beats = track[blockId][voiceId]
      let reached = 0
      let next: NextBeat | null = null
      for (let beatId = 0; beatId < beats.length; beatId += 1) {
        if (reached >= ticks) {
          next = { time: reached / 64, blockId, sequenceIndex, beatId }
          break
        }
        reached += Duration.getDurationOfNote(beats[beatId], false)
      }
      voices[voiceId] = next ?? {
        time: reached / 64,
        blockId: sequence.blockAt(sequenceIndex + 1),
        sequenceIndex: sequenceIndex + 1,
        beatId: 0,
      }
    }
    return voices
  })
}
