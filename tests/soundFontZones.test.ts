import { describe, expect, it, vi } from 'vitest'
import type { SoundFontData } from '../src/services/audio/soundFont/parser'
import { buildBanksFrom } from '../src/services/audio/soundFont/banks'
import { voicesFor } from '../src/services/audio/soundFont/synth'

vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)

const gen = (type: string, value: Record<string, number>) => ({ type, value })
const bag = (generatorIndex: number) => ({ generatorIndex, modulatorIndex: 0 })
const sampleHeader = (name: string) => ({
  sampleName: name,
  startLoop: 10,
  endLoop: 90,
  sampleRate: 44100,
  originalPitch: 60,
  pitchCorrection: 0,
  sampleLink: 0,
  sampleType: 1,
})

/**
 * One preset like GeneralUser's stereo instruments: a preset global zone (reverb offset),
 * one instrument with a global zone (loop, release, vibrato) and three sample zones: a
 * soft layer, and a loud layer as a left/right pair panned apart.
 */
function stereoFont(): SoundFontData {
  return {
    presetHeaders: [
      { presetName: 'Stereo', preset: 0, bank: 0, presetBagIndex: 0, library: 0, genre: 0, morphology: 0 },
      { presetName: 'EOP', preset: 0, bank: 0, presetBagIndex: 2, library: 0, genre: 0, morphology: 0 },
    ],
    presetBags: [bag(0), bag(1), bag(2)],
    presetModulators: [],
    presetGenerators: [gen('reverbEffectsSend', { amount: 200 }), gen('instrument', { amount: 0 })],
    instruments: [
      { instrumentName: 'Stereo', instrumentBagIndex: 0 },
      { instrumentName: 'EOI', instrumentBagIndex: 4 },
    ],
    instrumentBags: [bag(0), bag(4), bag(6), bag(9), bag(12)],
    instrumentModulators: [],
    instrumentGenerators: [
      // global zone
      gen('sampleModes', { amount: 1 }),
      gen('releaseVolEnv', { amount: 0 }),
      gen('vibLfoToPitch', { amount: 30 }),
      gen('reverbEffectsSend', { amount: 100 }),
      // soft layer
      gen('velRange', { lo: 0, hi: 63 }),
      gen('sampleID', { amount: 0 }),
      // loud left
      gen('velRange', { lo: 64, hi: 127 }),
      gen('pan', { amount: -500 }),
      gen('sampleID', { amount: 1 }),
      // loud right
      gen('velRange', { lo: 64, hi: 127 }),
      gen('pan', { amount: 500 }),
      gen('sampleID', { amount: 2 }),
    ],
    sampleHeaders: [sampleHeader('soft'), sampleHeader('loudL'), sampleHeader('loudR')],
    samples: [new Int16Array(100), new Int16Array(100), new Int16Array(100)],
    compressed: [null, null, null],
  }
}

describe('SoundFont zones', () => {
  const keys = buildBanksFrom(stereoFont())[0][0]

  it('plays the soft layer alone, the loud layer as a panned pair', () => {
    expect(voicesFor(keys[60], 40).map((v) => v.zone.pan)).toEqual([0])
    expect(voicesFor(keys[60], 100).map((v) => v.zone.pan)).toEqual([-1, 1])
  })

  it('fills zones from the instrument global zone and adds the preset offsets', () => {
    const [left] = voicesFor(keys[60], 100)
    expect(left.zone).toMatchObject({
      loop: true,
      volRelease: 1,
      // 100 from the instrument plus 200 from the preset, in 0.1 %
      reverbSend: 0.3,
      chorusSend: 0,
      vibLfo: { toPitch: 30 },
      modLfo: null,
    })
    expect(left.zone.vibLfo!.frequency).toBeCloseTo(8.176)
  })

  it('tunes each key from the root key', () => {
    expect(keys[72].basePlaybackRate).toBeCloseTo(2)
    expect(keys[48].basePlaybackRate).toBeCloseTo(0.5)
  })
})
