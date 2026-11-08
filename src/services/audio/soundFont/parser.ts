/*! Based on the JavaScript SoundFont 2 Parser. Copyright 2013-2015
imaya/GREE Inc and Colin Clark. Licensed under the MIT License. */

import { fourCC, parseRiff, type RiffChunk } from './riff'

/**
 * Reads a SoundFont 2 file into plain data (preset and instrument headers, their zones'
 * generators, the samples). Runs in node: `buildBanks` in `banks.ts` turns it into what
 * playback looks up per program and key.
 */

export interface PresetHeader {
  presetName: string
  preset: number
  bank: number
  presetBagIndex: number
  library: number
  genre: number
  morphology: number
}

export interface InstrumentHeader {
  instrumentName: string
  instrumentBagIndex: number
}

interface Bag {
  generatorIndex: number
  modulatorIndex: number
}

export interface SampleHeader {
  sampleName: string
  startLoop: number
  endLoop: number
  sampleRate: number
  originalPitch: number
  pitchCorrection: number
  sampleLink: number
  sampleType: number
}

/** A generator's (or modulator's) amount; key and velocity ranges have lo/hi instead. */
export interface GeneratorValue {
  amount?: number
  lo?: number
  hi?: number
  code?: number
}

interface GeneratorEntry {
  /** null for an operator the table doesn't name */
  type: string | null
  value: GeneratorValue
}

/** A zone's generators by name; every zone has a key range (0–127 unless it sets one). */
export type Generators = Partial<Record<string, GeneratorValue>> & { keyRange: GeneratorValue }

export interface Zone {
  generator: Generators
  modulator: Generators
}

export interface Preset {
  name: string
  info: Zone[]
  header: PresetHeader
  /** index into the instruments, from the first zone that names one */
  instrument: number | null
}

export interface Instrument {
  name: string
  info: Zone[]
}

export interface SoundFontData {
  presetHeaders: PresetHeader[]
  presetBags: Bag[]
  presetModulators: GeneratorEntry[]
  presetGenerators: GeneratorEntry[]
  instruments: InstrumentHeader[]
  instrumentBags: Bag[]
  instrumentModulators: GeneratorEntry[]
  instrumentGenerators: GeneratorEntry[]
  sampleHeaders: SampleHeader[]
  /** PCM per sample header (an SF3 sample is empty until decoded) */
  samples: (Int16Array | Float32Array)[]
  /** SF3: the Ogg Vorbis bytes of each compressed sample (null for PCM ones) */
  compressed: (Uint8Array | null)[]
  /** where each sample's bytes sit in the sample data (smpl chunk): [first byte, end byte) */
  sampleRanges: [number, number][]
}

/** SoundFont 2.04, section 8.1.2; null marks unused operator numbers. */
const GENERATOR_NAMES: (string | null)[] = [
  'startAddrsOffset',
  'endAddrsOffset',
  'startloopAddrsOffset',
  'endloopAddrsOffset',
  'startAddrsCoarseOffset',
  'modLfoToPitch',
  'vibLfoToPitch',
  'modEnvToPitch',
  'initialFilterFc',
  'initialFilterQ',
  'modLfoToFilterFc',
  'modEnvToFilterFc',
  'endAddrsCoarseOffset',
  'modLfoToVolume',
  null, // 14
  'chorusEffectsSend',
  'reverbEffectsSend',
  'pan',
  null,
  null,
  null, // 18, 19, 20
  'delayModLFO',
  'freqModLFO',
  'delayVibLFO',
  'freqVibLFO',
  'delayModEnv',
  'attackModEnv',
  'holdModEnv',
  'decayModEnv',
  'sustainModEnv',
  'releaseModEnv',
  'keynumToModEnvHold',
  'keynumToModEnvDecay',
  'delayVolEnv',
  'attackVolEnv',
  'holdVolEnv',
  'decayVolEnv',
  'sustainVolEnv',
  'releaseVolEnv',
  'keynumToVolEnvHold',
  'keynumToVolEnvDecay',
  'instrument',
  null, // 42
  'keyRange',
  'velRange',
  'startloopAddrsCoarseOffset',
  'keynum',
  'velocity',
  'initialAttenuation',
  null, // 49
  'endloopAddrsCoarseOffset',
  'coarseTune',
  'fineTune',
  'sampleID',
  'sampleModes',
  null, // 55
  'scaleTuning',
  'exclusiveClass',
  'overridingRootKey',
]

const RANGE_GENERATORS = new Set(['keyRange', 'velRange', 'keynum', 'velocity'])

const u16 = (data: Uint8Array, ip: number) => data[ip] | (data[ip + 1] << 8)
const s16 = (data: Uint8Array, ip: number) => data[ip] | (((data[ip + 1] << 8) << 16) >> 16)
const u32 = (data: Uint8Array, ip: number) =>
  (data[ip] | (data[ip + 1] << 8) | (data[ip + 2] << 16) | (data[ip + 3] << 24)) >>> 0
const name20 = (data: Uint8Array, ip: number) => String.fromCharCode(...data.subarray(ip, ip + 20))

function expectType(chunk: RiffChunk, type: string): void {
  if (chunk.type !== type) throw new Error(`invalid chunk type: ${chunk.type}`)
}

/** A LIST chunk's sub-chunks after checking its four-letter signature. */
function listChunks(input: Uint8Array, chunk: RiffChunk, signature: string): RiffChunk[] {
  expectType(chunk, 'LIST')
  const found = fourCC(input, chunk.offset)
  if (found !== signature) throw new Error(`invalid signature: ${found}`)
  return parseRiff(input, { index: chunk.offset + 4, length: chunk.size - 4 })
}

/** One generator per 4 bytes (operator, amount); a modulator record is 10 bytes around it. */
function readGenerators(data: Uint8Array, chunk: RiffChunk, modulators: boolean): GeneratorEntry[] {
  const output: GeneratorEntry[] = []
  const end = chunk.offset + chunk.size
  let ip = chunk.offset
  while (ip < end) {
    if (modulators) ip += 2 // source operator
    const code = u16(data, ip)
    ip += 2
    const type = GENERATOR_NAMES[code] ?? null
    if (type == null) {
      output.push({ type, value: { code, amount: s16(data, ip), lo: data[ip], hi: data[ip + 1] } })
    } else if (RANGE_GENERATORS.has(type)) {
      output.push({ type, value: { lo: data[ip], hi: data[ip + 1] } })
    } else {
      output.push({ type, value: { amount: s16(data, ip) } })
    }
    ip += 2
    if (modulators) ip += 4 // amount source and transform operators
  }
  return output
}

function readBags(data: Uint8Array, chunk: RiffChunk, type: string): Bag[] {
  expectType(chunk, type)
  const bags: Bag[] = []
  for (let ip = chunk.offset, end = chunk.offset + chunk.size; ip < end; ip += 4) {
    bags.push({ generatorIndex: u16(data, ip), modulatorIndex: u16(data, ip + 2) })
  }
  return bags
}

function readPresetHeaders(data: Uint8Array, chunk: RiffChunk): PresetHeader[] {
  expectType(chunk, 'phdr')
  const headers: PresetHeader[] = []
  for (let ip = chunk.offset, end = chunk.offset + chunk.size; ip < end; ip += 38) {
    headers.push({
      presetName: name20(data, ip),
      preset: u16(data, ip + 20),
      bank: u16(data, ip + 22),
      presetBagIndex: u16(data, ip + 24),
      library: u32(data, ip + 26),
      genre: u32(data, ip + 30),
      morphology: u32(data, ip + 34),
    })
  }
  return headers
}

function readInstruments(data: Uint8Array, chunk: RiffChunk): InstrumentHeader[] {
  expectType(chunk, 'inst')
  const instruments: InstrumentHeader[] = []
  for (let ip = chunk.offset, end = chunk.offset + chunk.size; ip < end; ip += 22) {
    instruments.push({ instrumentName: name20(data, ip), instrumentBagIndex: u16(data, ip + 20) })
  }
  return instruments
}

/**
 * Samples below 22.05 kHz are stretched by repeating each frame (the sample rate and loop
 * points double with it) until they reach it.
 */
export function upsampleToMinimumRate(
  sample: Int16Array,
  sampleRate: number,
): { sample: Int16Array; multiply: number } {
  let output = sample
  let rate = sampleRate
  let multiply = 1
  while (rate < 22050) {
    const doubled = new Int16Array(output.length * 2)
    for (let i = 0; i < output.length; i += 1) {
      doubled[2 * i] = output[i]
      doubled[2 * i + 1] = output[i]
    }
    output = doubled
    rate *= 2
    multiply *= 2
  }
  return { sample: output, multiply }
}

/** sampleType bit of SF3 (MuseScore's SoundFont 3): the sample is an Ogg Vorbis stream */
export const COMPRESSED_SAMPLE = 0x10

/**
 * The sample headers and where each sample's bytes sit in the sample data (`smpl`), as
 * [first byte, end byte). Loop points are made relative to the sample's start.
 */
function readSampleHeaders(
  data: Uint8Array,
  chunk: RiffChunk,
): Pick<SoundFontData, 'sampleHeaders' | 'sampleRanges'> {
  expectType(chunk, 'shdr')
  const sampleHeaders: SampleHeader[] = []
  const sampleRanges: [number, number][] = []
  for (let ip = chunk.offset, end = chunk.offset + chunk.size; ip < end; ip += 46) {
    const start = u32(data, ip + 20)
    const sampleEnd = u32(data, ip + 24)
    const sampleType = u16(data, ip + 44)
    const compressed = (sampleType & COMPRESSED_SAMPLE) !== 0
    sampleHeaders.push({
      sampleName: name20(data, ip),
      // SF3: start/end are byte offsets of the Ogg stream; the loop points already count
      // decoded frames from the sample's start. PCM: frames, loop points absolute.
      startLoop: u32(data, ip + 28) - (compressed ? 0 : start),
      endLoop: u32(data, ip + 32) - (compressed ? 0 : start),
      sampleRate: u32(data, ip + 36),
      originalPitch: data[ip + 40],
      pitchCorrection: (data[ip + 41] << 24) >> 24,
      sampleLink: u16(data, ip + 42),
      sampleType,
    })
    const bytesPerFrame = compressed ? 1 : 2
    sampleRanges.push([start * bytesPerFrame, Math.max(start, sampleEnd) * bytesPerFrame])
  }
  return { sampleHeaders, sampleRanges }
}

/**
 * Puts sample `index`'s bytes (exactly its `sampleRanges` entry) into `data`: an SF3 stream
 * into `compressed` (decoded later, `decodeCompressedSamples`), PCM into `samples`.
 */
export function setSampleBytes(data: SoundFontData, index: number, bytes: Uint8Array): void {
  const header = data.sampleHeaders[index]
  if (header.sampleType & COMPRESSED_SAMPLE) {
    data.compressed[index] = bytes.slice()
    data.samples[index] = new Int16Array(0)
    return
  }
  data.compressed[index] = null
  // copied, so the sample doesn't keep the whole file alive (and starts on an even byte)
  let sample = new Int16Array(new Uint8Array(bytes.subarray(0, bytes.length & ~1)).buffer)
  if (header.sampleRate > 0) {
    const adjusted = upsampleToMinimumRate(sample, header.sampleRate)
    sample = adjusted.sample
    header.sampleRate *= adjusted.multiply
    header.startLoop *= adjusted.multiply
    header.endLoop *= adjusted.multiply
  }
  data.samples[index] = sample
}

/** The preset data (pdta) with no samples loaded yet. */
function readPresetData(input: Uint8Array, pdta: RiffChunk): SoundFontData {
  const pdtaChunks = listChunks(input, pdta, 'pdta')
  if (pdtaChunks.length !== 9) throw new Error('invalid pdta chunk')
  const [phdr, pbag, pmod, pgen, inst, ibag, imod, igen, shdr] = pdtaChunks
  expectType(pmod, 'pmod')
  expectType(pgen, 'pgen')
  expectType(imod, 'imod')
  expectType(igen, 'igen')
  const samples = readSampleHeaders(input, shdr)
  return {
    presetHeaders: readPresetHeaders(input, phdr),
    presetBags: readBags(input, pbag, 'pbag'),
    presetModulators: readGenerators(input, pmod, true),
    presetGenerators: readGenerators(input, pgen, false),
    instruments: readInstruments(input, inst),
    instrumentBags: readBags(input, ibag, 'ibag'),
    instrumentModulators: readGenerators(input, imod, true),
    instrumentGenerators: readGenerators(input, igen, false),
    ...samples,
    samples: samples.sampleHeaders.map(() => new Int16Array(0)),
    compressed: samples.sampleHeaders.map(() => null),
  }
}

/**
 * Reads only the preset data of a SoundFont: `input` is its pdta LIST chunk (from its
 * 8-byte header on), as the app fetches it first with a range request. Every sample is empty
 * until `setSampleBytes` fills it.
 */
export function parsePresetData(input: Uint8Array): SoundFontData {
  const chunks = parseRiff(input, { padding: false })
  if (!chunks.length) throw new Error('no pdta chunk')
  return readPresetData(input, chunks[0])
}

export function parseSoundFont(input: Uint8Array): SoundFontData {
  const riff = parseRiff(input)
  if (riff.length !== 1) throw new Error('wrong chunk length')
  const [root] = riff
  expectType(root, 'RIFF')
  const signature = fourCC(input, root.offset)
  if (signature !== 'sfbk') throw new Error(`invalid signature: ${signature}`)
  const lists = parseRiff(input, { index: root.offset + 4, length: root.size - 4 })
  if (lists.length !== 3) throw new Error('invalid sfbk structure')
  const [info, sdta, pdta] = lists

  listChunks(input, info, 'INFO')
  const samplingChunks = listChunks(input, sdta, 'sdta')
  if (samplingChunks.length !== 1) throw new Error('sdta must hold exactly one sample chunk')
  const data = readPresetData(input, pdta)
  const sampleData = input.subarray(samplingChunks[0].offset)
  data.sampleRanges.forEach(([start, end], index) =>
    setSampleBytes(data, index, sampleData.subarray(start, end)),
  )
  return data
}

/** The named generators of entries [start, end); later entries win. */
function collect(entries: GeneratorEntry[], start: number, end: number): Generators {
  const generators: Generators = { keyRange: { hi: 127, lo: 0 } }
  for (let i = start; i < end; i += 1) {
    const { type, value } = entries[i]
    if (type != null) generators[type] = value
  }
  return generators
}

/** Zones of the bags [start, end); each bag's entries run to the next bag's first one. */
function zones(
  bags: Bag[],
  start: number,
  end: number,
  generators: GeneratorEntry[],
  modulators: GeneratorEntry[],
): Zone[] {
  const result: Zone[] = []
  for (let j = start; j < end; j += 1) {
    const next = bags[j + 1]
    result.push({
      generator: collect(generators, bags[j].generatorIndex, next ? next.generatorIndex : generators.length),
      modulator: collect(modulators, bags[j].modulatorIndex, next ? next.modulatorIndex : modulators.length),
    })
  }
  return result
}

export function createInstruments(data: SoundFontData): Instrument[] {
  return data.instruments.map((instrument, i) => {
    const next = data.instruments[i + 1]
    const end = next ? next.instrumentBagIndex : data.instrumentBags.length
    return {
      name: instrument.instrumentName,
      info: zones(
        data.instrumentBags,
        instrument.instrumentBagIndex,
        end,
        data.instrumentGenerators,
        data.instrumentModulators,
      ),
    }
  })
}

export function createPresets(data: SoundFontData): Preset[] {
  return data.presetHeaders.map((header, i) => {
    const next = data.presetHeaders[i + 1]
    const end = next ? next.presetBagIndex : data.presetBags.length
    const info = zones(
      data.presetBags,
      header.presetBagIndex,
      end,
      data.presetGenerators,
      data.presetModulators,
    )
    const named = info.find((zone) => zone.generator.instrument != null || zone.modulator.instrument != null)
    const instrument = named ? (named.generator.instrument ?? named.modulator.instrument)!.amount! : null
    return { name: header.presetName, info, header, instrument }
  })
}
