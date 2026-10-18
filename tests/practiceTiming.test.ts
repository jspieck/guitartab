import { describe, expect, it } from 'vitest'
import {
  computeCountIn,
  getBarBeatPositions,
  nextTrainerRate,
  secondsPerWhole,
  wholesPerSecond,
} from '../src/services/practiceTiming'
import { clampPlaybackRate, PLAYBACK_RATE_MAX, PLAYBACK_RATE_MIN } from '../src/stores/practiceState'

describe('practice timing', () => {
  it('converts musical time with the playback speed applied', () => {
    expect(secondsPerWhole(120)).toBe(2)
    expect(secondsPerWhole(120, 0.5)).toBe(4)
    expect(wholesPerSecond(120, 0.5) * secondsPerWhole(120, 0.5)).toBeCloseTo(1)
  })

  it('places one bar of count-in clicks ending at the start time', () => {
    const { clicks, duration } = computeCountIn(3, 4, 60, 1, 10)

    expect(duration).toBe(3)
    expect(clicks.map((click) => click.time)).toEqual([7, 8, 9])
    expect(clicks.map((click) => click.accent)).toEqual([true, false, false])
  })

  it('uses the bar meter for the count-in, including eighth-note meters and slow speeds', () => {
    const { clicks, duration } = computeCountIn(6, 8, 120, 0.5, 0)

    expect(clicks).toHaveLength(6)
    expect(duration).toBeCloseTo(3)
  })

  it('lists beat positions of a bar, cut where a loop ends inside it', () => {
    expect(getBarBeatPositions(4, 4, 1)).toEqual([0, 0.25, 0.5, 0.75])
    expect(getBarBeatPositions(4, 4, 0.5)).toEqual([0, 0.25])
    expect(getBarBeatPositions(7, 8, 7 / 8)).toHaveLength(7)
  })

  it('raises the trainer speed step by step and stops at the target', () => {
    expect(nextTrainerRate(0.7, 0.05, 1)).toBe(0.75)
    expect(nextTrainerRate(0.98, 0.05, 1)).toBe(1)
    expect(nextTrainerRate(1, 0.05, 1)).toBe(1)
    expect(nextTrainerRate(1.2, 0.05, 1)).toBe(1.2)
  })

  it('clamps playback speed to the supported range', () => {
    expect(clampPlaybackRate(0.1)).toBe(PLAYBACK_RATE_MIN)
    expect(clampPlaybackRate(9)).toBe(PLAYBACK_RATE_MAX)
    expect(clampPlaybackRate(Number.NaN)).toBe(1)
    expect(clampPlaybackRate(0.756)).toBe(0.76)
  })
})
