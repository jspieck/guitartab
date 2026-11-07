/**
 * "Bar 3 · Beat 2 · String 1 · fret 3" for a cursor position (all counted from 1). String 1
 * is the highest string, as on the tab and in the tuning dialog; data string 0 is the lowest.
 */
export function formatCursorPosition(
  position: { blockId: number; beatId: number; string: number },
  numStrings: number,
  fret?: number | null,
): string {
  const parts = [
    `Bar ${position.blockId + 1}`,
    `Beat ${position.beatId + 1}`,
    `String ${numStrings - position.string}`,
  ]
  if (fret != null && fret >= 0) parts.push(`fret ${fret}`)
  return parts.join(' · ')
}
