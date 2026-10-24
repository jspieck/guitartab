// Writes a tiny but valid SoundFont 2 file: one looped sine sample, one instrument and
// presets 0â€“127 in bank 0 (melodic) and bank 128 (drums), all pointing at it.
// CI uses it in place of the real SF2, which is not in the repository (public/audio/README.txt),
// so the e2e tests that wait for `data-soundfont-ready` can run.
//
//   node scripts/make-test-soundfont.mjs [output]   (default: public/audio/Roland SC-55Edited.sf2)

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAMPLE_RATE = 44100
const ROOT_KEY = 69 // A4 = 440 Hz
const SAMPLE_FRAMES = 100 // exactly 440 Hz periods of a 44.1 kHz sine: 100.2 frames â‰ˆ one loop
const PAD_FRAMES = 46 // the spec asks for 46 zero frames after each sample

// Generator operators (SoundFont 2.04, section 8.1.2)
const GEN = { keyRange: 43, instrument: 41, sampleModes: 54, overridingRootKey: 58, sampleID: 53 }

function ascii(text, length) {
  const bytes = new Uint8Array(length)
  for (let index = 0; index < Math.min(text.length, length - 1); index += 1)
    bytes[index] = text.charCodeAt(index)
  return bytes
}

class Bytes {
  constructor() {
    this.parts = []
  }
  u8(value) {
    this.parts.push(Uint8Array.of(value & 0xff))
    return this
  }
  u16(value) {
    this.parts.push(Uint8Array.of(value & 0xff, (value >> 8) & 0xff))
    return this
  }
  u32(value) {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setUint32(0, value, true)
    this.parts.push(b)
    return this
  }
  raw(bytes) {
    this.parts.push(bytes)
    return this
  }
  build() {
    const out = new Uint8Array(this.parts.reduce((sum, part) => sum + part.length, 0))
    let offset = 0
    for (const part of this.parts) {
      out.set(part, offset)
      offset += part.length
    }
    return out
  }
}

function chunk(id, body) {
  const bytes = new Bytes().raw(ascii(id, 5).subarray(0, 4)).u32(body.length).raw(body)
  if (body.length % 2) bytes.u8(0)
  return bytes.build()
}

function list(type, chunks) {
  return chunk('LIST', new Bytes().raw(ascii(type, 5).subarray(0, 4)).raw(concat(chunks)).build())
}

function concat(parts) {
  const bytes = new Bytes()
  for (const part of parts) bytes.raw(part)
  return bytes.build()
}

function sampleData() {
  const frames = new Int16Array(SAMPLE_FRAMES + PAD_FRAMES)
  for (let index = 0; index < SAMPLE_FRAMES; index += 1) {
    frames[index] = Math.round(Math.sin((2 * Math.PI * index) / SAMPLE_FRAMES) * 12000)
  }
  return new Uint8Array(frames.buffer)
}

function generator(operator, amount) {
  return new Bytes().u16(operator).u16(amount).build()
}

function keyRange(lo, hi) {
  return new Bytes().u16(GEN.keyRange).u8(lo).u8(hi).build()
}

function buildPdta(sampleRate) {
  const presets = []
  for (const bank of [0, 128]) {
    for (let program = 0; program < 128; program += 1) presets.push({ bank, program })
  }

  // One preset zone per preset: keyRange 0â€“127, instrument 0.
  const phdr = new Bytes()
  const pbag = new Bytes()
  const pgen = new Bytes()
  presets.forEach(({ bank, program }, index) => {
    phdr
      .raw(ascii(`Test ${bank}:${program}`, 20))
      .u16(program)
      .u16(bank)
      .u16(index)
      .u32(0)
      .u32(0)
      .u32(0)
    pbag.u16(index * 2).u16(0)
    pgen.raw(keyRange(0, 127)).raw(generator(GEN.instrument, 0))
  })
  phdr.raw(ascii('EOP', 20)).u16(0).u16(0).u16(presets.length).u32(0).u32(0).u32(0)
  pbag.u16(presets.length * 2).u16(0)
  pgen.u16(0).u16(0)

  const inst = new Bytes().raw(ascii('Sine', 20)).u16(0).raw(ascii('EOI', 20)).u16(1)
  const ibag = new Bytes().u16(0).u16(0).u16(4).u16(0)
  const igen = new Bytes()
    .raw(keyRange(0, 127))
    .raw(generator(GEN.sampleModes, 1)) // loop continuously
    .raw(generator(GEN.overridingRootKey, ROOT_KEY))
    .raw(generator(GEN.sampleID, 0))
    .u16(0)
    .u16(0)
  const emptyModulators = new Uint8Array(10) // terminal record only

  const shdr = new Bytes()
    .raw(ascii('Sine', 20))
    .u32(0)
    .u32(SAMPLE_FRAMES)
    .u32(0)
    .u32(SAMPLE_FRAMES)
    .u32(sampleRate)
    .u8(ROOT_KEY)
    .u8(0)
    .u16(0)
    .u16(1)
    .raw(ascii('EOS', 20))
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .u8(0)
    .u8(0)
    .u16(0)
    .u16(0)

  return list('pdta', [
    chunk('phdr', phdr.build()),
    chunk('pbag', pbag.build()),
    chunk('pmod', emptyModulators),
    chunk('pgen', pgen.build()),
    chunk('inst', inst.build()),
    chunk('ibag', ibag.build()),
    chunk('imod', emptyModulators),
    chunk('igen', igen.build()),
    chunk('shdr', shdr.build()),
  ])
}

/** `sampleRate` lets tests build a low-rate sample (the parser stretches those). */
export function buildTestSoundFont({ sampleRate = SAMPLE_RATE } = {}) {
  const info = list('INFO', [
    chunk('ifil', new Bytes().u16(2).u16(1).build()),
    chunk('isng', ascii('EMU8000', 8)),
    chunk('INAM', ascii('GuitarTab test SoundFont', 26)),
  ])
  const sdta = list('sdta', [chunk('smpl', sampleData())])
  const body = new Bytes()
    .raw(ascii('sfbk', 5).subarray(0, 4))
    .raw(info)
    .raw(sdta)
    .raw(buildPdta(sampleRate))
    .build()
  return chunk('RIFF', body)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = resolve(process.argv[2] ?? 'public/audio/Roland SC-55Edited.sf2')
  mkdirSync(dirname(output), { recursive: true })
  const bytes = buildTestSoundFont()
  writeFileSync(output, bytes)
  console.log(`Wrote ${bytes.length} bytes to ${output}`)
}
