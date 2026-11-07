import { describe, expect, it } from 'vitest'
import { ampFromToneNames, ampOf, defaultAmp, sampleProgram } from '../src/services/audio/ampModel'
import { cabinetImpulse, driveCurve, gainAt } from '../src/services/audio/ampSimulator'
import { ByteReader } from '../src/services/import/guitarPro/byteReader'
import { GuitarProParser } from '../src/services/import/guitarPro/parser'
import { emptyGuitarProSong } from '../src/services/import/guitarPro/guitarProSong'

describe('amp settings', () => {
  it('is on by default only for the overdrive and distortion guitars', () => {
    expect(defaultAmp(29)).toMatchObject({ enabled: true, cabinet: 'medium' })
    expect(defaultAmp(30)).toMatchObject({ enabled: true, cabinet: 'large' })
    expect(defaultAmp(30).drive).toBeGreaterThan(defaultAmp(29).drive)
    for (const program of [0, 24, 25, 27, 28, 33]) expect(defaultAmp(program).enabled).toBe(false)
  })

  it("prefers the track's own settings", () => {
    const own = { enabled: false, drive: 0.1, tone: 0.2, cabinet: 'small' as const }
    expect(ampOf({ amp: own }, 30)).toBe(own)
    expect(ampOf({}, 30).enabled).toBe(true)
  })

  it('plays the clean guitar samples for distorted guitars while the amp is on', () => {
    expect(sampleProgram(30, defaultAmp(30))).toBe(27)
    expect(sampleProgram(29, defaultAmp(29))).toBe(27)
    expect(sampleProgram(30, { ...defaultAmp(30), enabled: false })).toBe(30)
    // other instruments keep their samples, with or without the amp
    expect(sampleProgram(27, { ...defaultAmp(30) })).toBe(27)
    expect(sampleProgram(33, { ...defaultAmp(30) })).toBe(33)
  })

  it('reads distortion from Guitar Pro tone names', () => {
    expect(ampFromToneNames(['Hard Rock - Default', 'Distortion Tones'])).toMatchObject({ drive: 0.75 })
    expect(ampFromToneNames(['Bluesy Drive', 'Overdrive Tones'])).toMatchObject({ drive: 0.45 })
    expect(ampFromToneNames(['Stringed/Electric Guitars/Clean Guitar', 'E30_EqGEq'])).toBeNull()
    expect(ampFromToneNames(['Acoustic - Default', 'Acoustic Tones'])).toBeNull()
    expect(ampFromToneNames(['Bass - Default', 'Bass Tones'])).toBeNull()
    expect(ampFromToneNames(['', null, undefined])).toBeNull()
  })
})

/** A GP5.1 track record as `GuitarProParser.readTrack` reads it, ending in the RSE tone's two names. */
function gp51Track(toneName: string, toneCategory: string): Uint8Array {
  const bytes: number[] = []
  const byte = (value: number) => bytes.push(value & 0xff)
  const int = (value: number) => [0, 8, 16, 24].forEach((shift) => byte(value >> shift))
  const text = (value: string) => [...value].forEach((char) => byte(char.charCodeAt(0)))
  byte(0) // flags
  byte(0) // the first track has one more byte
  byte(4)
  text('Lead')
  for (let i = 4; i < 40; i += 1) byte(0)
  int(6)
  for (const pitch of [64, 59, 55, 50, 45, 40, 0]) int(pitch)
  int(1) // port
  int(1)
  int(2) // channel, effect channel
  int(24) // frets
  int(0) // capo
  for (let i = 0; i < 4; i += 1) byte(0) // colour
  for (let i = 0; i < 49; i += 1) byte(0) // display flags, RSE instrument, equalizer
  for (const value of [toneName, toneCategory]) {
    int(value.length + 1)
    byte(value.length)
    text(value)
  }
  return Uint8Array.from(bytes)
}

describe('GP5 RSE tones', () => {
  const readTrack = (name: string, category: string) => {
    const parser = new GuitarProParser(
      new ByteReader(gp51Track(name, category), 'gp5'),
      emptyGuitarProSong(),
      5,
    )
    parser.minor = 1
    return parser.readTrack(1)
  }

  it('turns the amp on for a distorted RSE tone', () => {
    const track = readTrack('Hard Rock - Default', 'Distortion Tones')
    expect(track.name).toBe('Lead')
    expect(track.amp).toMatchObject({ enabled: true, drive: 0.75 })
  })

  it('leaves clean tones to the program default', () => {
    expect(readTrack('Clean - Default', 'Clean Tones').amp).toBeUndefined()
  })
})

describe('amp DSP', () => {
  const curve = driveCurve(4097)
  const at = (x: number) => curve[Math.round(((x + 1) / 2) * (curve.length - 1))]

  it('clips softly, stays within ±1 and rises monotonically', () => {
    expect(Math.max(...curve.map(Math.abs))).toBeLessThanOrEqual(1)
    for (let i = 1; i < curve.length; i += 1) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1] - 1e-7)
    // saturates: the last tenth of the input range adds almost nothing
    expect(at(1) - at(0.9)).toBeLessThan(0.01)
  })

  it('is silent at rest and gates the lowest levels', () => {
    expect(at(0)).toBe(0)
    const tiny = at(0.001)
    const small = at(0.02)
    expect(Math.abs(tiny)).toBeLessThan(Math.abs(small) * 0.05)
  })

  it('clips asymmetrically (even harmonics)', () => {
    expect(at(0.05)).not.toBeCloseTo(-at(-0.05), 3)
  })

  it.each(['small', 'medium', 'large'] as const)('builds a %s cabinet like a guitar speaker', (cabinet) => {
    const sampleRate = 48000
    const response = cabinetImpulse(cabinet, sampleRate)
    expect(response.length).toBe(Math.round(0.04 * sampleRate))
    // about unit gain in the mids, no DC and little deep bass, fizz above 8 kHz is cut hard
    const mid = gainAt(response, 1500, sampleRate)
    expect(mid).toBeGreaterThan(0.5)
    expect(mid).toBeLessThan(2)
    expect(gainAt(response, 0, sampleRate)).toBeLessThan(mid * 0.05)
    expect(gainAt(response, 30, sampleRate)).toBeLessThan(mid * 0.3)
    expect(gainAt(response, 10000, sampleRate)).toBeLessThan(mid * 0.1)
    // it has decayed by the end of the buffer
    expect(Math.abs(response[response.length - 1])).toBeLessThan(1e-3)
  })

  it('gives the closed 4×12 more low end than the open 1×12', () => {
    const sampleRate = 44100
    const lowToMid = (cabinet: 'small' | 'large') => {
      const response = cabinetImpulse(cabinet, sampleRate)
      return gainAt(response, 110, sampleRate) / gainAt(response, 1500, sampleRate)
    }
    expect(lowToMid('large')).toBeGreaterThan(lowToMid('small') * 1.5)
  })
})
