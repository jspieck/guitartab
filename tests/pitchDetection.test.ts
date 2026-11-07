import { describe, expect, it } from 'vitest'
import { detectPitch, frequencyToMidi, noteName, tunerReading } from '../src/utils/pitchDetection'

const RATE = 44100

/** A plucked-string-like tone: a few harmonics, decaying, with some noise. */
function tone(frequency: number, length = 4096, harmonics = [1, 0.6, 0.4, 0.25], noise = 0.02): Float32Array {
  const samples = new Float32Array(length)
  let seed = 7
  for (let i = 0; i < length; i += 1) {
    let value = 0
    harmonics.forEach((amplitude, h) => {
      value += amplitude * Math.sin((2 * Math.PI * frequency * (h + 1) * i) / RATE)
    })
    seed = (seed * 16807) % 2147483647
    samples[i] = 0.3 * value * Math.exp(-i / (RATE * 0.8)) + noise * (seed / 2147483647 - 0.5)
  }
  return samples
}

const STANDARD = [40, 45, 50, 55, 59, 64]

describe('pitch detection', () => {
  it('finds the fundamental of each open string within 2 cents', () => {
    for (const midi of [...STANDARD, 28 /* bass E1 */]) {
      const frequency = 440 * 2 ** ((midi - 69) / 12)
      const detected = detectPitch(tone(frequency), RATE)
      expect(detected, `MIDI ${midi}`).not.toBeNull()
      expect(Math.abs(frequencyToMidi(detected!) - midi) * 100, `MIDI ${midi}`).toBeLessThan(2)
    }
  })

  it('is not fooled by a strong second harmonic', () => {
    const detected = detectPitch(tone(110, 4096, [0.5, 1, 0.3]), RATE)
    expect(Math.round(detected!)).toBe(110)
  })

  it('stays silent on silence and noise', () => {
    expect(detectPitch(new Float32Array(4096), RATE)).toBeNull()
    expect(detectPitch(tone(220, 4096, [], 0.5), RATE)).toBeNull()
  })

  it('reads a slightly flat low E against standard tuning', () => {
    const reading = tunerReading(82.41 * 2 ** (-10 / 1200), STANDARD)
    expect(reading).toMatchObject({ note: 'E2', string: 0, stringNote: 'E2' })
    expect(reading.cents).toBe(-10)
    expect(noteName(61)).toBe('C♯4')
  })

  it('names the nearest string even when the note is between strings', () => {
    const reading = tunerReading(440 * 2 ** ((57 - 69) / 12), STANDARD) // A3, between D3 and G3
    expect(reading.note).toBe('A3')
    expect(reading.stringNote).toBe('G3')
    expect(reading.stringCents).toBe(200)
  })
})
