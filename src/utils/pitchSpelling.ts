/**
 * Writing pitches in a key: which letter and accidental a MIDI pitch gets, and which
 * accidentals a bar has to show (an accidental lasts to the end of the bar on its line).
 */

const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'] as const
type Letter = (typeof LETTERS)[number]
const LETTER_PC: Record<Letter, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const SHARP_ORDER: Letter[] = ['f', 'c', 'g', 'd', 'a', 'e', 'b']
const FLAT_ORDER: Letter[] = ['b', 'e', 'a', 'd', 'g', 'c', 'f']

export interface SpelledPitch {
  letter: Letter
  /** −2…2: double flat … double sharp */
  alter: number
  /** written octave of the letter (C4 = middle C; B♯3 sounds as C4) */
  octave: number
}

/** The alteration the key gives a letter: 1 for F in G major, −1 for B in F major. */
export function keyAlter(letter: Letter, fifths: number): number {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0
  return 0
}

/**
 * A MIDI pitch spelled in a key: a note of the key's scale keeps the key's spelling (F♯ in
 * D major, E♯ in C♯ major); other notes are sharpened in sharp keys and C, flattened in flat keys.
 */
export function spellPitch(height: number, fifths: number): SpelledPitch {
  const pc = ((height % 12) + 12) % 12
  const inKey = LETTERS.find((letter) => (LETTER_PC[letter] + keyAlter(letter, fifths) + 12) % 12 === pc)
  let letter: Letter
  let alter: number
  if (inKey != null) {
    letter = inKey
    alter = keyAlter(inKey, fifths)
  } else {
    const natural = LETTERS.find((l) => LETTER_PC[l] === pc)
    if (natural != null) {
      letter = natural
      alter = 0
    } else if (fifths < 0) {
      letter = LETTERS.find((l) => LETTER_PC[l] === (pc + 1) % 12)!
      alter = -1
    } else {
      letter = LETTERS.find((l) => LETTER_PC[l] === (pc + 11) % 12)!
      alter = 1
    }
  }
  const octave = Math.round((height - alter - LETTER_PC[letter]) / 12) - 1
  return { letter, alter, octave }
}

const ACCIDENTAL_SIGNS: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: 'n', 1: '#', 2: '##' }

/**
 * The accidentals one bar shows. Feed the bar's pitches in order; each answer is the sign to
 * draw ('#', 'b', 'n', …) or null when the key or an earlier accidental already says it.
 */
export class BarAccidentals {
  private readonly current = new Map<string, number>()

  constructor(private readonly fifths: number) {}

  /** `tied`: continues a note, so it shows no sign but still counts for later notes. */
  sign(pitch: SpelledPitch, tied = false): string | null {
    const line = `${pitch.letter}${pitch.octave}`
    const before = this.current.get(line) ?? keyAlter(pitch.letter, this.fifths)
    this.current.set(line, pitch.alter)
    if (tied || before === pitch.alter) return null
    return ACCIDENTAL_SIGNS[pitch.alter] ?? null
  }
}

/** A spelled pitch as a VexFlow key ('f#/4', 'bb/3'). */
export function vexFlowKeyOf(pitch: SpelledPitch): string {
  const signs: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }
  return `${pitch.letter}${signs[pitch.alter]}/${pitch.octave}`
}

/** How many accidentals a key signature drawn here has, incl. naturals cancelling the old key. */
export function keySignatureGlyphs(fifths: number, previousFifths: number | null): number {
  const drawn = Math.abs(fifths)
  if (previousFifths == null || previousFifths === fifths) return drawn
  const sameSide = Math.sign(previousFifths) === Math.sign(fifths)
  const cancelled = sameSide ? Math.max(0, Math.abs(previousFifths) - drawn) : Math.abs(previousFifths)
  return drawn + cancelled
}
