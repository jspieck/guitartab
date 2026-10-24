import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { buildGuitarProFile } from './helpers/guitarProBytes'

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
vi.mock('../src/services/dialogs/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)

/** Everything the Guitar Pro parser produces, as JSON (Maps as entry lists). */
async function parse(format: 'gp3' | 'gp4' | 'gp5', bytes: Uint8Array): Promise<string> {
  const { parseGuitarPro } = await import('../src/services/import/guitarPro')
  const song = parseGuitarPro(format, bytes)
  return `${JSON.stringify(song, (_key, value) => (value instanceof Map ? [...value] : value), 1)}\n`
}

describe('Guitar Pro 3/4/5 import', () => {
  it('reads a Guitar Pro 3 file', async () => {
    await expect(await parse('gp3', buildGuitarProFile(3))).toMatchFileSnapshot(
      '__snapshots__/guitarPro/built.gp3.json',
    )
  })

  it('reads a Guitar Pro 4 file', async () => {
    await expect(await parse('gp4', buildGuitarProFile(4))).toMatchFileSnapshot(
      '__snapshots__/guitarPro/built.gp4.json',
    )
  })

  it('reads the GP5 showcase', async () => {
    const bytes = new Uint8Array(readFileSync('e2e/fixtures/files/showcase.gp5'))
    await expect(await parse('gp5', bytes)).toMatchFileSnapshot('__snapshots__/guitarPro/showcase.gp5.json')
  })
})

describe('Guitar Pro 5 export', () => {
  it('reads back what it writes, without changing the song', async () => {
    const { parseGuitarPro } = await import('../src/services/import/guitarPro')
    const { writeGp5 } = await import('../src/services/gp5Export')
    const song = parseGuitarPro('gp5', new Uint8Array(readFileSync('e2e/fixtures/files/showcase.gp5')))
    const playBackInstrument = song.tracks.map((track) => ({
      ...song.channels[track.channel.index],
      instrument: '',
      mute: false,
      solo: false,
    }))
    const before = JSON.stringify(song)
    const again = parseGuitarPro('gp5', writeGp5({ ...song, playBackInstrument }))
    expect(JSON.stringify(song)).toBe(before)
    for (const key of ['description', 'bpm', 'measureMeta', 'tracks', 'measures'] as const) {
      expect(again[key], key).toEqual(song[key])
    }
    expect(again.chords.map((map) => [...map])).toEqual(song.chords.map((map) => [...map]))
  })
})
