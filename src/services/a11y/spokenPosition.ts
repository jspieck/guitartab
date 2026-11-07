/** What a screen reader says about the cursor: the note under it, beyond its position. */
export interface SpokenCursorNote {
  fret?: number | null
  dead?: boolean
  tied?: boolean
  /** The beat is a rest (no note on any string). */
  rest?: boolean
}

/**
 * "Bar 3, beat 2, string 5, fret 7" for the live region (same counting as
 * `formatCursorPosition` (utils/positionLabel.ts)); voice 2 and dead, tied or rest beats are named.
 */
export function speakCursorPosition(
  position: { blockId: number; beatId: number; string: number; voiceId?: number },
  numStrings: number,
  note: SpokenCursorNote = {},
): string {
  const parts = [
    `Bar ${position.blockId + 1}`,
    `beat ${position.beatId + 1}`,
    `string ${numStrings - position.string}`,
  ]
  if (note.dead === true) parts.push('dead note')
  else if (note.fret != null && note.fret >= 0)
    parts.push(`fret ${note.fret}${note.tied === true ? ', tied' : ''}`)
  else if (note.rest === true) parts.push('rest')
  if (position.voiceId === 1) parts.push('voice 2')
  return parts.join(', ')
}
