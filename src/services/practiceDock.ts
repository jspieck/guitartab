import { toRaw } from 'vue'
import type { Beat } from '../stores/song'
import type { Interval } from '../types/song'

/**
 * What the docked fretboard/keyboard shows (Big win 28): the notes of a beat on the tab's
 * own strings, and the next beats with notes after it, in bar order (the loop's end goes
 * back to its start). Pure, so it is tested in node; the dock reads the song and the
 * playback position.
 */

export interface DockNote {
  /** data string (0 = lowest) */
  string: number
  /** fret from the nut, capo included */
  neckFret: number
  pitch: number
}

export interface DockSong {
  /** measures[block][voice][beat] of one track */
  measures: Beat[][][]
  strings: readonly number[]
  capo: number
}

export interface BeatPosition {
  blockId: number
  beatId: number
}

/** The notes a beat plays (tied notes keep sounding, so they count; rests give none). */
export function beatNotes(song: DockSong, voiceId: number, at: BeatPosition): DockNote[] {
  const beat = song.measures[at.blockId]?.[voiceId]?.[at.beatId]
  if (!beat) return []
  const notes: DockNote[] = []
  Array.from(toRaw(beat).notes ?? [], (note, string) => {
    if (note == null || note.fret == null || note.fret < 0 || string >= song.strings.length) return
    const neckFret = note.fret + song.capo
    notes.push({ string, neckFret, pitch: song.strings[string] + neckFret })
  })
  return notes
}

/** The beat after `at` in the voice: the next one in its bar, the next bar's first, the loop's start. */
export function nextBeat(
  song: DockSong,
  voiceId: number,
  at: BeatPosition,
  loop: Interval | null = null,
): BeatPosition | null {
  const beats = song.measures[at.blockId]?.[voiceId] ?? []
  if (at.beatId + 1 < beats.length) return { blockId: at.blockId, beatId: at.beatId + 1 }
  if (loop && at.blockId === loop.endBlock) return { blockId: loop.startBlock, beatId: loop.startBeat }
  for (let blockId = at.blockId + 1; blockId < song.measures.length; blockId += 1) {
    if ((song.measures[blockId]?.[voiceId]?.length ?? 0) > 0) return { blockId, beatId: 0 }
  }
  return null
}

/**
 * The next `count` beats after `at` that play a note, at most `range` beats ahead (so a long
 * rest doesn't pull a far-away beat in), with their notes.
 */
export function upcomingBeats(
  song: DockSong,
  voiceId: number,
  at: BeatPosition,
  count: number,
  loop: Interval | null = null,
  range = 16,
): { position: BeatPosition; notes: DockNote[] }[] {
  const found: { position: BeatPosition; notes: DockNote[] }[] = []
  let position: BeatPosition | null = at
  for (let step = 0; step < range && found.length < count; step += 1) {
    position = nextBeat(song, voiceId, position, loop)
    if (!position) break
    const notes = beatNotes(song, voiceId, position)
    if (notes.length) found.push({ position, notes })
  }
  return found
}
