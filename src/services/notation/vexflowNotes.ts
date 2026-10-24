import Vex from 'vexflow'
import { toRaw } from 'vue'
import Song, { type Beat } from '../../stores/song'
import {
  CLASSICAL_STAFF_LINES_HEIGHT,
  type ClassicalStaffExtents,
} from '../../stores/classicalNotationLayoutState'
import { tupletState } from '../../stores/tupletState'

/**
 * The pure parts of classical notation: tab beats as VexFlow durations and keys, the clef of
 * a track, note widths and how far notes reach beyond the staff.
 */

const STAFF_LINE_SPACING = 10
/** Conservative stem length incl. beam slope, used for vertical extents. */
const STEM_EXTENT = 40
/** Half height of a note head incl. accidental glyphs. */
const NOTE_HEAD_EXTENT = 8

const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']

const VEXFLOW_DURATIONS: Record<string, string> = {
  w: 'w',
  h: 'h',
  q: 'q',
  e: '8',
  s: '16',
  t: '32',
  z: '64',
}

/**
 * A MIDI pitch as a VexFlow key. Guitar music is written an octave above it sounds, so
 * MIDI 40 (the low E, E2) is written `e/3`.
 */
export function pitchToVexFlow(height: number): string {
  return `${NOTE_NAMES[height % 12]}/${Math.floor(height / 12)}`
}

/** A beat's length as a VexFlow duration ('qd', '8r', …). */
export function durationToVexFlow(beat: Beat): string {
  let dots = beat.dotted ? 'd' : beat.doubleDotted ? 'dd' : ''
  // a tuplet of one dotted note is written at the plain length
  if (
    beat.dotted &&
    beat.tuplet != null &&
    tupletState.groups[beat.tupletId].originalDuration[0] === beat.duration[0]
  ) {
    dots = ''
  }
  const isRest = beat.duration.endsWith('r')
  const value = VEXFLOW_DURATIONS[beat.duration.charAt(0)]
  if (value == null) return '8'
  return `${value}${dots}${isRest ? 'r' : ''}`
}

/** Treble for guitars, bass for four- and five-string basses, percussion for drums. */
export function clefOf(trackId: number): string {
  if (Song.playBackInstrument[trackId]?.instrument === 'drums') return 'percussion'
  return Song.tracks[trackId].numStrings > 5 ? 'treble' : 'bass'
}

/**
 * Everything the conversion reads for one bar, as a string (so unchanged bars keep their
 * notes). Null when the data cannot be serialised; then the bar is always converted.
 */
export function blockFingerprint(trackId: number, blockId: number, voiceId: number): string | null {
  try {
    const meta = Song.measureMeta[blockId]
    const beats = toRaw(Song.measures[trackId][blockId][voiceId])
    const tuplets = beats.map((beat) =>
      beat.tuplet != null ? tupletState.groups[beat.tupletId]?.originalDuration : null,
    )
    return JSON.stringify([meta?.numerator, meta?.denominator, beats, tuplets])
  } catch {
    return null
  }
}

/** How far notes reach beyond the staff lines, from key lines and stem directions. */
export function staffExtents(voices: Vex.Flow.StaveNote[][]): ClassicalStaffExtents {
  let top = 0
  let bottom = CLASSICAL_STAFF_LINES_HEIGHT
  for (const notes of voices) {
    for (const note of notes ?? []) {
      if (note.isRest()) continue
      const ys = note.getKeyProps().map((props) => (5 - props.line) * STAFF_LINE_SPACING)
      if (ys.length === 0) continue
      let noteTop = Math.min(...ys) - NOTE_HEAD_EXTENT
      let noteBottom = Math.max(...ys) + NOTE_HEAD_EXTENT
      if (note.hasStem()) {
        if (note.getStemDirection() > 0) noteTop = Math.min(noteTop, Math.min(...ys) - STEM_EXTENT)
        else noteBottom = Math.max(noteBottom, Math.max(...ys) + STEM_EXTENT)
      }
      top = Math.min(top, noteTop)
      bottom = Math.max(bottom, noteBottom)
    }
  }
  return { above: Math.max(0, -top), below: Math.max(0, bottom - CLASSICAL_STAFF_LINES_HEIGHT) }
}

/** Drawn width of a formatted note incl. modifiers, plus some room between notes. */
export function noteWidth(note: Vex.Flow.StaveNote): number {
  const metrics = note.getMetrics() as {
    width?: number
    notePx?: number
    noteWidth?: number
    extraRightPx?: number
    extraLeftPx?: number
    modRightPx?: number
    modLeftPx?: number
    leftDisplacedHeadPx?: number
    rightDisplacedHeadPx?: number
  }
  const alignment = 10
  const total =
    metrics.width ??
    (metrics.notePx ?? metrics.noteWidth ?? 0) +
      (metrics.modRightPx ?? 0) +
      (metrics.modLeftPx ?? 0) +
      (metrics.rightDisplacedHeadPx ?? metrics.extraRightPx ?? 0) +
      (metrics.leftDisplacedHeadPx ?? metrics.extraLeftPx ?? 0)
  const width = (Number.isFinite(total) ? total : 0) + alignment
  return width > 0 ? width : alignment
}

/** The widest note of a bar once VexFlow has formatted it (tab beats are spaced to fit it). */
export function largestBeatWidth(blockId: number, notes: Vex.Flow.StaveNote[]): number {
  if (!Array.isArray(notes) || notes.length === 0) return 0
  const voice = new Vex.Flow.Voice({
    num_beats: Song.measureMeta[blockId].numerator,
    beat_value: Song.measureMeta[blockId].denominator,
  })
  voice.setStrict(false)
  voice.addTickables(notes)
  new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 0)
  const widest = Math.max(0, ...notes.map(noteWidth))
  return Number.isFinite(widest) ? widest : 0
}
