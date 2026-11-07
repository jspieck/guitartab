/**
 * Chord names ("F#m7/C#") and MusicXML's `<harmony>`: root, kind and bass. MusicXML names
 * the chord quality with a `<kind>` value; its `text` attribute is how the name is printed,
 * which is what the app stores.
 */

/** MusicXML `<kind>` values and the suffix the app writes for them. */
export const CHORD_KIND_SUFFIXES: Record<string, string> = {
  major: '',
  minor: 'm',
  augmented: 'aug',
  diminished: 'dim',
  dominant: '7',
  'major-seventh': 'maj7',
  'minor-seventh': 'm7',
  'diminished-seventh': 'dim7',
  'augmented-seventh': 'aug7',
  'half-diminished': 'm7b5',
  'major-minor': 'm(maj7)',
  'major-sixth': '6',
  'minor-sixth': 'm6',
  'dominant-ninth': '9',
  'major-ninth': 'maj9',
  'minor-ninth': 'm9',
  'dominant-11th': '11',
  'dominant-13th': '13',
  'suspended-second': 'sus2',
  'suspended-fourth': 'sus4',
  power: '5',
}

export interface ChordSymbol {
  root: string
  /** semitones: 1 = sharp, -1 = flat */
  rootAlter: number
  /** what follows the root, as printed ("m7", "sus4") */
  suffix: string
  bass: { step: string; alter: number } | null
}

const alterOf = (accidentals: string) => [...accidentals].reduce((sum, c) => sum + (c === '#' ? 1 : -1), 0)
const accidentalOf = (alter: number) => (alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter))

/** Splits a chord name; null when it doesn't start with a note letter (a free text, "N.C."). */
export function parseChordName(name: string): ChordSymbol | null {
  const match = /^([A-G])([#b]*)(.*?)(?:\/([A-G])([#b]*))?$/.exec(name.trim())
  if (match == null) return null
  return {
    root: match[1],
    rootAlter: alterOf(match[2]),
    suffix: match[3],
    bass: match[4] != null ? { step: match[4], alter: alterOf(match[5] ?? '') } : null,
  }
}

export function chordNameOf(symbol: ChordSymbol): string {
  const bass = symbol.bass ? `/${symbol.bass.step}${accidentalOf(symbol.bass.alter)}` : ''
  return `${symbol.root}${accidentalOf(symbol.rootAlter)}${symbol.suffix}${bass}`
}

/** The MusicXML `<kind>` for a suffix ("other" when it has no kind of its own). */
export function chordKindOf(suffix: string): string {
  return Object.entries(CHORD_KIND_SUFFIXES).find(([, value]) => value === suffix)?.[0] ?? 'other'
}
