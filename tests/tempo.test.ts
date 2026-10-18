import { describe, expect, it } from 'vitest'
import { TEMPO_MAX, TEMPO_MIN, clampTempo } from '../src/utils/tempo'

describe('clampTempo', () => {
  it('keeps tempos inside the range', () => {
    expect(clampTempo(120)).toBe(120)
    expect(clampTempo(240)).toBe(240)
  })

  it('clamps to the bounds', () => {
    expect(clampTempo(2)).toBe(TEMPO_MIN)
    expect(clampTempo(1000)).toBe(TEMPO_MAX)
  })
})
