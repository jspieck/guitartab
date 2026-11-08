// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import type { EqBand, TrackCompressor } from '../src/types/song'

vi.mock('fastdom', () => ({
  default: { measure: (fn: () => void) => fn(), mutate: (fn: () => void) => fn(), clear: () => {} },
}))
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)

/** Per-track channel EQ and compressor: stored on the track, saved in .gt, kept on undo. */

const BANDS: EqBand[] = [
  { type: 'highpass', frequency: 90, gain: 0, q: 0.7, enabled: true },
  { type: 'peaking', frequency: 400, gain: -4, q: 1.4, enabled: true },
  { type: 'peaking', frequency: 2500, gain: 0, q: 1, enabled: false },
  { type: 'highshelf', frequency: 8000, gain: 2, q: 0.71, enabled: true },
]
const COMPRESSOR: TrackCompressor = {
  enabled: true,
  threshold: -20,
  knee: 4,
  ratio: 3,
  attack: 8,
  release: 150,
}

describe('channel insert settings', () => {
  it('reads valid settings from a track and repairs damaged ones', async () => {
    const { eqOf, compressorOf } = await import('../src/services/audio/trackInserts')
    expect(eqOf({})).toBeNull()
    expect(eqOf({ eq: BANDS })).toEqual(BANDS)
    // wrong length (an old or damaged file): no EQ rather than a half one
    expect(eqOf({ eq: BANDS.slice(0, 2) })).toBeNull()
    const repaired = eqOf({
      eq: [
        { ...BANDS[0], frequency: 5 },
        { ...BANDS[1], gain: 99 },
        { ...BANDS[2], type: 'bogus' as never },
        BANDS[3],
      ],
    })!
    expect(repaired[0].frequency).toBe(20)
    expect(repaired[1].gain).toBe(18)
    expect(repaired[2].type).toBe('peaking')

    expect(compressorOf({})).toBeNull()
    expect(compressorOf({ compressor: COMPRESSOR })).toEqual(COMPRESSOR)
    expect(
      compressorOf({ compressor: { ...COMPRESSOR, ratio: 400, enabled: 'yes' as never } }),
    ).toMatchObject({
      ratio: 20,
      enabled: false,
    })
  })

  it('tells whether the EQ and compressor change the sound', async () => {
    const { eqBandsFlat, createDefaultEqBands } = await import('../src/services/audio/masterEqualizer')
    expect(eqBandsFlat(createDefaultEqBands())).toBe(true)
    expect(eqBandsFlat(BANDS)).toBe(false)
    // a low cut changes the sound even without gain
    expect(
      eqBandsFlat([{ ...createDefaultEqBands()[0], type: 'highpass' }, ...createDefaultEqBands().slice(1)]),
    ).toBe(false)
  })

  it('saves them in .gt and loads them back', async () => {
    const { default: Song } = await import('../src/stores/song')
    Song.initEmptySong()
    const { setTrackEq, setTrackCompressor } = await import('../src/services/editor/songSettingsCommands')
    setTrackEq(0, BANDS)
    setTrackCompressor(0, COMPRESSOR)
    const { serializeSongToGtBytes } = await import('../src/utils/gtSerialization')
    const bytes = serializeSongToGtBytes()

    setTrackEq(0, null)
    setTrackCompressor(0, null)
    expect(Song.tracks[0].eq).toBeUndefined()

    const { loadGtBytes } = await import('../src/services/songImport')
    loadGtBytes(bytes)
    expect(Song.tracks[0].eq).toEqual(BANDS)
    expect(Song.tracks[0].compressor).toEqual(COMPRESSOR)
  })

  it('keeps them when an older track edit is undone (mixer settings have no undo)', async () => {
    const { default: Song } = await import('../src/stores/song')
    Song.initEmptySong()
    const { recordTrackEdit, setTrackEq } = await import('../src/services/editor/songSettingsCommands')
    const { undoHistory } = await import('../src/services/editor/editCommands')
    recordTrackEdit('Track name', 0, () => {
      Song.tracks[0].name = 'Renamed'
    })
    setTrackEq(0, BANDS)
    undoHistory.undo()
    expect(Song.tracks[0].name).not.toBe('Renamed')
    expect(Song.tracks[0].eq).toEqual(BANDS)
  })
})
