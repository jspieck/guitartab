#!/usr/bin/env node
// Checks that a site serves the SoundFont public/audio/manifest.json names (Big win 32), for
// the deploy smoke test of Big win 33 or by hand after uploading a new bank:
//
//   node scripts/check-soundfont.mjs https://example.org/
//
// Fails when the file is missing, has another size or SHA-256, or the server doesn't answer
// range requests with 206 (the app then has to load the whole file before the first note).

import { createHash } from 'node:crypto'
import { readManifest } from './soundfont-file.mjs'

const site = process.argv[2]
if (!site) {
  console.error('usage: node scripts/check-soundfont.mjs <site URL>')
  process.exit(1)
}
const manifest = readManifest('public/audio')
if (!manifest) {
  console.error('public/audio/manifest.json is missing')
  process.exit(1)
}
const url = new URL(`audio/${manifest.soundFont}`, site.endsWith('/') ? site : `${site}/`).href
const problems = []

const [first, count] = manifest.pdta
const range = await fetch(url, { headers: { Range: `bytes=${first}-${first + count - 1}` } })
if (range.status !== 206) problems.push(`range request answered ${range.status}, expected 206`)
else if ((await range.arrayBuffer()).byteLength !== count)
  problems.push('range request gave the wrong length')
else await range.body?.cancel().catch(() => {})

const whole = await fetch(url)
if (!whole.ok) problems.push(`${url}: ${whole.status}`)
else {
  const bytes = new Uint8Array(await whole.arrayBuffer())
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (bytes.length !== manifest.bytes) problems.push(`size ${bytes.length}, manifest says ${manifest.bytes}`)
  if (hash !== manifest.sha256) problems.push('SHA-256 differs from the manifest')
  const cache = whole.headers.get('cache-control') ?? ''
  if (!/immutable|max-age=31536000/.test(cache))
    console.warn(`note: Cache-Control is "${cache}" (expected a year, immutable)`)
}

if (problems.length) {
  console.error(`SoundFont check failed for ${url}:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`${url}: ${manifest.bytes} bytes, hash and range requests OK`)
