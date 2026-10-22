import { describe, expect, it } from 'vitest'
import Duration from '../src/utils/duration'

describe('Duration', () => {
  it('counts ticks with dots and tuplets', () => {
    expect(Duration.getDurationOfType('q')).toBe(16)
    expect(Duration.getDurationOfType('qr')).toBe(16)
    expect(Duration.getDurationOfType('o')).toBe(0.5)
    expect(Duration.getDurationOfType('')).toBe(0)
    expect(Duration.getDurationOfNote({ duration: 'q', dotted: true }, false)).toBe(24)
    expect(Duration.getDurationOfNote({ duration: 'q', doubleDotted: true }, false)).toBe(28)
    // Triplet eighths: three in the time of two.
    expect(Duration.getDurationOfNote({ duration: 'e', tuplet: 3 }, false)).toBeCloseTo(16 / 3)
    expect(Duration.getDurationOfNote({ duration: 'e', tuplet: 3 }, true)).toBe(8)
  })

  it('maps ticks back to codes and measures bars', () => {
    expect(Duration.typeToString(64)).toBe('w')
    expect(Duration.typeToString(1)).toBe('z')
    expect(Duration.typeToString(3)).toBe('')
    expect(Duration.getDurationOfBar({ numerator: 3, denominator: 4 })).toBe(48)
  })

  it('gives tab widths', () => {
    expect(Duration.getDurationWidth({ duration: 'q' })).toBe(2)
    expect(Duration.getDurationWidth({ duration: 'hr', dotted: true })).toBe(6)
    expect(Duration.getDurationWidth({ duration: 'w', doubleDotted: true })).toBe(15)
    expect(Duration.getDurationWidth({ duration: 'e', dotted: true })).toBe(1)
  })
})
