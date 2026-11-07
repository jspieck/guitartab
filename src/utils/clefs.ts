import type { Track } from '../types/song'

/**
 * Clefs of the classical staff. A track's clef comes from its instrument (treble for guitars,
 * bass for four- and five-string basses, percussion for drums) unless `track.clefs` changes
 * it: bar index → the clef from that bar on. Pitches are written an octave above they sound
 * in every clef (guitar and bass are transposing instruments), so a clef only moves notes on
 * the staff; "treble 8vb" is the guitar's usual clef with the 8 drawn.
 */
export type Clef = 'treble' | 'treble8vb' | 'bass' | 'alto' | 'tenor'

/** The clef a staff draws, including the automatic percussion clef. */
export type StaffClef = Clef | 'percussion'

export const CLEFS: Array<{ clef: Clef; label: string }> = [
  { clef: 'treble', label: 'Treble' },
  { clef: 'treble8vb', label: 'Treble 8vb (guitar)' },
  { clef: 'bass', label: 'Bass' },
  { clef: 'alto', label: 'Alto' },
  { clef: 'tenor', label: 'Tenor' },
]

const CLEF_NAMES = new Set<string>(CLEFS.map(({ clef }) => clef))

export function isClef(value: unknown): value is Clef {
  return typeof value === 'string' && CLEF_NAMES.has(value)
}

/** The instrument's clef, used where no clef change applies. */
export function defaultClef(track: Pick<Track, 'numStrings'>, isDrums: boolean): StaffClef {
  if (isDrums) return 'percussion'
  return track.numStrings > 5 ? 'treble' : 'bass'
}

/** The clef in effect in bar `blockId`: the last change at or before it, else the default. */
export function clefAt(
  track: Pick<Track, 'numStrings' | 'clefs'>,
  blockId: number,
  isDrums: boolean,
): StaffClef {
  if (isDrums) return 'percussion'
  const changes = track.clefs
  if (changes != null) {
    for (let bar = blockId; bar >= 0; bar -= 1) {
      const clef = changes[bar]
      if (isClef(clef)) return clef
    }
  }
  return defaultClef(track, false)
}

/** True when bar `blockId` draws a clef because it differs from the bar before. */
export function clefChangesAt(
  track: Pick<Track, 'numStrings' | 'clefs'>,
  blockId: number,
  isDrums: boolean,
): boolean {
  return blockId > 0 && clefAt(track, blockId, isDrums) !== clefAt(track, blockId - 1, isDrums)
}

/** VexFlow's clef name and annotation. */
export function vexFlowClef(clef: StaffClef): { name: string; annotation?: string } {
  return clef === 'treble8vb' ? { name: 'treble', annotation: '8vb' } : { name: clef }
}

/** Sets the clef from `blockId` on (null = back to the clef before it), dropping redundant entries. */
export function setClefFrom(
  track: Pick<Track, 'numStrings' | 'clefs'>,
  blockId: number,
  clef: Clef | null,
): void {
  const changes: Record<number, Clef> = { ...(track.clefs ?? {}) }
  delete changes[blockId]
  if (clef != null) changes[blockId] = clef
  // keep only real changes: an entry equal to the clef before it says nothing
  const bars = Object.keys(changes)
    .map(Number)
    .sort((a, b) => a - b)
  let previous = defaultClef(track, false)
  for (const bar of bars) {
    if (changes[bar] === previous) delete changes[bar]
    else previous = changes[bar]
  }
  if (Object.keys(changes).length === 0) delete track.clefs
  else track.clefs = changes
}

/** Moves clef changes at or after bar `from` by `delta` bars (bars inserted or removed). */
export function shiftClefs(track: Pick<Track, 'clefs'>, from: number, delta: number): void {
  if (track.clefs == null) return
  const shifted: Record<number, Clef> = {}
  for (const [key, clef] of Object.entries(track.clefs)) {
    const bar = Number(key)
    if (bar < from) shifted[bar] = shifted[bar] ?? clef
    else if (bar + delta >= 0) shifted[bar + delta] = clef
  }
  track.clefs = shifted
}
