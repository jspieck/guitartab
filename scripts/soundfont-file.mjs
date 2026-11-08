#!/usr/bin/env node
// SoundFont file helpers for the build scripts (Big win 32), and the manifest writer:
//
//   node scripts/soundfont-file.mjs public/audio/GeneralUser-GS.sf3 [--keep]
//
// copies the file to `<name>.<hash>.<ext>` next to it (removes the unhashed one unless --keep)
// and writes `audio/manifest.json`: the hashed name, size, SHA-256 and where the preset data
// (pdta) and the sample data (smpl) sit, so the app can fetch the presets first and then only
// the sample byte ranges a song needs (HTTP range requests). The app reads the manifest at
// build time (vite.config.ts); `scripts/check-soundfont.mjs` compares it with a server.

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const fourCC = (bytes, at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3])
const u32 = (bytes, at) =>
  (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0

/** The chunks from `start` to `end`: { type, offset (of the data), size }. */
export function chunksOf(bytes, start, end) {
  const chunks = []
  let at = start
  while (at + 8 <= end) {
    const size = u32(bytes, at + 4)
    chunks.push({ type: fourCC(bytes, at), offset: at + 8, size })
    at += 8 + size + (size & 1)
  }
  return chunks
}

/** The top-level layout of a SoundFont: its three LIST chunks and the sub-chunks of each. */
export function soundFontLayout(bytes) {
  if (fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, 8) !== 'sfbk') throw new Error('not a SoundFont')
  const lists = {}
  for (const chunk of chunksOf(bytes, 12, 8 + u32(bytes, 4))) {
    if (chunk.type !== 'LIST') continue
    const name = fourCC(bytes, chunk.offset)
    lists[name] = { ...chunk, chunks: chunksOf(bytes, chunk.offset + 4, chunk.offset + chunk.size) }
  }
  if (!lists.INFO || !lists.sdta || !lists.pdta) throw new Error('INFO, sdta or pdta missing')
  return lists
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** What the app needs to fetch the file in parts. */
export function manifestFor(bytes, file) {
  const { sdta, pdta } = soundFontLayout(bytes)
  const smpl = sdta.chunks.find((chunk) => chunk.type === 'smpl')
  if (!smpl) throw new Error('no smpl chunk')
  return {
    soundFont: file,
    bytes: bytes.length,
    sha256: sha256(bytes),
    // the pdta LIST including its 8-byte header, as [first byte, byte count]
    pdta: [pdta.offset - 8, pdta.size + 8],
    // where the sample data starts (sample headers count from there)
    smpl: smpl.offset,
  }
}

/** Copies `source` to its hashed name and writes `manifest.json` beside it; returns the manifest. */
export function writeHashedSoundFont(source, { keep = false } = {}) {
  const bytes = readFileSync(source)
  const folder = dirname(source)
  const extension = extname(source)
  const stem = basename(source, extension).replace(/\.[0-9a-f]{8}$/, '')
  const hashed = `${stem}.${sha256(bytes).slice(0, 8)}${extension}`
  // older hashed copies of the same bank would otherwise pile up in public/audio/
  for (const name of readdirSync(folder)) {
    if (
      name !== hashed &&
      new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[0-9a-f]{8}\\${extension}$`).test(name)
    )
      rmSync(join(folder, name))
  }
  if (join(folder, hashed) !== source) {
    copyFileSync(source, join(folder, hashed))
    if (!keep) rmSync(source)
  }
  const manifest = manifestFor(bytes, hashed)
  writeFileSync(join(folder, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

/** The manifest in `folder`, or null. */
export function readManifest(folder) {
  const path = join(folder, 'manifest.json')
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [source, ...flags] = process.argv.slice(2)
  if (!source) {
    console.error('usage: node scripts/soundfont-file.mjs <file.sf2|.sf3> [--keep]')
    process.exit(1)
  }
  const manifest = writeHashedSoundFont(source, { keep: flags.includes('--keep') })
  console.log(`${manifest.soundFont}: ${(manifest.bytes / 1e6).toFixed(2)} MB, manifest written`)
}
