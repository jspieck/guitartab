import { describe, expect, it, vi } from 'vitest'
import { bendRateFactor, generateCurve, makeBend, setEffectGain } from '../src/services/audio/audioModulation'

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
    const [peakRate, endTime] = exponentialRampToValueAtTime.mock.calls[0]
    expect(endTime).toBe(1 + 2 * (30 / 60))
    // A full bend (100) is a whole tone: two semitones up, not one.
    expect(peakRate).toBeCloseTo(2 ** (2 / 12), 10)
  })

  it('bends 50 per semitone, as the dialog, the tab labels and the file formats count', () => {
    expect(bendRateFactor(0)).toBe(1)
    expect(bendRateFactor(50)).toBeCloseTo(2 ** (1 / 12), 10)
    expect(bendRateFactor(100)).toBeCloseTo(2 ** (2 / 12), 10)
    expect(bendRateFactor(200)).toBeCloseTo(2 ** (4 / 12), 10)
  })

  it('setEffectGain maps mixer values onto bus nodes', () => {
    const bus = {
      reverbSend: { gain: { value: 0 } },
      chorusSend: { gain: { value: 1 } },
      pan: 0,
      setPan(value: number) {
        this.pan = value
      },
    }

    setEffectGain(bus as any, 127, 'reverb')
    expect(bus.reverbSend.gain.value).toBe(1)

    setEffectGain(bus as any, 0, 'chorus')
    expect(bus.chorusSend.gain.value).toBe(0)

    setEffectGain(bus as any, 127, 'pan')
    expect(bus.pan).toBe(1)
  })
})
