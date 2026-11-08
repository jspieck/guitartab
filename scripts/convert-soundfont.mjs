#!/usr/bin/env node
// Converts an SF2 SoundFont into SF3 (each sample an Ogg Vorbis stream, as MuseScore's SF3)
// with ffmpeg, then gives it a hashed name and writes audio/manifest.json (Big win 32):
//
//   node scripts/convert-soundfont.mjs public/audio/GeneralUser-GS.sf2 [--quality 5] [--ffmpeg <path>]
//
// - Samples are stored in the order the presets use them (bank 0 by program, then the drum
//   kits), so one preset's samples sit together and the app fetches them in a few ranges.
// - A sample stays PCM when Vorbis would not be smaller (short one-shots: a Vorbis stream
//   carries ~4 KB of headers) or when ffmpeg fails on it; the reader handles both kinds.
// - Every stream is decoded again and its length compared with the original; a stream that
//   doesn't give back exactly the original number of frames stays PCM (loop points count
//   decoded frames). The length is the stream's last Ogg granule position, which is what
//   browsers trim to (ffmpeg 3.4's own decoder returns the last block untrimmed).
// The SF2 itself is kept: the app falls back to it where no Vorbis decoder works.

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { soundFontLayout, writeHashedSoundFont } from './soundfont-file.mjs'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : fallback
}
const source = args.find((arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--'))
if (!source) {
  console.error('usage: node scripts/convert-soundfont.mjs <file.sf2> [--quality 5] [--ffmpeg <path>]')
  process.exit(1)
}
const quality = Number(option('--quality', '5'))
const ffmpeg = option('--ffmpeg', process.env.FFMPEG ?? 'ffmpeg')
const COMPRESSED = 0x10

const input = readFileSync(source)
const layout = soundFontLayout(input)
const chunk = (list, type) => layout[list].chunks.find((c) => c.type === type)
const smpl = chunk('sdta', 'smpl')
const shdr = chunk('pdta', 'shdr')

// --- which samples each preset plays, in preset order ---------------------------------
const u16 = (at) => input.readUInt16LE(at)
const records = (c, size) => Array.from({ length: Math.floor(c.size / size) }, (_, i) => c.offset + i * size)
const generators = (c) => records(c, 4).map((at) => ({ op: u16(at), amount: u16(at + 2) }))
const bags = (c) => records(c, 4).map((at) => u16(at))

function zoneTargets(bagStarts, gens, first, last, operator) {
  const found = []
  for (let bag = first; bag < last; bag += 1) {
    for (let g = bagStarts[bag]; g < bagStarts[bag + 1]; g += 1) {
      if (gens[g]?.op === operator) found.push(gens[g].amount)
    }
  }
  return found
}

function sampleOrder() {
  const presets = records(chunk('pdta', 'phdr'), 38).map((at) => ({
    program: u16(at + 20),
    bank: u16(at + 22),
    bag: u16(at + 24),
  }))
  const instruments = records(chunk('pdta', 'inst'), 22).map((at) => u16(at + 20))
  const pbag = bags(chunk('pdta', 'pbag'))
  const ibag = bags(chunk('pdta', 'ibag'))
  const pgen = generators(chunk('pdta', 'pgen'))
  const igen = generators(chunk('pdta', 'igen'))
  const order = []
  const seen = new Set()
  const sorted = presets
    .slice(0, -1) // EOP
    .map((preset, i) => ({ ...preset, end: presets[i + 1].bag }))
    .sort((a, b) => a.bank - b.bank || a.program - b.program)
  for (const preset of sorted) {
    for (const instrument of zoneTargets(pbag, pgen, preset.bag, preset.end, 41)) {
      const next = instruments[instrument + 1]
      if (next == null) continue
      for (const sample of zoneTargets(ibag, igen, instruments[instrument], next, 53)) {
        if (seen.has(sample)) continue
        order.push(sample)
        seen.add(sample)
      }
    }
  }
  const count = Math.floor(shdr.size / 46) - 1 // EOS
  for (let i = 0; i < count; i += 1) if (!seen.has(i)) order.push(i)
  return order
}

// --- encoding ---------------------------------------------------------------------------
function run(argv, stdin) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, argv, { stdio: ['pipe', 'pipe', 'pipe'] })
    const out = []
    let err = ''
    child.stdout.on('data', (data) => out.push(data))
    child.stderr.on('data', (data) => (err += data))
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(err.slice(-400))),
    )
    child.stdin.on('error', () => {})
    child.stdin.end(stdin)
  })
}

const quiet = ['-hide_banner', '-loglevel', 'error']

async function encode(pcm, rate) {
  const ogg = await run(
    [
      ...quiet,
      '-f',
      's16le',
      '-ar',
      String(rate),
      '-ac',
      '1',
      '-i',
      'pipe:0',
      '-c:a',
      'libvorbis',
      '-q:a',
      String(quality),
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-f',
      'ogg',
      'pipe:1',
    ],
    pcm,
  )
  const decoded = await run([...quiet, '-i', 'pipe:0', '-f', 's16le', '-ac', '1', 'pipe:1'], ogg)
  return { ogg, decodedFrames: lastGranule(ogg), decoded }
}

/** The granule position (= frames) of the last Ogg page. */
function lastGranule(ogg) {
  for (let at = ogg.length - 27; at >= 0; at -= 1) {
    if (ogg[at] === 0x4f && ogg.toString('latin1', at, at + 4) === 'OggS')
      return Number(ogg.readBigInt64LE(at + 6))
  }
  return -1
}

function errorDb(pcm, decoded) {
  let signal = 0
  let noise = 0
  for (let i = 0; i < pcm.length / 2; i += 1) {
    const a = pcm.readInt16LE(i * 2)
    const b = decoded.readInt16LE(i * 2)
    signal += a * a
    noise += (a - b) * (a - b)
  }
  return signal > 0 ? 10 * Math.log10(noise / signal || 1e-12) : -Infinity
}

/**
 * The sample with PAD_FRAMES more at its end: Chrome's decodeAudioData ignores the last Ogg
 * granule and drops up to half a short Vorbis block (measured on GeneralUser GS: up to 128
 * frames at 44.1 kHz, 256 at 22 kHz and below), which would cut into loops near the end. A
 * looped sample goes on with its loop, a one-shot with silence, so the frames up to the
 * original end survive with room to spare.
 */
const PAD_FRAMES = 512

function padded(pcm, startLoop, endLoop) {
  const frames = pcm.length / 2
  const out = Buffer.alloc(pcm.length + PAD_FRAMES * 2)
  pcm.copy(out)
  const loop = endLoop - startLoop
  const looped = loop >= 8 && startLoop >= 0 && endLoop <= frames
  if (!looped) return out
  // past the loop end the loop starts again
  for (let frame = frames; frame < frames + PAD_FRAMES; frame += 1) {
    out.writeInt16LE(pcm.readInt16LE((startLoop + ((frame - endLoop) % loop)) * 2), frame * 2)
  }
  return out
}

async function convertSample(index) {
  const at = shdr.offset + index * 46
  const start = input.readUInt32LE(at + 20)
  const end = input.readUInt32LE(at + 24)
  const rate = input.readUInt32LE(at + 36)
  const pcm = input.subarray(smpl.offset + start * 2, smpl.offset + end * 2)
  const result = { index, start, pcm, ogg: null, reason: '', snr: null }
  if (end <= start || rate < 1000) return { ...result, reason: 'empty or no rate' }
  try {
    const startLoop = input.readUInt32LE(at + 28) - start
    const endLoop = input.readUInt32LE(at + 32) - start
    const { ogg, decodedFrames, decoded } = await encode(padded(pcm, startLoop, endLoop), rate)
    if (decodedFrames !== end - start + PAD_FRAMES || decoded.length < pcm.length)
      return { ...result, reason: `length ${decodedFrames} ≠ ${end - start + PAD_FRAMES}` }
    if (ogg.length >= pcm.length) return { ...result, reason: 'not smaller' }
    return { ...result, ogg, snr: errorDb(pcm, decoded) }
  } catch (error) {
    return { ...result, reason: `ffmpeg: ${String(error.message).split('\n')[0]}` }
  }
}

async function convertAll(order) {
  const results = new Array(order.length)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < order.length) {
      const slot = next
      next += 1
      results[slot] = await convertSample(order[slot])
      done += 1
      if (done % 50 === 0) process.stdout.write(`  ${done}/${order.length}\n`)
    }
  }
  await Promise.all(Array.from({ length: Math.max(2, cpus().length - 1) }, worker))
  return results
}

// --- writing ----------------------------------------------------------------------------
function riffChunk(type, data) {
  const header = Buffer.alloc(8)
  header.write(type, 0, 'latin1')
  header.writeUInt32LE(data.length, 4)
  return Buffer.concat(data.length & 1 ? [header, data, Buffer.alloc(1)] : [header, data])
}
const list = (name, parts) => riffChunk('LIST', Buffer.concat([Buffer.from(name, 'latin1'), ...parts]))
const copyChunk = (c) => riffChunk(c.type, input.subarray(c.offset, c.offset + c.size))

function writeSf3(results) {
  const parts = []
  let offset = 0
  const headers = Buffer.from(input.subarray(shdr.offset, shdr.offset + shdr.size))
  for (const result of results) {
    const at = result.index * 46
    const startLoop = headers.readUInt32LE(at + 28) - result.start
    const endLoop = headers.readUInt32LE(at + 32) - result.start
    const type = headers.readUInt16LE(at + 44)
    if (result.ogg) {
      // SF3: start/end are byte offsets of the stream, loop points frames from its start
      headers.writeUInt32LE(offset, at + 20)
      headers.writeUInt32LE(offset + result.ogg.length, at + 24)
      headers.writeUInt32LE(startLoop, at + 28)
      headers.writeUInt32LE(endLoop, at + 32)
      headers.writeUInt16LE(type | COMPRESSED, at + 44)
      parts.push(result.ogg)
      offset += result.ogg.length
    } else {
      // PCM: frame offsets, so the stream starts on an even byte, plus SF2's 46 frames of silence
      if (offset & 1) {
        parts.push(Buffer.alloc(1))
        offset += 1
      }
      const frame = offset / 2
      const frames = result.pcm.length / 2
      headers.writeUInt32LE(frame, at + 20)
      headers.writeUInt32LE(frame + frames, at + 24)
      headers.writeUInt32LE(frame + startLoop, at + 28)
      headers.writeUInt32LE(frame + endLoop, at + 32)
      parts.push(result.pcm, Buffer.alloc(92))
      offset += result.pcm.length + 92
    }
  }
  const info = layout.INFO.chunks.map((c) => {
    if (c.type !== 'ifil') return copyChunk(c)
    const version = Buffer.alloc(4)
    version.writeUInt16LE(3, 0) // SoundFont 3 (compressed samples)
    version.writeUInt16LE(1, 2)
    return riffChunk('ifil', version)
  })
  const pdta = layout.pdta.chunks.map((c) => (c.type === 'shdr' ? riffChunk('shdr', headers) : copyChunk(c)))
  const body = Buffer.concat([
    Buffer.from('sfbk', 'latin1'),
    list('INFO', info),
    list('sdta', [riffChunk('smpl', Buffer.concat(parts))]),
    list('pdta', pdta),
  ])
  return riffChunk('RIFF', body)
}

const began = Date.now()
const order = sampleOrder()
console.log(`${order.length} samples, Vorbis quality ${quality}…`)
const results = await convertAll(order)
const output = writeSf3(results)
const target = source.replace(/\.sf2$/i, '.sf3')
writeFileSync(target, output)
const compressed = results.filter((result) => result.ogg)
const kept = results.filter((result) => !result.ogg)
const reasons = {}
for (const result of kept) {
  const key = result.reason.replace(/\d+/g, 'n')
  reasons[key] = (reasons[key] ?? 0) + 1
}
const snrs = compressed.map((result) => result.snr).sort((a, b) => a - b)
console.log(
  `${compressed.length} samples as Vorbis, ${kept.length} kept as PCM`,
  reasons,
  `\nerror vs. original (dB, lower is better): median ${snrs[snrs.length >> 1]?.toFixed(1)}, worst ${snrs[snrs.length - 1]?.toFixed(1)}`,
)
console.log(
  `${(input.length / 1e6).toFixed(1)} MB → ${(output.length / 1e6).toFixed(2)} MB in ${((Date.now() - began) / 1000).toFixed(0)} s`,
)
const manifest = writeHashedSoundFont(target)
console.log(`written ${manifest.soundFont} and manifest.json`)
