/**
 * Builds small Guitar Pro 3 / 4 files byte by byte, laid out the way the
 * importers read them (there are no GP3/GP4 sample files in the repo). The
 * song: one 6-string track, two bars, with a time signature, repeat, marker,
 * chord, text, stroke, bend, grace note, slide, palm mute and harmonic (GP4),
 * tie, triplets, a dynamic, a key change, rests and a tempo change, so most branches of the readers are used.
 */
class Bytes {
  readonly data: number[] = []

  byte(value: number): this {
    this.data.push(value & 0xff)
    return this
  }

  int(value: number): this {
    for (let i = 0; i < 4; i += 1) this.byte((value >> (8 * i)) & 0xff)
    return this
  }

  raw(text: string): this {
    for (const char of text) this.byte(char.charCodeAt(0))
    return this
  }

  /** Length byte, then the text padded to `size`. */
  fixedString(text: string, size: number): this {
    this.byte(text.length).raw(text)
    for (let i = text.length; i < size; i += 1) this.byte(0)
    return this
  }

  /** int (length + 1), byte (length), text. */
  sizedString(text: string): this {
    return this.int(text.length + 1)
      .byte(text.length)
      .raw(text)
  }

  /** int (length), text. */
  intString(text: string): this {
    return this.int(text.length).raw(text)
  }

  color(red: number, green: number, blue: number): this {
    return this.byte(red).byte(green).byte(blue).byte(0)
  }

  zeros(count: number): this {
    for (let i = 0; i < count; i += 1) this.byte(0)
    return this
  }
}

type Version = 3 | 4

function header(b: Bytes, version: Version): void {
  b.fixedString(version === 4 ? 'FICHIER GUITAR PRO v4.06' : 'FICHIER GUITAR PRO v3.00', 30)
  for (const field of [
    'Test Song',
    'Sub',
    'Artist',
    'Album',
    'Author',
    'Copyright',
    'Tabber',
    'Play slowly',
  ]) {
    b.sizedString(field)
  }
  b.int(1).sizedString('A comment')
  b.byte(0) // triplet feel
  if (version === 4) {
    b.int(1) // lyric track (1-based)
    // verse 1 from bar 1 (hyphen, comment, a skipped note), verse 2 from bar 2
    b.int(1).intString('[Verse] Hel-lo world  yeah')
    b.int(2).intString('la la')
    for (let i = 0; i < 3; i += 1) b.int(1).intString('')
  }
  b.int(132) // tempo
  if (version === 4)
    b.int(0).byte(0) // key, octave
  else b.byte(0).zeros(3) // key, padding
  for (let i = 0; i < 64; i += 1) {
    b.int(i === 0 ? 25 : 0) // program
    b.byte(13).byte(8).byte(0).byte(1).byte(0).byte(0) // volume, balance, chorus, reverb, phaser, tremolo
    b.zeros(2)
  }
  b.int(2).int(1) // bars, tracks
  // bar 1: 3/4, repeat open, marker
  b.byte(0x01 | 0x02 | 0x04 | 0x20)
    .byte(3)
    .byte(4)
    .sizedString('Intro')
    .color(255, 0, 0)
  // bar 2: repeat close (twice), key change to B minor (two sharps)
  b.byte(0x08 | 0x40)
    .byte(2)
    .byte(2)
    .byte(1)
  // track
  b.byte(0).fixedString('Guitar', 40)
  b.int(6)
  for (const pitch of [64, 59, 55, 50, 45, 40, 0]) b.int(pitch) // highest string first
  b.int(1) // port
  b.int(1).int(2) // channel 1, effect channel 2 (stored + 1)
  b.int(24) // frets
  b.int(2) // capo
  b.color(0, 128, 255)
}

/** Note: fret on a string, with optional effects (version-specific layout). */
function note(
  b: Bytes,
  version: Version,
  fret: number,
  opts: { tied?: boolean; effects?: boolean; dynamic?: number } = {},
): void {
  b.byte(0x20 | (opts.effects ? 0x08 : 0) | (opts.dynamic != null ? 0x10 : 0)) // flags: type + fret, effects, dynamic
  b.byte(opts.tied ? 0x02 : 0x01)
  if (opts.dynamic != null) b.byte(opts.dynamic)
  b.byte(fret)
  if (!opts.effects) return
  if (version === 4) {
    b.byte(0x01 | 0x10).byte(0x08 | 0x02 | 0x10) // flags1: bend, grace; flags2: slide, palm mute, harmonic
  } else {
    b.byte(0x01 | 0x10 | 0x04) // bend, grace, slide
  }
  // bend: type + value, then points
  b.byte(1).int(100).int(2).int(0).int(0).byte(0).int(60).int(100).byte(0)
  // grace: fret, dynamic, transition, duration
  b.byte(5).byte(6).byte(0).byte(2)
  if (version === 4) b.byte(1).byte(17) // slide type; artificial harmonic (GP4: one byte, 17 = +7 frets)
}

function measures(b: Bytes, version: Version): void {
  // bar 1 (3/4): chord + text + stroke on a quarter (two notes, one with effects), tied quarter, quarter rest
  b.int(3)
  b.byte(0x02 | 0x04 | 0x08).byte(0) // chord, text, beat effects; quarter
  b.byte(0).sizedString('G').int(1) // chord in the old format: name, base fret
  for (const fret of [3, 0, 0, 0, 2, 3]) b.int(fret)
  b.sizedString('Verse')
  if (version === 4)
    b.byte(0x40).byte(0).byte(0).byte(3) // stroke: up 0, down 3 (32nd)
  else b.byte(0x40).byte(0).byte(3)
  b.byte((1 << 6) | (1 << 1)) // strings 1 (high e) and 6 (low E)
  note(b, version, 3)
  note(b, version, 7, { effects: true })
  b.byte(0)
    .byte(0)
    .byte(1 << 6) // quarter, tied on the high e
  note(b, version, 3, { tied: true })
  b.byte(0x40).byte(0x02).byte(0).byte(0) // rest beat (status byte), quarter, no strings

  // bar 2 (3/4): triplet eighths, then a half note with a tempo change
  b.int(4)
  for (const [i, fret] of [5, 7, 8].entries()) {
    b.byte(0x20)
      .byte(1)
      .int(3)
      .byte(1 << 2) // eighth triplet, string 3
    note(b, version, fret, { dynamic: i === 0 ? 7 : undefined }) // the first one ff
  }
  b.byte(0x10).byte(0xff) // half note (-1) with a mix change
  b.byte(0xff) // instrument
  for (let i = 0; i < 6; i += 1) b.byte(0xff) // volume … tremolo unchanged
  b.int(96).byte(0) // tempo + its transition
  if (version === 4) b.byte(0) // apply-to-all flags
  b.byte(1 << 5)
  note(b, version, 12)
}

/** A complete GP3 or GP4 file. */
export function buildGuitarProFile(version: Version): Uint8Array {
  const b = new Bytes()
  header(b, version)
  measures(b, version)
  return Uint8Array.from(b.data)
}
