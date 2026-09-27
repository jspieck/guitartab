import type { Chord } from '../../types/tab'
import { TAB_SHEET } from '../../utils/tabSheetConstants'

export const CHORD_THUMB_HOSTEPS = 5
export const CHORD_THUMB_STRINGS = 6

export type ChordThumbMarker =
  | { kind: 'cross'; x: number }
  | { kind: 'open'; x: number }
  | { kind: 'finger'; x: number; y: number; finger?: number }

export function getChordThumbnailSize() {
  return {
    width: TAB_SHEET.DIA_WIDTH,
    height: TAB_SHEET.DIA_HEIGHT,
  }
}

/** Pure geometry for Chord Manager Vue thumbnails (parity with createChordDiagramSvg). */
export function buildChordThumbnailMarkers(chord: Chord): ChordThumbMarker[] {
  const { width, height } = getChordThumbnailSize()
  const { frets, capo, fingers } = chord
  const result: ChordThumbMarker[] = []

  for (let i = 0; i < CHORD_THUMB_STRINGS; i += 1) {
    const xPos = (i * width) / (CHORD_THUMB_STRINGS - 1)
    const fretVal = frets[5 - i]
    if (fretVal === -1 || fretVal === undefined) {
      result.push({ kind: 'cross', x: xPos })
    } else if (fretVal - (capo - 1) !== 0) {
      const fret = capo > 1 ? fretVal - capo + 1 : fretVal - capo
      const yPos = height / (2 * CHORD_THUMB_HOSTEPS)
        + (height / CHORD_THUMB_HOSTEPS) * (fret - 1)
      result.push({
        kind: 'finger',
        x: xPos,
        y: yPos,
        finger: fingers?.[5 - i] ?? undefined,
      })
    } else {
      result.push({ kind: 'open', x: xPos })
    }
  }

  return result
}
