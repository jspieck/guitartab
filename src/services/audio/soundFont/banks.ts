/*! Based on the JavaScript SoundFont 2 Parser. Copyright 2013-2015
imaya/GREE Inc and Colin Clark. Licensed under the MIT License. */

import {
  createInstruments,
  createPresets,
  parseSoundFont,
  type Generators,
  type Instrument,
  type Preset,
  type SampleHeader,
  type SoundFontData,
  type Zone,
} from './parser'
import { FILTER_OPEN, type Banks, type KeyInfo, type ModLfo, type PresetKeys, type ZoneParams } from './synth'

/**
 * Builds the synth's banks from parsed SoundFont data: per preset and key the zones that
 * sound, with their samples. Part of the lazy `soundfont` chunk (with the parser and the
 * loader); playback at startup only needs `synth.ts`.
 */

// Like FluidSynth: E-mu hardware applied 0.4 of initialAttenuation, and banks are voiced for that.
const ATTENUATION_FACTOR = 0.4

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

/** The presets and instruments of a SoundFont, built once and reused for every rebuild. */
export interface BankStructure {
  presets: Preset[]
  instruments: Instrument[]
}

export function bankStructure(data: SoundFontData): BankStructure {
  return { presets: createPresets(data), instruments: createInstruments(data) }
}

/** The keys of one preset, from the samples loaded so far (null when it plays no zone). */
export function buildPresetKeys(
  preset: Preset,
  structure: BankStructure,
  data: SoundFontData,
): PresetKeys | null {
  const zones = presetZones(preset, structure.instruments)
  if (!zones.length) return null
  const keys: PresetKeys = []
  keys.name = preset.name
  for (const zone of zones) addZoneKeys(zone, keys, data.samples, data.sampleHeaders)
  return keys
}

/** The samples a preset plays (to fetch them before it can sound). */
export function presetSampleIds(preset: Preset, structure: BankStructure): number[] {
  const ids = new Set<number>()
  for (const zone of presetZones(preset, structure.instruments)) {
    const id = zone.local.sampleID?.amount
    if (id != null) ids.add(id)
  }
  return [...ids]
}

/** Builds banks from parsed SoundFont data (samples already decoded for SF3). */
export function buildBanksFrom(data: SoundFontData, structure = bankStructure(data)): Banks {
  const banks: Banks = []
  for (const preset of structure.presets) {
    const keys = buildPresetKeys(preset, structure, data)
    if (!keys) continue
    banks[preset.header.bank] ??= []
    banks[preset.header.bank][preset.header.preset] = keys
  }
  return banks
}

/** Parses a SoundFont 2 file into banks of presets of keys. */
export function buildBanks(input: Uint8Array): Banks {
  return buildBanksFrom(parseSoundFont(input))
}
