// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs'
import { toRaw } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXAMPLE_SONGS } from '../src/data/exampleSongs'

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
vi.mock('../src/services/userNotifications', () => ({ showUserMessage: vi.fn(), showUserError: vi.fn() }))

const file = (name: string) => `public/examples/${name}`

describe('example songs', () => {
  beforeEach(() => {
    // The dialog fetches the file next to the app; here it comes from the folder.
    vi.stubGlobal('fetch', async (url: string) => {
      const bytes = readFileSync(file(url.split('/').pop()!))
      return new Response(bytes)
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('has a file and a credit with a link for every MIDI example', () => {
    for (const example of EXAMPLE_SONGS.filter((song) => song.file != null)) {
      expect(existsSync(file(example.file!)), example.file).toBe(true)
      expect(example.credit?.sourceUrl).toMatch(/^https:\/\/www\.mutopiaproject\.org\//)
      expect(example.credit?.licenseUrl).toMatch(/^https:\/\//)
    }
    expect(new Set(EXAMPLE_SONGS.map((song) => song.id)).size).toBe(EXAMPLE_SONGS.length)
  })

  it('builds the shuffle with every bar full in all five tracks', async () => {
    const [{ buildShuffle }, { default: Duration }] = await Promise.all([
      import('../src/data/exampleShuffle'),
      import('../src/utils/duration'),
    ])
    const song = buildShuffle()
    expect(song.tracks.map((track) => track.name)).toEqual([
      'Rhythm Guitar',
      'Lead Guitar',
      'Organ',
      'Bass',
      'Drums',
    ])
    expect(song.measureMeta).toHaveLength(13)
    for (const [t, bars] of song.measures.entries())
      for (const [bar, voices] of bars.entries()) {
        const length = voices[0].reduce((sum, beat) => sum + Duration.getDurationOfNote(beat, false), 0)
        expect(length, `${song.tracks[t].name} bar ${bar + 1}`).toBeCloseTo(64, 5)
      }
  })

  for (const example of EXAMPLE_SONGS.filter((song) => song.file != null)) {
    it(`opens ${example.id} as a playable guitar tab with its credits`, async () => {
      const [{ openExampleSong }, { default: Song }, { isSongDirty }, { showUserMessage }] =
        await Promise.all([
          import('../src/services/exampleSongs'),
          import('../src/stores/song'),
          import('../src/services/songAutosave'),
          import('../src/services/userNotifications'),
        ])
      vi.mocked(showUserMessage).mockClear()
      await openExampleSong(example.id)

      expect(Song.songDescription.title).toBe(example.title)
      expect(Song.songDescription.artist).toBe(example.composer)
      // Nothing left over from the song before (the demo's "Demo" author once was).
      expect(Song.songDescription.author).toBe(example.composer)
      expect(Song.songDescription.comments.join(' ')).toContain(example.credit!.sourceUrl)
      expect(Song.tracks.map((track) => [track.name, track.program])).toEqual(
        example.tracks!.map(({ track }) => [track.name, track.program]),
      )
      // Opening an example is not an edit: nothing to save, no "unsaved changes" question.
      expect(isSongDirty()).toBe(false)
      // Everything found a string; guitar parts lie in the guitar's octave (single notes up to
      // fret 24: the Saltarello ends on harmonics at their sounding pitch, Für Elise leaps to E6).
      expect(showUserMessage).not.toHaveBeenCalled()
      const fretsOf = (tracks: number[]) =>
        tracks.flatMap((t) =>
          toRaw(Song.measures[t])
            .flat(2)
            .flatMap((beat) => beat.notes.filter(Boolean).map((note) => note!.fret)),
        )
      const all = fretsOf(Song.tracks.map((_, t) => t))
      expect(all.length).toBeGreaterThan(50)
      expect(Math.max(...all)).toBeLessThanOrEqual(24)
      const guitars = fretsOf(
        Song.tracks.flatMap((track, t) => (track.program >= 24 && track.program <= 31 ? [t] : [])),
      )
      if (guitars.length > 0)
        expect(guitars.filter((fret) => fret <= 12).length / guitars.length).toBeGreaterThan(0.95)
    })
  }
})
