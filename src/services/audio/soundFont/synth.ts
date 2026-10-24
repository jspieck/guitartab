/*! Based on the JavaScript SoundFont 2 Parser. Copyright 2013-2015
imaya/GREE Inc and Colin Clark. Licensed under the MIT License. */

import { audioGraph } from '../audioGraph'
import { createInstruments, createPresets, parseSoundFont, type Generators } from './parser'

/** What a SoundFont gives one key of one preset: the sample and how to play it. */
export interface KeyInfo {
  sample: Int16Array
  sampleRate: number
  basePlaybackRate: number
  modEnvToPitch: number
  scaleTuning: number
  start: number
  end: number
  loopStart: number
  loopEnd: number
  volAttack: number
  volDecay: number
  volSustain: number
  volRelease: number
  modAttack: number
  modDecay: number
  modSustain: number
  modRelease: number
  initialFilterFc: number
  modEnvToFilterFc: number
  initialFilterQ: number
  freqVibLFO: number | null
}

/** A preset's keys (sparse: only the keys its zones cover). */
export type PresetKeys = KeyInfo[] & { name?: string }

/** Banks by bank number (0 melodic, 128 drums), each preset by program number. */
export type Banks = PresetKeys[][]

/** What `noteOn` hands the sample player for one note. */
export interface SynthNote {
  buffer: AudioBuffer
  volAttack: number
  /** end of the decay phase, seconds after the note starts */
  volDecay: number
  playBackRate: number
  loop: boolean
  loopStart: number
  loopEnd: number
  volSustain: number
  volRelease: number
}

const DRUM_PROGRAM = 9
const DRUM_BANK = 128

function amountOf(generator: Generators, name: string, fallback = 0): number {
  // a 0 amount is kept: only a missing generator falls back
  return generator[name] ? generator[name]!.amount! : fallback
}

/** Fills the keys of `preset` that one instrument zone covers and no earlier zone did. */
function addZoneKeys(
  generator: Generators,
  preset: PresetKeys,
  samples: Int16Array[],
  sampleHeaders: ReturnType<typeof parseSoundFont>['sampleHeaders'],
): void {
  if (generator.keyRange == null || generator.sampleID == null) return
  const volAttack = amountOf(generator, 'attackVolEnv', -12000)
  const volDecay = amountOf(generator, 'decayVolEnv', -12000)
  const volSustain = amountOf(generator, 'sustainVolEnv')
  const volRelease = amountOf(generator, 'releaseVolEnv', -12000)
  const modAttack = amountOf(generator, 'attackModEnv', -12000)
  const modDecay = amountOf(generator, 'decayModEnv', -12000)
  const modSustain = amountOf(generator, 'sustainModEnv')
  const modRelease = amountOf(generator, 'releaseModEnv', -12000)
  const tune = amountOf(generator, 'coarseTune') + amountOf(generator, 'fineTune') / 100
  const scale = amountOf(generator, 'scaleTuning', 100) / 100
  const freqVibLFO = amountOf(generator, 'freqVibLFO')

  for (let key = generator.keyRange.lo!, last = generator.keyRange.hi!; key <= last; key += 1) {
    if (preset[key]) continue
    const sampleId = amountOf(generator, 'sampleID')
    const header = sampleHeaders[sampleId]
    preset[key] = {
      sample: samples[sampleId],
      sampleRate: header.sampleRate,
      basePlaybackRate:
        (2 ** (1 / 12)) **
          (key -
            amountOf(generator, 'overridingRootKey', header.originalPitch) +
            tune +
            header.pitchCorrection / 100) *
        scale,
      modEnvToPitch: amountOf(generator, 'modEnvToPitch') / 100,
      scaleTuning: scale,
      start: amountOf(generator, 'startAddrsCoarseOffset') * 32768 + amountOf(generator, 'startAddrsOffset'),
      end: amountOf(generator, 'endAddrsCoarseOffset') * 32768 + amountOf(generator, 'endAddrsOffset'),
      loopStart:
        header.startLoop +
        amountOf(generator, 'startloopAddrsCoarseOffset') * 32768 +
        amountOf(generator, 'startloopAddrsOffset'),
      loopEnd:
        header.endLoop +
        amountOf(generator, 'endloopAddrsCoarseOffset') * 32768 +
        amountOf(generator, 'endloopAddrsOffset'),
      volAttack: 2 ** (volAttack / 1200),
      volDecay: 2 ** (volDecay / 1200),
      volSustain: volSustain / 1000,
      volRelease: 2 ** (volRelease / 1200),
      modAttack: 2 ** (modAttack / 1200),
      modDecay: 2 ** (modDecay / 1200),
      modSustain: modSustain / 1000,
      modRelease: 2 ** (modRelease / 1200),
      initialFilterFc: amountOf(generator, 'initialFilterFc', 13500),
      modEnvToFilterFc: amountOf(generator, 'modEnvToFilterFc'),
      initialFilterQ: amountOf(generator, 'initialFilterQ'),
      freqVibLFO: freqVibLFO ? 2 ** (freqVibLFO / 1200) * 8.176 : null,
    }
  }
}

/** Parses a SoundFont 2 file into banks of presets of keys. */
export function buildBanks(input: Uint8Array): Banks {
  const data = parseSoundFont(input)
  const presets = createPresets(data)
  const instruments = createInstruments(data)
  const banks: Banks = []
  for (const preset of presets) {
    if (typeof preset.instrument !== 'number') continue
    const instrument = instruments[preset.instrument]
    if (instrument.name.replace(/\0*$/, '') === 'EOI') continue
    banks[preset.header.bank] ??= []
    const keys: PresetKeys = []
    keys.name = preset.name
    banks[preset.header.bank][preset.header.preset] = keys
    for (const zone of instrument.info) addZoneKeys(zone.generator, keys, data.samples, data.sampleHeaders)
  }
  return banks
}

/** Int16 PCM to the -1…1 floats an AudioBuffer holds. */
function toFloat32(sample: Int16Array): Float32Array {
  const output = new Float32Array(sample.length)
  for (let i = 0; i < sample.length; i += 1) output[i] = sample[i] / 0x7fff
  return output
}

/** AudioBuffer per key (the key objects live as long as the loaded SoundFont). */
const sampleBuffers = new WeakMap<KeyInfo, AudioBuffer>()

function keyBuffer(key: KeyInfo): AudioBuffer {
  // Converting the sample is the expensive part of a note; each key's buffer is built once.
  let buffer = sampleBuffers.get(key)
  if (buffer == null) {
    const sample = key.sample.subarray(0, key.sample.length + key.end)
    buffer = audioGraph.context.createBuffer(1, sample.length, key.sampleRate)
    buffer.getChannelData(0).set(toFloat32(sample))
    sampleBuffers.set(key, buffer)
  }
  return buffer
}

export const synth = {
  bank: 0,
  bankSet: [] as Banks,

  init(input: Uint8Array): void {
    this.bankSet = buildBanks(input)
  },

  /**
   * The sample and envelope for a key of a program (9 = drums: bank 128, preset 0),
   * or null while the SoundFont isn't loaded or has no such key.
   */
  noteOn(program: number, key: number, _velocity: number, channel = 0): SynthNote | null {
    const isDrums = program === DRUM_PROGRAM
    const bank = isDrums ? DRUM_BANK : this.bank
    const instrumentIndex = isDrums ? 0 : program
    const keys = this.bankSet[bank]?.[instrumentIndex]
    if (!keys) {
      console.warn('Instrument not found! program:', program, 'bank:', bank, 'index:', instrumentIndex)
      return null
    }
    const keyInfo = keys[key]
    if (!keyInfo) {
      console.warn('Instrument key not found!', program, key)
      return null
    }
    return {
      buffer: keyBuffer(keyInfo),
      volAttack: keyInfo.volAttack,
      volDecay: keyInfo.volAttack + keyInfo.volDecay,
      playBackRate: keyInfo.basePlaybackRate,
      loop: channel !== DRUM_PROGRAM,
      loopStart: keyInfo.loopStart / keyInfo.sampleRate,
      loopEnd: keyInfo.loopEnd / keyInfo.sampleRate,
      volSustain: keyInfo.volSustain,
      volRelease: keyInfo.volRelease,
    }
  },
}
