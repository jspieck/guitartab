// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { songText } from './helpers/songText'

vi.mock('fastdom', () => ({
  default: { mutate: (fn: () => void) => fn(), measure: (fn: () => void) => fn() },
}))
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
// Files we didn't make (e2e/fixtures/files/real/SOURCES.md): every one must open, and what it
// opens as is pinned per file, so a change to a reader shows up as a readable diff.
const ROOT = 'e2e/fixtures/files/real'
const FOLDERS = ['alphatab', 'mutopia']

async function open(path: string, name: string) {
  const { importSongFile } = await import('../src/services/songImport')
  return importSongFile(name, new Uint8Array(readFileSync(path)))
}

describe('real files', () => {
  for (const folder of FOLDERS) {
    for (const name of readdirSync(`${ROOT}/${folder}`)) {
      it(`${folder}/${name}`, async () => {
        const warnings = await open(`${ROOT}/${folder}/${name}`, name)
        const report = warnings.length > 0 ? `warnings: ${warnings.join('; ')}\n` : ''
        await expect(report + songText()).toMatchFileSnapshot(`__snapshots__/realFiles/${folder}/${name}.txt`)
      })
    }
  }

  it('reads a timewise score like the same score saved partwise', async () => {
    const read = async (name: string) => {
      await open(`${ROOT}/alphatab/${name}`, name)
      return songText()
    }
    expect(await read('musicxml4-timewise-basic.xml')).toBe(await read('musicxml4-partwise-basic.xml'))
    expect(await read('musicxml4-timewise-anacrusis.xml')).toBe(
      await read('musicxml4-partwise-anacrusis.xml'),
    )
  })
})
