import type { Beat } from '../types/song'
import Duration from './duration'

/**
 * The notes of the voice that isn't being edited, placed in the edited voice's bar layout by
 * time (the two voices have different beats, so there is no shared beat position). They are
 * drawn faintly behind the edited voice, so both voices stay visible.
 */

export interface OtherVoiceNote {
  /** Centre x, bar-local. */
  x: number
  string: number
  text: string
  /** The note's beat in the other voice (a click on it edits that voice there). */
  beatIndex: number
}

export interface BeatBox {
  left: number
  width: number
  /** Where the edited beat's notes sit (`beatNoteOffset`), bar-local. */
  noteX: number
}

const ticksOf = (beat: Beat) => Duration.getDurationOfNote(beat, false)

/**
 * Bar-local centre x of a note starting `ticks` into the bar and lasting `length`: in the part
 * of the edited voice's beat it starts in, as far in as a beat there would sit (so it lines up
 * with a beat starting there).
 */
function xAtTime(beats: readonly Beat[], boxes: readonly BeatBox[], ticks: number, length: number): number {
  let start = 0
  for (let i = 0; i < beats.length; i += 1) {
    const span = ticksOf(beats[i])
    if (ticks < start + span || i === beats.length - 1) {
      const box = boxes[i]
      if (span <= 0) return box.noteX
      const from = Math.min(1, Math.max(0, (ticks - start) / span))
      const to = Math.min(1, Math.max(from, (ticks + length - start) / span))
      return box.left + box.width * from + Math.min((box.width * (to - from)) / 2, box.noteX - box.left)
    }
    start += span
  }
  return 0
}

/** Bar-local centre x of every beat of the other voice (classical notation draws them all). */
export function otherVoiceBeatXs(
  edited: readonly Beat[],
  boxes: readonly BeatBox[],
  other: readonly Beat[],
): number[] {
  if (edited.length === 0) return other.map(() => 0)
  let ticks = 0
  return other.map((beat) => {
    const length = ticksOf(beat)
    const x = xAtTime(edited, boxes, ticks, length)
    ticks += length
    return x
  })
}

export function otherVoiceNotes(
  edited: readonly Beat[],
  boxes: readonly BeatBox[],
  other: readonly Beat[] | undefined,
): OtherVoiceNote[] {
  if (other == null || edited.length === 0 || other.some((beat) => beat.empty)) return []
  // Where the edited voice already shows a note, the faint one would only blur it.
  const taken = new Set<string>()
  edited.forEach((beat, i) => {
    const x = Math.round(boxes[i].noteX)
    beat.notes?.forEach((note, string) => note != null && taken.add(`${string}:${x}`))
  })
  const out: OtherVoiceNote[] = []
  let ticks = 0
  other.forEach((beat, beatIndex) => {
    const length = ticksOf(beat)
    const x = xAtTime(edited, boxes, ticks, length)
    beat.notes?.forEach((note, string) => {
      // A tied note continues the one before; the tab shows only where a note starts.
      if (note == null || note.tied || taken.has(`${string}:${Math.round(x)}`)) return
      out.push({ x, string, text: note.dead ? 'x' : String(note.fret), beatIndex })
    })
    ticks += length
  })
  return out
}

/** How far from a faint note's centre a click still takes it (about half a two-digit fret). */
const FAINT_NOTE_HIT = 9

/** The faint note on `string` nearest to bar-local `x`, if a click there takes it. */
export function otherVoiceNoteAt(
  notes: readonly OtherVoiceNote[],
  x: number,
  string: number,
): OtherVoiceNote | null {
  let best: OtherVoiceNote | null = null
  for (const note of notes) {
    if (note.string !== string || Math.abs(note.x - x) > FAINT_NOTE_HIT) continue
    if (best == null || Math.abs(note.x - x) < Math.abs(best.x - x)) best = note
  }
  return best
}

/**
 * The beat of `to` sounding when beat `beatId` of `from` starts (two voices or tracks of one bar):
 * the cursor keeps its time when it changes voice or track.
 */
export function beatAtSameTime(from: readonly Beat[], beatId: number, to: readonly Beat[]): number {
  let ticks = 0
  for (let index = 0; index < beatId && index < from.length; index += 1) ticks += ticksOf(from[index])
  let start = 0
  for (let index = 0; index < to.length; index += 1) {
    start += ticksOf(to[index])
    if (ticks < start) return index
  }
  return Math.max(0, to.length - 1)
}

/** Whether a voice plays anything in a bar (an unused voice is rests only). */
export function voicePlays(beats: readonly Beat[] | undefined): boolean {
  return (beats ?? []).some(
    (beat) => !beat.empty && (beat.slash === true || beat.notes?.some((note) => note != null)),
  )
}

/**
 * Rhythm on stems: the first voice's stems go up in bars where the second voice plays (whose
 * stems stay down), as on a two-voice staff.
 */
export function tabStemsGoUp(
  onStems: boolean,
  voiceId: number,
  otherVoice: readonly Beat[] | undefined,
): boolean {
  return onStems && voiceId === 0 && voicePlays(otherVoice)
}
