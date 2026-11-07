import { describe, expect, it } from 'vitest'
import { trackProgram } from '../src/utils/trackProgram'

const channel = (cInstrument: number) => ({
  cInstrument,
  volume: 100,
  balance: 64,
  chorus: 0,
  reverb: 0,
  phaser: 0,
  tremolo: 0,
})

describe('trackProgram', () => {
  it('uses the program of a GPIF or MIDI track', () => {
    expect(trackProgram({ program: 33, channel: { index: 0, effectChannel: 0 } }, [channel(24)])).toBe(33)
    expect(trackProgram({ program: 0, channel: { index: 0, effectChannel: 0 } }, [channel(24)])).toBe(0)
  })

  it("uses the channel's instrument for a Guitar Pro 3–5 track (program -1)", () => {
    expect(
      trackProgram({ program: -1, channel: { index: 1, effectChannel: 2 } }, [channel(0), channel(25)]),
    ).toBe(25)
  })

  it('falls back to program 0 without a usable channel', () => {
    expect(trackProgram({ program: -1, channel: { index: 5, effectChannel: 5 } }, [channel(24)])).toBe(0)
  })
})
