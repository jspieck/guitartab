import type { MeasureMetaInfo } from '../types/song'

type KeyFields = Pick<MeasureMetaInfo, 'keySignature' | 'keyMinor'>

/** The bar's key in fifths (−7…7), 0 when unset. */
export function keyFifths(meta: KeyFields | undefined): number {
  const key = meta?.keySignature
  return typeof key === 'number' && Number.isFinite(key) ? Math.max(-7, Math.min(7, Math.round(key))) : 0
}

/** True when `meta` starts a different key than `previous` (always for the first bar). */
export function keyChanges(meta: KeyFields, previous: KeyFields | undefined): boolean {
  if (previous == null) return true
  return keyFifths(meta) !== keyFifths(previous) || Boolean(meta.keyMinor) !== Boolean(previous.keyMinor)
}

const MAJOR = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯']
const MINOR = [
  'A♭m',
  'E♭m',
  'B♭m',
  'Fm',
  'Cm',
  'Gm',
  'Dm',
  'Am',
  'Em',
  'Bm',
  'F♯m',
  'C♯m',
  'G♯m',
  'D♯m',
  'A♯m',
]

/** "E♭", "F♯m": the key's name. */
export function keyName(meta: KeyFields): string {
  return (meta.keyMinor ? MINOR : MAJOR)[keyFifths(meta) + 7]
}

/** VexFlow's key spec for a major key with the same signature ("Eb", "F#"); VexFlow draws minor keys by their relative major. */
export function vexFlowKey(meta: KeyFields): string {
  return MAJOR[keyFifths(meta) + 7].replace('♭', 'b').replace('♯', '#')
}
