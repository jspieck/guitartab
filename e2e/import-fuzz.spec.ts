import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { waitForEditorShell } from './helpers'
import { buildBcfs, buildGpArchive, readShowcaseGpif } from './fixtures/gpFiles'

const showcaseGp5 = Array.from(readFileSync('e2e/fixtures/files/showcase.gp5'))
const showcaseGt = Array.from(readFileSync('e2e/fixtures/files/showcase.gt'))
const showcaseGpif = readShowcaseGpif()
const showcaseGp = Array.from(buildGpArchive(showcaseGpif))
const showcaseGpx = Array.from(buildBcfs({ 'score.gpif': new TextEncoder().encode(showcaseGpif) }))

/** Deterministic pseudo-random bytes (mulberry32), so failures are reproducible. */
function randomBytes(seed: number, length: number): number[] {
  let state = seed
  const out: number[] = []
  for (let i = 0; i < length; i += 1) {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    out.push(((t ^ (t >>> 14)) >>> 0) & 0xff)
  }
  return out
}

function cases(): { name: string; file: string; bytes: number[] }[] {
  const list: { name: string; file: string; bytes: number[] }[] = []
  for (const format of ['gp3', 'gp4', 'gp5', 'gpx', 'gp', 'gt', 'mid']) {
    for (let seed = 1; seed <= 12; seed += 1) {
      list.push({
        name: `random ${format} #${seed}`,
        file: `x.${format}`,
        bytes: randomBytes(seed * 97 + format.length, (seed * 337) % 3000),
      })
    }
  }
  // A valid GP5 header followed by garbage reaches the deeper parsing code.
  for (let cut = 40; cut < showcaseGp5.length; cut += Math.floor(showcaseGp5.length / 25)) {
    list.push({ name: `gp5 truncated at ${cut}`, file: 'x.gp5', bytes: showcaseGp5.slice(0, cut) })
  }
  for (let seed = 1; seed <= 25; seed += 1) {
    const bytes = showcaseGp5.slice()
    const noise = randomBytes(seed, 6)
    for (let i = 0; i < 3; i += 1) {
      const at = 31 + (((noise[i * 2] << 8) | noise[i * 2 + 1]) % (bytes.length - 31))
      bytes[at] ^= 0xff
    }
    list.push({ name: `gp5 corrupted #${seed}`, file: 'x.gp5', bytes })
  }
  for (const [file, bytes] of [
    ['x.gp', showcaseGp],
    ['x.gpx', showcaseGpx],
  ] as const) {
    for (let cut = 4; cut < bytes.length; cut += Math.floor(bytes.length / 12)) {
      list.push({ name: `${file} truncated at ${cut}`, file, bytes: bytes.slice(0, cut) })
    }
  }
  // The score XML cut short or with bytes flipped (flips may still parse to an altered song).
  for (let cut = 100; cut < showcaseGpif.length; cut += Math.floor(showcaseGpif.length / 15)) {
    list.push({
      name: `gpif truncated at ${cut}`,
      file: 'x.gp',
      bytes: Array.from(buildGpArchive(showcaseGpif.slice(0, cut))),
    })
  }
  for (let seed = 1; seed <= 15; seed += 1) {
    const chars = showcaseGpif.split('')
    const noise = randomBytes(seed, 8)
    for (let i = 0; i < 4; i += 1) {
      chars[((noise[i * 2] << 8) | noise[i * 2 + 1]) % chars.length] = String.fromCharCode(
        33 + (noise[i] % 90),
      )
    }
    list.push({
      name: `gpif corrupted #${seed}`,
      file: 'x.gp',
      bytes: Array.from(buildGpArchive(chars.join(''))),
    })
  }
  for (const cut of [10, 100, 1000, showcaseGt.length - 3]) {
    list.push({ name: `gt truncated at ${cut}`, file: 'x.gt', bytes: showcaseGt.slice(0, cut) })
  }
  return list
}

test('damaged or random files fail with an ImportError and leave the song intact', async ({ page }) => {
  test.setTimeout(180_000)
  await waitForEditorShell(page)
  const results = await page.evaluate(async (all) => {
    const { gProReader } = await import('/src/assets/js/GProReader.ts')
    const { default: Song } = await import('/src/assets/js/songData.ts')
    const { serializeSongContent, compressGtContent } = await import('/src/utils/gtSerialization.ts')
    const accepted: string[] = []
    const original = serializeSongContent()
    const problems: string[] = []
    let rejected = 0
    let slowest = 0
    for (const { name, file, bytes } of all) {
      const started = performance.now()
      try {
        gProReader.importSongBytes(file, new Uint8Array(bytes))
        // Some corruptions still decode to a song; that's fine as long as it is usable.
        if (!Array.isArray(Song.measures[0]) || Song.measures[0].length === 0)
          problems.push(`${name}: empty song`)
        accepted.push(name)
        gProReader.importSongBytes('restore.gt', compressGtContent(original))
      } catch (error) {
        rejected += 1
        if ((error as Error).name !== 'ImportError')
          problems.push(`${name}: ${(error as Error).name}: ${(error as Error).message}`)
        if (serializeSongContent() !== original) problems.push(`${name}: song changed after a failed import`)
      }
      slowest = Math.max(slowest, performance.now() - started)
    }
    return { problems, rejected, total: all.length, slowest, accepted }
  }, cases())
  console.log(
    `fuzz: ${results.rejected}/${results.total} rejected, slowest case ${Math.round(results.slowest)} ms`,
  )
  expect(results.problems).toEqual([])
  // Bit flips inside a valid file may still decode (to an altered song); random or truncated data must not.
  expect(results.accepted.filter((name) => !/^(gp5|gpif) corrupted/.test(name))).toEqual([])
  expect(results.slowest).toBeLessThan(5000)
})
