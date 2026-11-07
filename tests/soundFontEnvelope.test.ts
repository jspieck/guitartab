import { describe, expect, it, vi } from 'vitest'
import { releaseOf, scheduleVolumeEnvelope, volumeEnvelopeAt } from '../src/services/audio/soundFont/envelope'
import type { SynthNote } from '../src/services/audio/soundFont/synth'

vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)

const note = (overrides: Partial<SynthNote> = {}): SynthNote =>
  ({
    volAttack: 0.01,
    volHold: 0.1,
    volDecay: 2,
    volSustain: 0.5,
    volRelease: 0.4,
    ...overrides,
  }) as SynthNote

function recordingParam() {
  const calls: string[] = []
  const param = new Proxy({} as AudioParam, {
    get:
      (_target, name) =>
      (...args: number[]) => {
        calls.push(`${String(name)}(${args.map((a) => +a.toFixed(4)).join(', ')})`)
      },
  })
  return { param, calls }
}

describe('SoundFont volume envelope', () => {
  it('rises during the attack, holds, then falls in decibels to the sustain level', () => {
    const n = note()
    expect(volumeEnvelopeAt(n, 0.005)).toBeCloseTo(0.5)
    expect(volumeEnvelopeAt(n, 0.1)).toBe(1)
    // a 2 s decay drops 100 dB: after 0.2 s, 10 dB
    expect(volumeEnvelopeAt(n, 0.11 + 0.2)).toBeCloseTo(10 ** (-10 / 20))
    // sustain 0.5 = -50 dB, reached after 1 s of decay
    expect(volumeEnvelopeAt(n, 5)).toBeCloseTo(10 ** (-50 / 20))
  })

  it('keeps the peak without a sustain attenuation', () => {
    expect(volumeEnvelopeAt(note({ volSustain: 0 }), 3)).toBe(1)
  })

  it('schedules decay, sustain and a release from the level at note-off', () => {
    const { param, calls } = recordingParam()
    const end = scheduleVolumeEnvelope(param, note(), 1, 10, 1.5)
    expect(end).toBeCloseTo(11.9)
    expect(calls).toEqual([
      'setValueAtTime(0, 10)',
      'linearRampToValueAtTime(1, 10.01)',
      'setValueAtTime(1, 10.11)',
      // 2 s / ln(10^5) per time constant
      'setTargetAtTime(0, 10.11, 0.1737)',
      'setValueAtTime(0.0032, 11.11)',
      'setValueAtTime(0.0032, 11.5)',
      'setTargetAtTime(0, 11.5, 0.0347)',
    ])
  })

  it('releases mid-attack from where the attack got to', () => {
    const { param, calls } = recordingParam()
    scheduleVolumeEnvelope(param, note({ volAttack: 0.2 }), 1, 0, 0.1)
    expect(calls.slice(0, 2)).toEqual(['setValueAtTime(0, 0)', 'linearRampToValueAtTime(0.5, 0.1)'])
  })

  it('bounds the release', () => {
    expect(releaseOf(note({ volRelease: 0.001 }))).toBe(0.015)
    expect(releaseOf(note({ volRelease: 20 }))).toBe(2)
  })
})

describe('SoundFont modulation', () => {
  it('drives the pitch envelope and both LFOs into detune, cutoff and a tremolo gain', async () => {
    const { AudioLog, FakeAudioContext } = await import('./helpers/fakeAudioContext')
    const log = new AudioLog()
    const context = new FakeAudioContext(log) as unknown as AudioContext
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const tremolo = context.createGain()
    log.take()
    const voice = note({
      modAttack: 0.1,
      modHold: 0,
      modDecay: 1,
      modSustain: 0.5,
      modEnvToPitch: 200,
      vibLfo: { delay: 0.2, frequency: 5, toPitch: 20 },
      modLfo: { delay: 0, frequency: 3, toPitch: 0, toFilterFc: 600, toVolume: 60 },
    })
    const { needsFilter, needsTremolo, scheduleModulation } =
      await import('../src/services/audio/soundFont/envelope')
    expect([needsFilter(voice), needsTremolo(voice)]).toEqual([true, true])
    scheduleModulation(context, voice, { source, filter, tremolo }, 1, 3)
    const lines = log.take().join('\n').replace(/#\d+/g, '')
    expect(lines).toContain('source.detune.linearRampToValueAtTime(200, 1.1)')
    expect(lines).toContain('source.detune.linearRampToValueAtTime(100, 1.601)')
    expect(lines).toContain('oscillator.start(1.2)')
    expect(lines).toContain('gain.connect(biquad.detune)')
    expect(lines).toContain('gain.connect(gain.gain)')
    expect(lines).toContain('oscillator.stop(3)')
  })
})

describe('note velocity', () => {
  it('follows the dynamic and softens ghost notes', async () => {
    const { velocityOf } = await import('../src/services/audio/samplePlayer')
    expect(velocityOf({} as never, null)).toBe(100)
    expect(velocityOf({ dynamic: 'pp' } as never, null)).toBe(33)
    expect(velocityOf({ dynamic: 'fff' } as never, { ghost: true } as never)).toBe(45)
  })
})
