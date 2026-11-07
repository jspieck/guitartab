/*! Based on the JavaScript SoundFont 2 Parser. Copyright 2013-2015
imaya/GREE Inc and Colin Clark. Licensed under the MIT License. */

import { audioGraph } from '../audioGraph'
import {
  createInstruments,
  createPresets,
  parseSoundFont,
  type Generators,
  type Instrument,
  type Preset,
  type SampleHeader,
  type Zone,
} from './parser'

/** A low-frequency oscillator of a zone (SoundFont 2.04, 8.1.2): starts after `delay` seconds. */
export interface Lfo {
  delay: number
  /** Hz */
  frequency: number
  /** cents of pitch swing */
  toPitch: number
}

/** The modulation LFO also moves the filter cutoff (cents) and the volume (centibels). */
export interface ModLfo extends Lfo {
  toFilterFc: number
  toVolume: number
}

/** What a zone sets for every key it covers (key-scaled times are in `KeyInfo`). */
export interface ZoneParams {
  /** linear gain (initialAttenuation) */
  gain: number
  /** sampleModes 1 or 3: the sample loops while the note sounds */
  loop: boolean
  /** notes of the same class cut each other off (open/closed hi-hat); 0 = none */
  exclusiveClass: number
  /** -1 (left) … 1 (right) */
  pan: number
  /** 0–1 of the note sent to the track's reverb and chorus */
  reverbSend: number
  chorusSend: number
  /** volume envelope, SoundFont 2.04 8.1.2: seconds, sustain as 0–1 of the 100 dB range */
  volAttack: number
  volSustain: number
  volRelease: number
  modAttack: number
  /** 0–1: how far the modulation envelope falls after its peak */
  modSustain: number
  /** low-pass cutoff in absolute cents (13500 ≈ 20 kHz = open), resonance in centibels */
  filterFc: number
  filterQ: number
  /** how far (cents) the modulation envelope moves the cutoff and the pitch at its peak */
  modEnvToFilterFc: number
  modEnvToPitch: number
  vibLfo: Lfo | null
  modLfo: ModLfo | null
}

/** One zone on one key: the sample, its pitch and the key-scaled envelope times. */
export interface KeyInfo {
  sample: Int16Array | Float32Array
  sampleRate: number
  basePlaybackRate: number
  /** sample frames cut off at the start (startAddrs offsets) and added at the end (≤ 0) */
  start: number
  end: number
  loopStart: number
  loopEnd: number
  volHold: number
  volDecay: number
  modHold: number
  modDecay: number
  velLo: number
  velHi: number
  zone: ZoneParams
  /** the key's next zone (other velocities, stereo halves, stacked layers), if any */
  next?: KeyInfo
}

/** A preset's keys (sparse: only the keys its zones cover). */
export type PresetKeys = KeyInfo[] & { name?: string }

/** Banks by bank number (0 melodic, 128 drums), each preset by program number. */
export type Banks = PresetKeys[][]

/** What `noteOn` hands the sample player for one voice of a note. */
export interface SynthNote extends ZoneParams {
  buffer: AudioBuffer
  playBackRate: number
  loopStart: number
  loopEnd: number
  volHold: number
  volDecay: number
  modHold: number
  modDecay: number
}

const DRUM_PROGRAM = 9
const DRUM_BANK = 128
// Like FluidSynth: E-mu hardware applied 0.4 of initialAttenuation, and banks are voiced for that.
const ATTENUATION_FACTOR = 0.4
/** initialFilterFc at or above this (≈ 20 kHz) leaves the sound unfiltered */
export const FILTER_OPEN = 13500
/** cents the cutoff drops from velocity 127 to 0 (SoundFont 2.04, 8.4.2) */
const VELOCITY_TO_CUTOFF = 2400

/** An instrument zone with its instrument's global zone filled in, plus its preset zone's offsets. */
interface ZoneGenerators {
  local: Generators
  /** preset-level generators: added to the instrument's values (SoundFont 2.04, 9.4) */
  offsets: Generators
  keyLo: number
  keyHi: number
  velLo: number
  velHi: number
}

function amountOf(generator: Generators, name: string, fallback = 0): number {
  // a 0 amount is kept: only a missing generator falls back
  return generator[name] ? generator[name]!.amount! : fallback
}

/** A generator's value for a zone: the instrument's (or the default) plus the preset's offset. */
function valueOf(zone: ZoneGenerators, name: string, fallback = 0): number {
  return amountOf(zone.local, name, fallback) + amountOf(zone.offsets, name)
}

/** A sample address offset: coarse (×32768) plus fine, e.g. `startAddrs`. */
function addressOffset(generator: Generators, name: string): number {
  return amountOf(generator, `${name}CoarseOffset`) * 32768 + amountOf(generator, `${name}Offset`)
}

const seconds = (timecents: number) => 2 ** (timecents / 1200)
const hertz = (absoluteCents: number) => 8.176 * 2 ** (absoluteCents / 1200)
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))

function lfosOf(zone: ZoneGenerators): Pick<ZoneParams, 'vibLfo' | 'modLfo'> {
  const vibToPitch = valueOf(zone, 'vibLfoToPitch')
  const modLfo: ModLfo = {
    delay: seconds(valueOf(zone, 'delayModLFO', -12000)),
    frequency: hertz(valueOf(zone, 'freqModLFO')),
    toPitch: valueOf(zone, 'modLfoToPitch'),
    toFilterFc: valueOf(zone, 'modLfoToFilterFc'),
    toVolume: valueOf(zone, 'modLfoToVolume'),
  }
  return {
    vibLfo: vibToPitch
      ? {
          delay: seconds(valueOf(zone, 'delayVibLFO', -12000)),
          frequency: hertz(valueOf(zone, 'freqVibLFO')),
          toPitch: vibToPitch,
        }
      : null,
    modLfo: modLfo.toPitch || modLfo.toFilterFc || modLfo.toVolume ? modLfo : null,
  }
}

/** The key-independent part of a zone. */
function zoneParams(zone: ZoneGenerators): ZoneParams {
  return {
    gain: 10 ** ((-Math.max(0, valueOf(zone, 'initialAttenuation')) * ATTENUATION_FACTOR) / 200),
    loop: (amountOf(zone.local, 'sampleModes') & 1) === 1,
    exclusiveClass: amountOf(zone.local, 'exclusiveClass'),
    pan: clamp(valueOf(zone, 'pan') / 500, -1, 1),
    reverbSend: clamp(valueOf(zone, 'reverbEffectsSend') / 1000, 0, 1),
    chorusSend: clamp(valueOf(zone, 'chorusEffectsSend') / 1000, 0, 1),
    volAttack: seconds(valueOf(zone, 'attackVolEnv', -12000)),
    volSustain: clamp(valueOf(zone, 'sustainVolEnv') / 1000, 0, 1),
    volRelease: seconds(valueOf(zone, 'releaseVolEnv', -12000)),
    modAttack: seconds(valueOf(zone, 'attackModEnv', -12000)),
    modSustain: clamp(valueOf(zone, 'sustainModEnv') / 1000, 0, 1),
    filterFc: valueOf(zone, 'initialFilterFc', FILTER_OPEN),
    filterQ: valueOf(zone, 'initialFilterQ'),
    modEnvToFilterFc: valueOf(zone, 'modEnvToFilterFc'),
    modEnvToPitch: valueOf(zone, 'modEnvToPitch'),
    ...lfosOf(zone),
  }
}

/** A zone's time generator on a key: keynumTo… scales it per key around middle C (60). */
function keyScaled(zone: ZoneGenerators, name: string, perKey: string, key: number): number {
  return seconds(valueOf(zone, name, -12000) + valueOf(zone, perKey) * (60 - key))
}

/** Adds the keys one instrument zone covers to `preset` (after the zones already there). */
function addZoneKeys(
  zone: ZoneGenerators,
  preset: PresetKeys,
  samples: (Int16Array | Float32Array)[],
  sampleHeaders: SampleHeader[],
): void {
  const generator = zone.local
  if (generator.sampleID == null) return
  const sampleId = amountOf(generator, 'sampleID')
  // an SF3 sample the browser couldn't decode: the key falls back to the preset's other zones
  if (!samples[sampleId]?.length) return
  const params = zoneParams(zone)
  const header = sampleHeaders[sampleId]
  const tune = valueOf(zone, 'coarseTune') + valueOf(zone, 'fineTune') / 100
  const scale = valueOf(zone, 'scaleTuning', 100) / 100
  const rootKey = amountOf(generator, 'overridingRootKey', header.originalPitch)
  const start = Math.max(0, addressOffset(generator, 'startAddrs'))

  for (let key = zone.keyLo; key <= zone.keyHi; key += 1) {
    const info: KeyInfo = {
      sample: samples[sampleId],
      sampleRate: header.sampleRate,
      basePlaybackRate: 2 ** (((key - rootKey) * scale + tune + header.pitchCorrection / 100) / 12),
      start,
      end: Math.min(0, addressOffset(generator, 'endAddrs')),
      loopStart: header.startLoop + addressOffset(generator, 'startloopAddrs') - start,
      loopEnd: header.endLoop + addressOffset(generator, 'endloopAddrs') - start,
      // key-scaled hold and decay: higher notes die away faster (guitars, pianos)
      volHold: keyScaled(zone, 'holdVolEnv', 'keynumToVolEnvHold', key),
      volDecay: keyScaled(zone, 'decayVolEnv', 'keynumToVolEnvDecay', key),
      modHold: keyScaled(zone, 'holdModEnv', 'keynumToModEnvHold', key),
      modDecay: keyScaled(zone, 'decayModEnv', 'keynumToModEnvDecay', key),
      velLo: zone.velLo,
      velHi: zone.velHi,
      zone: params,
    }
    let last = preset[key]
    if (last == null) {
      preset[key] = info
      continue
    }
    while (last.next) last = last.next
    last.next = info
  }
}

/** The global zone (the first zone, when it has no `terminal` generator) and the other zones. */
function splitGlobal(zones: Zone[], terminal: string): { global: Generators | null; local: Zone[] } {
  const first = zones[0]
  if (first && first.generator[terminal] == null) return { global: first.generator, local: zones.slice(1) }
  return { global: null, local: zones }
}

function rangeOf(generator: Generators, name: 'keyRange' | 'velRange'): [number, number] {
  const range = generator[name]
  return range ? [range.lo ?? 0, range.hi ?? 127] : [0, 127]
}

/** Every instrument zone a preset plays, with global zones merged and ranges intersected. */
function presetZones(preset: Preset, instruments: Instrument[]): ZoneGenerators[] {
  const result: ZoneGenerators[] = []
  const presetSplit = splitGlobal(preset.info, 'instrument')
  for (const presetZone of presetSplit.local) {
    const instrumentId = presetZone.generator.instrument?.amount
    if (instrumentId == null) continue
    const instrument = instruments[instrumentId]
    if (instrument == null || instrument.name.replace(/\0*$/, '') === 'EOI') continue
    const offsets: Generators = { ...presetSplit.global, ...presetZone.generator }
    const [presetKeyLo, presetKeyHi] = rangeOf(offsets, 'keyRange')
    const [presetVelLo, presetVelHi] = rangeOf(offsets, 'velRange')
    const instrumentSplit = splitGlobal(instrument.info, 'sampleID')
    for (const zone of instrumentSplit.local) {
      // the parser gives every zone a 0–127 keyRange, so the global zone's range must not overwrite it
      const local: Generators = { ...instrumentSplit.global, ...zone.generator }
      const [keyLo, keyHi] = rangeOf(local, 'keyRange')
      const [velLo, velHi] = rangeOf(local, 'velRange')
      const merged: ZoneGenerators = {
        local,
        offsets,
        keyLo: Math.max(keyLo, presetKeyLo),
        keyHi: Math.min(keyHi, presetKeyHi),
        velLo: Math.max(velLo, presetVelLo),
        velHi: Math.min(velHi, presetVelHi),
      }
      if (merged.keyLo <= merged.keyHi && merged.velLo <= merged.velHi) result.push(merged)
    }
  }
  return result
}

/** Builds banks from parsed SoundFont data (samples already decoded for SF3). */
export function buildBanksFrom(data: ReturnType<typeof parseSoundFont>): Banks {
  const presets = createPresets(data)
  const instruments = createInstruments(data)
  const banks: Banks = []
  for (const preset of presets) {
    const zones = presetZones(preset, instruments)
    if (!zones.length) continue
    banks[preset.header.bank] ??= []
    const keys: PresetKeys = []
    keys.name = preset.name
    banks[preset.header.bank][preset.header.preset] = keys
    for (const zone of zones) addZoneKeys(zone, keys, data.samples, data.sampleHeaders)
  }
  return banks
}

/** Parses a SoundFont 2 file into banks of presets of keys. */
export function buildBanks(input: Uint8Array): Banks {
  return buildBanksFrom(parseSoundFont(input))
}

/**
 * The zones that sound for a key at a velocity: all whose velocity range covers it (stereo
 * halves and stacked layers sound together); the first zone when none does.
 */
export function voicesFor(first: KeyInfo, velocity: number): KeyInfo[] {
  const voices: KeyInfo[] = []
  for (let layer: KeyInfo | undefined = first; layer; layer = layer.next) {
    if (velocity >= layer.velLo && velocity <= layer.velHi) voices.push(layer)
  }
  return voices.length ? voices : [first]
}

/** PCM (Int16 or already float) to the -1…1 floats an AudioBuffer holds. */
function toFloat32(sample: Int16Array | Float32Array): Float32Array {
  if (sample instanceof Float32Array) return sample
  const output = new Float32Array(sample.length)
  for (let i = 0; i < sample.length; i += 1) output[i] = sample[i] / 0x7fff
  return output
}

/** AudioBuffers per sample and cut (keys share samples; the cache lives as long as the samples). */
const sampleBuffers = new WeakMap<Int16Array | Float32Array, Map<string, AudioBuffer>>()

function keyBuffer(key: KeyInfo): AudioBuffer {
  // Converting the sample is the expensive part of a note; each sample's buffer is built once.
  let cuts = sampleBuffers.get(key.sample)
  if (cuts == null) {
    cuts = new Map()
    sampleBuffers.set(key.sample, cuts)
  }
  const cut = `${key.start}:${key.end}:${key.sampleRate}`
  let buffer = cuts.get(cut)
  if (buffer == null) {
    const sample = toFloat32(key.sample).subarray(
      Math.min(key.start, key.sample.length - 1),
      key.sample.length + key.end,
    )
    buffer = audioGraph.context.createBuffer(1, Math.max(1, sample.length), key.sampleRate)
    buffer.getChannelData(0).set(sample)
    cuts.set(cut, buffer)
  }
  return buffer
}

/** One voice of a note: a zone on a key at a velocity. */
function voiceOf(keyInfo: KeyInfo, velocity: number, drums: boolean): SynthNote {
  const zone = keyInfo.zone
  const filtered = zone.filterFc < FILTER_OPEN || zone.modEnvToFilterFc !== 0
  return {
    ...zone,
    buffer: keyBuffer(keyInfo),
    playBackRate: keyInfo.basePlaybackRate,
    loop: zone.loop && !drums,
    loopStart: keyInfo.loopStart / keyInfo.sampleRate,
    loopEnd: keyInfo.loopEnd / keyInfo.sampleRate,
    volHold: keyInfo.volHold,
    volDecay: keyInfo.volDecay,
    modHold: keyInfo.modHold,
    modDecay: keyInfo.modDecay,
    // SF2 default modulator: softer notes are darker (only where the zone uses its filter)
    filterFc: zone.filterFc - (filtered ? VELOCITY_TO_CUTOFF * (1 - velocity / 127) : 0),
  }
}

export const synth = {
  bank: 0,
  /** set by `loadSoundFontBytes` */
  bankSet: [] as Banks,

  /**
   * The voices for a key of a program (9 = drums: bank 128, preset 0): one per zone that
   * sounds, or null while the SoundFont isn't loaded or has no such key.
   */
  noteOn(program: number, key: number, velocity: number, channel = 0): SynthNote[] | null {
    const isDrums = program === DRUM_PROGRAM
    const bank = isDrums ? DRUM_BANK : this.bank
    const instrumentIndex = isDrums ? 0 : program
    const keys = this.bankSet[bank]?.[instrumentIndex]
    if (!keys) {
      console.warn('Instrument not found! program:', program, 'bank:', bank, 'index:', instrumentIndex)
      return null
    }
    if (!keys[key]) {
      console.warn('Instrument key not found!', program, key)
      return null
    }
    return voicesFor(keys[key], velocity).map((keyInfo) =>
      voiceOf(keyInfo, velocity, channel === DRUM_PROGRAM),
    )
  },
}
