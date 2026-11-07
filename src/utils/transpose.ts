import type { Note } from '../types/song'

/**
 * Transposing notes on a fretted instrument. A note's pitch is `tuning[string] + fret`
 * (frets count from the capo, which moves every string alike, so it drops out). Transposing
 * keeps a note on its string while the new fret fits; otherwise the beat's notes are spread
 * over the strings again, close to the old frets so the hand stays where it was.
 */

export interface PlacedFret {
  /** String the note was on. */
  from: number
  /** String it goes to. */
  string: number
  fret: number
}

// Changing string costs as much as moving this many frets: keep notes on their string.
const STRING_CHANGE_COST = 3

/**
 * Where the notes of one beat go when transposed by `semitones`. `notes` maps string → fret;
 * `fixed` pins a string's note to a string (a tie must stay on the string it started on).
 * Null when no assignment keeps every note between fret 0 and `maxFret`.
 */
export function placeTransposedBeat(
  notes: ReadonlyArray<{ string: number; fret: number }>,
  tuning: readonly number[],
  semitones: number,
  maxFret: number,
  fixed: ReadonlyMap<number, number> = new Map(),
): PlacedFret[] | null {
  const options = notes.map(({ string, fret }) => {
    const pitch = tuning[string] + fret + semitones
    const pinned = fixed.get(string)
    return tuning
      .map((open, target) => ({ from: string, string: target, fret: pitch - open }))
      .filter((option) => option.fret >= 0 && option.fret <= maxFret)
      .filter((option) => pinned == null || option.string === pinned)
      .map((option) => ({
        option,
        cost:
          Math.abs(option.fret - (fret + (option.string === string ? semitones : 0))) +
          (option.string === string ? 0 : STRING_CHANGE_COST),
      }))
      .sort((a, b) => a.cost - b.cost)
  })

  let best: { cost: number; placed: PlacedFret[] } | null = null
  const used = new Set<number>()
  const placed: PlacedFret[] = []
  const search = (index: number, cost: number) => {
    if (best != null && cost >= best.cost) return
    if (index === options.length) {
      best = { cost, placed: [...placed] }
      return
    }
    for (const { option, cost: step } of options[index]) {
      if (used.has(option.string)) continue
      used.add(option.string)
      placed.push(option)
      search(index + 1, cost + step)
      placed.pop()
      used.delete(option.string)
    }
  }
  search(0, 0)
  return (best as { placed: PlacedFret[] } | null)?.placed ?? null
}

/**
 * Moves a beat's notes to their new strings and frets (in place). A grace note or trill
 * partner keeps its interval to the note.
 */
export function applyPlacement(notes: (Note | null)[], placement: readonly PlacedFret[]): void {
  const moved = placement.map(({ from, string, fret }) => {
    const note = notes[from]!
    const shift = fret - note.fret
    if (note.graceObj) note.graceObj.fret = Math.max(0, note.graceObj.fret + shift)
    if (note.trill) note.trill.fret = Math.max(0, note.trill.fret + shift)
    note.fret = fret
    return { note, string }
  })
  for (const { from } of placement) notes[from] = null
  for (const { note, string } of moved) {
    note.string = string
    notes[string] = note
  }
}
