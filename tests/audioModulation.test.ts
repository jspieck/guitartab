import { describe, expect, it, vi } from 'vitest'
import {
  generateCurve,
  makeBend,
  makeDistortion,
  setEffectGain,
  smoothDistortion,
} from '../src/services/editor/audioModulation'

describe('audioModulation', () => {
  it('generateCurve returns a fixed-length LFO ending at 1', () => {
    const values = generateCurve(1, 2, 0.1, 1)
    expect(values).toHaveLength(4096)
    expect(values[values.length - 1]).toBe(1)
    expect(values[0]).toBeCloseTo(1, 5)
  })

  it('makeBend schedules exponential playback-rate ramps', () => {
    const setValueAtTime = vi.fn()
    const exponentialRampToValueAtTime = vi.fn()
    const source = {
      playbackRate: { setValueAtTime, exponentialRampToValueAtTime },
    } as unknown as AudioBufferSourceNode

    makeBend(
      [
        { bendPosition: 0, bendValue: 0 },
        { bendPosition: 30, bendValue: 100 },
      ],
      source,
      2,
      1,
      1,
    )

    expect(setValueAtTime).toHaveBeenCalled()
    expect(exponentialRampToValueAtTime).toHaveBeenCalledTimes(1)
    const [, endTime] = exponentialRampToValueAtTime.mock.calls[0]
    expect(endTime).toBe(1 + 2 * (30 / 60))
  })

  it('smoothDistortion stays within a soft-clip range', () => {
    const curve = smoothDistortion(0.5)
    expect(curve).toHaveLength(44100)
    expect(Math.max(...Array.from(curve))).toBeLessThanOrEqual(1.01)
    expect(Math.min(...Array.from(curve))).toBeGreaterThanOrEqual(-1.01)
  })

  it('makeDistortion produces a non-linear transfer curve', () => {
    const curve = makeDistortion(50)
    expect(curve[0]).not.toBe(curve[Math.floor(curve.length / 2)])
  })

  it('setEffectGain maps mixer values onto bus nodes', () => {
    const bus = {
      convolver: { wetGain: 0 },
      chorus: { dry: 1 },
      pan: { pan: { value: 0 } },
    }

    setEffectGain(bus as any, 127, 'reverb')
    expect(bus.convolver.wetGain).toBe(1)

    setEffectGain(bus as any, 0, 'chorus')
    expect(bus.chorus.dry).toBe(1)

    setEffectGain(bus as any, 127, 'pan')
    expect(bus.pan.pan.value).toBe(1)
  })
})
