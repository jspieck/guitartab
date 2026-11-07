/**
 * Geometry of the on-screen fretboard (`components/Fretboard.vue`): which neck positions
 * it shows and how a column maps to a tab fret. "Neck fret" counts from the nut, capo
 * included (like `SoundingNote.fret`); "tab fret" counts from the capo (like the song data).
 */

/** Frets shown after the open column. */
export const FRETBOARD_FRETS = 24

const SINGLE_INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21])
const DOUBLE_INLAYS = new Set([12, 24])

/** A dot on the board: a sounding note, or a note of the beat at the cursor. */
export interface FretboardMark {
  /** Data string (0 = lowest). */
  string: number
  neckFret: number
  /** The note at the cursor (drawn in the accent colour). */
  current?: boolean
}

export interface FretboardColumn {
  /** Position on the neck, counted from the nut. */
  neckFret: number
  /** The fret this column enters in the tab; negative below the capo. */
  tabFret: number
  /** Inlay dots in this column: 0, 1 or 2. */
  inlays: number
}

/** Inlay dots a neck fret carries (12 and 24 have two). */
export function inlayCount(neckFret: number): number {
  if (DOUBLE_INLAYS.has(neckFret)) return 2
  return SINGLE_INLAYS.has(neckFret) ? 1 : 0
}

/** The neck fret drawn in column 0: the capo when counting from it, else the nut. */
export function firstNeckFret(capo: number, fromCapo: boolean): number {
  return fromCapo ? Math.max(0, capo) : 0
}

/**
 * Columns 0…frets. Counted from the capo, column 0 is the capo itself and the columns are
 * tab frets 0…frets; otherwise they are the neck from the nut and the capo sits inside it.
 */
export function fretboardColumns(
  capo: number,
  fromCapo: boolean,
  frets = FRETBOARD_FRETS,
): FretboardColumn[] {
  const first = firstNeckFret(capo, fromCapo)
  return Array.from({ length: frets + 1 }, (_, column) => {
    const neckFret = first + column
    return { neckFret, tabFret: neckFret - Math.max(0, capo), inlays: inlayCount(neckFret) }
  })
}

/** Column of a neck fret, or -1 when it is off the board. */
export function columnOfNeckFret(
  neckFret: number,
  capo: number,
  fromCapo: boolean,
  frets = FRETBOARD_FRETS,
): number {
  const column = neckFret - firstNeckFret(capo, fromCapo)
  return column >= 0 && column <= frets ? column : -1
}
