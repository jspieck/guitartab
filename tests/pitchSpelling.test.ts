import { describe, expect, it } from 'vitest'
import { BarAccidentals, keySignatureGlyphs, spellPitch, vexFlowKeyOf } from '../src/utils/pitchSpelling'
import { keyChanges, keyName, vexFlowKey } from '../src/utils/keySignature'

const spell = (height: number, fifths: number) => vexFlowKeyOf(spellPitch(height, fifths))

describe('pitch spelling', () => {
  it('spells notes of the key with the key and others by its side', () => {
    expect(spell(60, 0)).toBe('c/4')
    expect(spell(61, 0)).toBe('c#/4') // C major: sharps, as before
    expect(spell(66, 2)).toBe('f#/4') // D major
    expect(spell(70, -1)).toBe('bb/4') // F major
    expect(spell(61, -3)).toBe('db/4') // E♭ major: chromatic notes flattened
    expect(spell(65, 7)).toBe('e#/4') // C♯ major: F is E♯
    expect(spell(59, -7)).toBe('cb/4') // C♭ major: B3 is C♭4
    expect(spell(60, 7)).toBe('b#/3') // and C4 is B♯3
  })

  it('shows an accidental once per bar and line, and naturals against the key', () => {
    const bar = new BarAccidentals(1) // G major: F♯
    expect(bar.sign(spellPitch(66, 1))).toBeNull() // F♯ is in the key
    expect(bar.sign(spellPitch(65, 1))).toBe('n') // F natural
    expect(bar.sign(spellPitch(65, 1))).toBeNull() // still natural in this bar
    expect(bar.sign(spellPitch(66, 1))).toBe('#') // back to F♯
    expect(bar.sign(spellPitch(77, 1))).toBe('n') // another octave is another line
    expect(bar.sign(spellPitch(61, 1))).toBe('#')
    expect(bar.sign(spellPitch(61, 1), true)).toBeNull()
  })

  it('a tied note shows no sign but its accidental still holds', () => {
    const bar = new BarAccidentals(0)
    expect(bar.sign(spellPitch(61, 0), true)).toBeNull()
    expect(bar.sign(spellPitch(61, 0))).toBeNull()
    expect(bar.sign(spellPitch(60, 0))).toBe('n')
  })

  it('counts key signature glyphs incl. cancelling naturals', () => {
    expect(keySignatureGlyphs(2, null)).toBe(2)
    expect(keySignatureGlyphs(0, 3)).toBe(3)
    expect(keySignatureGlyphs(1, 3)).toBe(3) // 1 sharp + 2 naturals
    expect(keySignatureGlyphs(4, 2)).toBe(4)
    expect(keySignatureGlyphs(-2, 3)).toBe(5)
  })
})

describe('key signatures', () => {
  it('names keys and gives VexFlow the relative major', () => {
    expect(keyName({ keySignature: -3 })).toBe('E♭')
    expect(keyName({ keySignature: 3, keyMinor: true })).toBe('F♯m')
    expect(vexFlowKey({ keySignature: 3, keyMinor: true })).toBe('A')
    expect(vexFlowKey({ keySignature: -6 })).toBe('Gb')
  })

  it('detects changes of fifths or mode', () => {
    expect(keyChanges({ keySignature: 0 }, undefined)).toBe(true)
    expect(keyChanges({ keySignature: 2 }, { keySignature: 2 })).toBe(false)
    expect(keyChanges({ keySignature: 2, keyMinor: true }, { keySignature: 2 })).toBe(true)
  })
})
