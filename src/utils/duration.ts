import type { NoteLengthCode } from '../types/tab'

/** The duration fields of a beat. */
export interface TimedBeat {
  duration: string
  dotted?: boolean
  doubleDotted?: boolean
  tuplet?: number | null
}

/**
 * Note lengths in ticks: a whole note is 64, a 128th (grace notes only) 0.5.
 * `Duration.getDurationOfNote` is what playback, layout and the importers count with.
 */
const Duration = {
  /** Tuplets: 3 for 2, 5/6/7 for 4, 9–15 for 8; 0 for anything else. */
  tupletToNumOfSubstitutedNotes(i: number): number {
    const subNotes = [0, 0, 0, 2, 0, 4, 4, 4, 0, 8, 8, 8, 8, 8, 8, 8, 0]
    return subNotes[i] ?? 0
  },

  getDurationOfNote(beat: TimedBeat, ignoreTuplet: boolean): number {
    let size = Duration.getDurationOfType(beat.duration)
    if (beat.dotted) size += size / 2
    if (beat.doubleDotted) size += size / 2 + size / 4
    if (beat.tuplet != null && beat.tuplet !== 0 && !ignoreTuplet) {
      const numSubs = Duration.tupletToNumOfSubstitutedNotes(beat.tuplet)
      if (numSubs === 0) {
        console.warn('Unknown tuplet', beat.tuplet)
        return (size * 2) / beat.tuplet
      }
      size *= numSubs / beat.tuplet
    }
    return size
  },

  /** Relative width of a beat in the tab (a quarter is 2); tuplets keep the plain width. */
  getDurationWidth(beat: TimedBeat | null | undefined): number {
    if (!beat || !beat.duration) {
      console.warn('Invalid beat in getDurationWidth:', beat)
      return 1
    }
    let size = WIDTHS[beat.duration.replace(/r$/, '')]
    if (size == null) {
      console.warn('Unknown duration type:', beat.duration)
      return 1
    }
    if ((beat.dotted || beat.doubleDotted) && size >= 2) size += size / 2
    if (beat.doubleDotted && size >= 4) size += size / 4
    return size
  },

  getDurationOfType(type: string): number {
    return TICKS[type.replace(/r$/, '')] ?? 0
  },

  typeToString(ticks: number): NoteLengthCode {
    const entry = Object.entries(TICKS).find(([, value]) => value === ticks)
    // Not a plain note value; callers only pass powers of two.
    return (entry?.[0] ?? '') as NoteLengthCode
  },

  /** The longest plain note value (in ticks, at most a whole) that fits into `ticks`. */
  greatestNoteValueIn(ticks: number): number {
    return 2 ** Math.min(6, Math.floor(Math.log2(ticks)))
  },

  /** Length of a bar in ticks. */
  getDurationOfBar(meta: { numerator: number; denominator: number }): number {
    return TICKS.w * (meta.numerator / meta.denominator)
  },
}

const TICKS: Record<string, number> = { w: 64, h: 32, q: 16, e: 8, s: 4, t: 2, z: 1, o: 0.5 }
const WIDTHS: Record<string, number> = { w: 8, h: 4, q: 2, e: 1, s: 1, t: 1, z: 1, o: 0.5 }

export default Duration
