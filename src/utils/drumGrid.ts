import type { Beat, Note } from '../types/song'
import type { NoteLengthCode } from '../types/tab'
import Duration from './duration'

/**
 * The drum step grid: one bar of a drum track as cells (rows = the track's drums, columns =
 * steps of an eighth, sixteenth or thirty-second). Reading puts each hit in the step it
 * starts on; writing turns the cells back into beats: a beat at every step with a hit,
 * lasting to the next one, rests before the first.
 */

/** Grid step lengths in ticks (whole = 64). */
export const GRID_STEPS = { e: 8, s: 4, t: 2 } as const satisfies Partial<Record<NoteLengthCode, number>>
export type GridStep = keyof typeof GRID_STEPS

const TOLERANCE = 1e-6

export interface DrumGrid {
  /** Number of steps (columns). */
  steps: number
  /** Hit drums per step: `hits[step]` holds MIDI notes. */
  hits: Set<number>[]
  /** Some hits did not start on a step (triplets, shorter notes): writing moves them onto the grid. */
  offGrid: boolean
}

function ticksOf(beat: Beat): number {
  return Duration.getDurationOfNote(beat, false)
}

/** The steps of a bar of `barTicks` and the hits of its beats in them. */
export function readDrumGrid(beats: readonly Beat[], barTicks: number, stepTicks: number): DrumGrid {
  const steps = Math.max(1, Math.round(barTicks / stepTicks))
  const hits = Array.from({ length: steps }, () => new Set<number>())
  let offGrid = false
  let ticks = 0
  for (const beat of beats) {
    const notes = (beat.notes ?? []).filter((note): note is Note => note != null && !note.tied)
    if (notes.length > 0) {
      const exact = ticks / stepTicks
      const step = Math.round(exact)
      if (Math.abs(step - exact) > TOLERANCE) offGrid = true
      for (const note of notes) hits[Math.min(steps - 1, step)].add(note.fret)
    }
    ticks += ticksOf(beat)
  }
  return { steps, hits, offGrid }
}

/** Note values (ticks) a gap is written with, longest first: plain and dotted, down to a 32nd. */
const VALUES: { ticks: number; duration: NoteLengthCode; dotted: boolean }[] = [
  { ticks: 64, duration: 'w', dotted: false },
  { ticks: 48, duration: 'h', dotted: true },
  { ticks: 32, duration: 'h', dotted: false },
  { ticks: 24, duration: 'q', dotted: true },
  { ticks: 16, duration: 'q', dotted: false },
  { ticks: 12, duration: 'e', dotted: true },
  { ticks: 8, duration: 'e', dotted: false },
  { ticks: 6, duration: 's', dotted: true },
  { ticks: 4, duration: 's', dotted: false },
  { ticks: 3, duration: 't', dotted: true },
  { ticks: 2, duration: 't', dotted: false },
]

/** A length in ticks as note values, longest first. */
export function splitIntoNoteValues(ticks: number): { duration: NoteLengthCode; dotted: boolean }[] {
  const parts: { duration: NoteLengthCode; dotted: boolean }[] = []
  let left = ticks
  while (left > TOLERANCE) {
    const value = VALUES.find((candidate) => candidate.ticks <= left + TOLERANCE)
    if (value == null) break
    parts.push({ duration: value.duration, dotted: value.dotted })
    left -= value.ticks
  }
  return parts
}

export interface GridBeatFactory {
  beat(): Beat
  note(): Note
}

/**
 * The beats of a bar for a grid. A hit that was already there keeps its note (accents,
 * ghost notes), and a beat starting where one started before keeps its beat-level data
 * (text, chord, lyrics, effects). `lineOf` places a drum on its line.
 */
export function writeDrumGrid(
  previous: readonly Beat[],
  hits: readonly Set<number>[],
  stepTicks: number,
  lineOf: (midi: number) => number,
  make: GridBeatFactory,
): Beat[] {
  const before = new Map<number, Beat>()
  let ticks = 0
  for (const beat of previous) {
    if (!before.has(Math.round(ticks * 1000))) before.set(Math.round(ticks * 1000), beat)
    ticks += ticksOf(beat)
  }

  const starts = hits.flatMap((drums, step) => (drums.size > 0 ? [step] : []))
  const beats: Beat[] = []
  const add = (atTicks: number, length: number, drums: Set<number> | null) => {
    splitIntoNoteValues(length).forEach((value, index) => {
      const old = index === 0 ? before.get(Math.round(atTicks * 1000)) : undefined
      const beat: Beat = old != null ? { ...old, effects: { ...old.effects } } : make.beat()
      beat.dotted = value.dotted
      beat.doubleDotted = false
      beat.tuplet = null
      beat.empty = false
      const sounding = index === 0 && drums != null && drums.size > 0
      beat.duration = sounding ? value.duration : `${value.duration}r`
      beat.notes = sounding ? notesFor(drums, old, lineOf, make) : []
      beats.push(beat)
    })
  }
  const firstStart = starts[0] ?? hits.length
  if (firstStart > 0) add(0, firstStart * stepTicks, null)
  starts.forEach((step, i) => {
    const end = starts[i + 1] ?? hits.length
    add(step * stepTicks, (end - step) * stepTicks, hits[step])
  })
  return beats
}

function notesFor(
  drums: Set<number>,
  old: Beat | undefined,
  lineOf: (midi: number) => number,
  make: GridBeatFactory,
): (Note | null)[] {
  const notes: (Note | null)[] = []
  for (const midi of drums) {
    const line = lineOf(midi)
    if (line < 0) continue
    const kept = (old?.notes ?? []).find((note) => note != null && note.fret === midi && !note.tied)
    notes[line] = kept != null ? { ...kept, string: line } : { ...make.note(), fret: midi, string: line }
  }
  for (let line = 0; line < notes.length; line += 1) notes[line] ??= null
  return notes
}
