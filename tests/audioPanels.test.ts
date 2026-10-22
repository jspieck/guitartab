import { describe, expect, it, vi } from 'vitest'
import {
  COMPRESSOR_PRESETS,
  CompressorModalHandler,
  compressorCurve,
} from '../src/assets/js/modals/compressorModalHandler'
import { EqualizerModalHandler, eqTypeUsesGain } from '../src/assets/js/modals/equalizerModalHandler'
import { faderPositionToGain, formatGainDb, gainToFaderPosition } from '../src/services/drumMixer'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)
vi.mock('../src/assets/js/playbackEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.playbackModule),
)
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

function fakeParam(value = 0) {
  return {
    value,
    setValueAtTime(next: number) {
      this.value = next
    },
  }
}

function fakeCompressorNode() {
  return {
    context: { currentTime: 0 },
    threshold: fakeParam(),
    knee: fakeParam(),
    ratio: fakeParam(),
    attack: fakeParam(),
    release: fakeParam(),
    reduction: -3,
  }
}

function fakeAudioContext() {
  return {
    sampleRate: 48000,
    createBiquadFilter: () => ({
      type: 'peaking',
      frequency: fakeParam(),
      gain: fakeParam(),
      Q: fakeParam(),
      connect() {},
    }),
  }
}

describe('compressor transfer curve', () => {
  const settings = { threshold: -20, knee: 0, ratio: 4, attack: 10, release: 100 }

  it('passes signal below the threshold and divides overshoot by the ratio', () => {
    expect(compressorCurve(-30, settings)).toBe(-30)
    expect(compressorCurve(-20, settings)).toBe(-20)
    expect(compressorCurve(0, settings)).toBe(-15)
  })

  it('soft knee joins both straight segments without a step', () => {
    const soft = { ...settings, knee: 10 }
    expect(compressorCurve(-25, soft)).toBeCloseTo(-25)
    expect(compressorCurve(-15, soft)).toBeCloseTo(compressorCurve(-15, settings))
    expect(compressorCurve(-20, soft)).toBeLessThan(-20)
  })
})

describe('CompressorModalHandler', () => {
  it('applies settings to the node in the units WebAudio expects', () => {
    const handler = new CompressorModalHandler()
    const node = fakeCompressorNode()
    handler.attach(node as unknown as DynamicsCompressorNode)
    const defaults = COMPRESSOR_PRESETS[0].settings
    expect(node.threshold.value).toBe(defaults.threshold)
    expect(node.attack.value).toBeCloseTo(defaults.attack / 1000)

    handler.update({ threshold: -90, ratio: 3, release: 250 })
    expect(node.threshold.value).toBe(-60) // clamped to the node's range
    expect(node.ratio.value).toBe(3)
    expect(node.release.value).toBeCloseTo(0.25)
    expect(handler.reduction()).toBe(-3)
  })

  it('bypass makes the node transparent and keeps the dialled-in settings', () => {
    const handler = new CompressorModalHandler()
    const node = fakeCompressorNode()
    handler.attach(node as unknown as DynamicsCompressorNode)
    handler.update({ threshold: -24, ratio: 6 })
    handler.setBypass(true)
    expect(node.ratio.value).toBe(1)
    expect(node.threshold.value).toBe(0)
    expect(handler.reduction()).toBe(0)
    handler.setBypass(false)
    expect(node.ratio.value).toBe(6)
    expect(node.threshold.value).toBe(-24)
  })

  it('recognises presets', () => {
    const handler = new CompressorModalHandler()
    handler.update(COMPRESSOR_PRESETS[2].settings)
    expect(handler.matchingPreset()).toBe(COMPRESSOR_PRESETS[2].name)
    handler.update({ ratio: 7 })
    expect(handler.matchingPreset()).toBe('')
  })
})

describe('EqualizerModalHandler', () => {
  it('keeps the wired filter nodes when the panel attaches to the same context', () => {
    const handler = new EqualizerModalHandler()
    const context = fakeAudioContext() as unknown as AudioContext
    handler.setAudioContext(context)
    const wired = [...handler.equalizerNodes]
    handler.setAudioContext(context)
    expect(handler.equalizerNodes).toEqual(wired)
    expect(handler.equalizerNodes.every((node, index) => node === wired[index])).toBe(true)
  })

  it('pushes band edits to the filter and turns disabled bands into all-pass', () => {
    const handler = new EqualizerModalHandler()
    handler.setAudioContext(fakeAudioContext() as unknown as AudioContext)
    handler.setBand(1, { type: 'peaking', frequency: 1000, gain: 30, q: 2 })
    const node = handler.equalizerNodes[1]
    expect(node.frequency.value).toBe(1000)
    expect(node.gain.value).toBe(18) // clamped to the graph range
    expect(node.Q.value).toBe(2)
    handler.setBand(1, { enabled: false })
    expect(node.type).toBe('allpass')
    expect(node.gain.value).toBe(0)
  })

  it('maps frequency and gain to plot coordinates and back', () => {
    const handler = new EqualizerModalHandler()
    expect(handler.frequencyToXPos(20)).toBeCloseTo(0)
    expect(handler.frequencyToXPos(20000)).toBeCloseTo(handler.PLOT_WIDTH)
    expect(handler.xPosToFrequency(handler.frequencyToXPos(1234))).toBeCloseTo(1234)
    expect(handler.yPosToDb(handler.dbToYPos(-7.5))).toBeCloseTo(-7.5)
    expect(eqTypeUsesGain('highshelf')).toBe(true)
    expect(eqTypeUsesGain('highpass')).toBe(false)
  })
})

describe('drum mixer fader taper', () => {
  it('round-trips gain through the fader position', () => {
    for (const gain of [0.1, 0.5, 1, 2, 3.5]) {
      expect(faderPositionToGain(gainToFaderPosition(gain))).toBeCloseTo(gain)
    }
  })

  it('treats the bottom as silence and formats in dB', () => {
    expect(faderPositionToGain(0)).toBe(0)
    expect(gainToFaderPosition(0)).toBe(0)
    expect(formatGainDb(0)).toBe('-∞')
    expect(formatGainDb(1)).toBe('0.0')
    expect(formatGainDb(2)).toBe('+6.0')
  })
})
