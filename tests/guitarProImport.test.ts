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

describe('Guitar Pro 3/4 details', () => {
  for (const version of [3, 4] as const) {
    it(`GP${version}: key changes carry on, note dynamics reach the beat`, async () => {
      const { parseGuitarPro } = await import('../src/services/import/guitarPro')
      const song = parseGuitarPro(`gp${version}`, buildGuitarProFile(version))
      expect(song.measureMeta.map((meta) => [meta.keySignature, meta.keyMinor ?? false])).toEqual([
        [0, false],
        [2, true],
      ])
      const triplets = song.measures[0][1][0].slice(0, 3)
      expect(triplets.map((beat) => [beat.dynamic, beat.dynamicPresent])).toEqual([
        ['ff', true],
        ['ff', false],
        ['ff', false],
      ])
    })
  }

  it('GP4: an artificial harmonic is one byte and the file stays aligned', async () => {
    const { parseGuitarPro } = await import('../src/services/import/guitarPro')
    const song = parseGuitarPro('gp4', buildGuitarProFile(4))
    const notes = Array.from(song.measures[0][0][0][0].notes).filter(Boolean)
    expect(notes.map((note) => note.artificialStyle)).toContain('A.H.')
    expect(song.measureMeta[1].bpm).toBe(96)
  })
})

describe('Guitar Pro text', () => {
  it('reads UTF-8 (this app) and Windows-1252 (Guitar Pro) text', async () => {
    const { ByteReader } = await import('../src/services/import/guitarPro/byteReader')
    const read = (bytes: number[]) =>
      new ByteReader(Uint8Array.from([bytes.length, 0, 0, 0, ...bytes]), 'gp5').readStringInteger()
    expect(read([0xc3, 0xa4, 0x21])).toBe('ä!')
    expect(read([0xe4, 0x21])).toBe('ä!')
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

  it('writes navigation signs into the header and reads them back', async () => {
    const { parseGuitarPro } = await import('../src/services/import/guitarPro')
    const { writeGp5 } = await import('../src/services/gp5Export')
    const song = parseGuitarPro('gp5', new Uint8Array(readFileSync('e2e/fixtures/files/showcase.gp5')))
    const playBackInstrument = song.tracks.map(() => ({ instrument: '', mute: false, solo: false }))
    song.measureMeta[0].directionTargets = ['Segno']
    song.measureMeta[1].directionJumps = ['DaCoda']
    song.measureMeta[2].directionTargets = ['Coda', 'Fine']
    song.measureMeta[2].directionJumps = ['DaCapo', 'DaSegnoAlCoda']
    const again = parseGuitarPro('gp5', writeGp5({ ...song, playBackInstrument } as never))
    const signs = (s: typeof song) =>
      s.measureMeta.map((meta) => [meta.directionTargets, meta.directionJumps])
    expect(signs(again)).toEqual(signs(song))
  })

  it('writes the key in the header and key changes on bars', async () => {
    const { parseGuitarPro } = await import('../src/services/import/guitarPro')
    const { writeGp5 } = await import('../src/services/gp5Export')
    const song = parseGuitarPro('gp5', new Uint8Array(readFileSync('e2e/fixtures/files/showcase.gp5')))
    const playBackInstrument = song.tracks.map(() => ({ instrument: '', mute: false, solo: false }))
    song.measureMeta.forEach((meta, i) => {
      meta.keySignature = i < 3 ? 2 : -4
      if (i >= 5) meta.keyMinor = true
    })
    const again = parseGuitarPro('gp5', writeGp5({ ...song, playBackInstrument } as never))
    const keys = (s: typeof song) => s.measureMeta.map((meta) => [meta.keySignature, meta.keyMinor ?? false])
    expect(keys(again)).toEqual(keys(song))
  })

  it('writes the lyrics of the first track that has some, all verses', async () => {
    const { parseGuitarPro } = await import('../src/services/import/guitarPro')
    const { writeGp5 } = await import('../src/services/gp5Export')
    const { beatTakesLyric, setBeatLyric } = await import('../src/utils/lyrics')
    const song = parseGuitarPro('gp5', new Uint8Array(readFileSync('e2e/fixtures/files/showcase.gp5')))
    const playBackInstrument = song.tracks.map(() => ({ instrument: '', mute: false, solo: false }))
    // Syllables on every note from bar 2; a second verse on the first note only.
    const noteBeats = song.measures[0].flatMap((bar, blockId) =>
      blockId === 0 ? [] : bar[0].filter((beat) => beatTakesLyric(beat)),
    )
    noteBeats.forEach((beat, i) => {
      setBeatLyric(beat, 0, i % 3 === 0 ? 'wor-' : i % 3 === 1 ? 'ds' : i % 5 === 0 ? '' : 'ä')
    })
    setBeatLyric(noteBeats[0], 1, 'zwei')
    const again = parseGuitarPro('gp5', writeGp5({ ...song, playBackInstrument } as never))
    const lyrics = (s: typeof song) =>
      s.measures.map((bars) => bars.map((bar) => bar[0].map((b) => b.lyrics)))
    expect(lyrics(again)).toEqual(lyrics(song))
  })
})
