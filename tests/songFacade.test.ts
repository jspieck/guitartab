import { describe, expect, it, vi } from 'vitest'
import Song from '../src/stores/song'
import { songState } from '../src/stores/songState'
import { useTempoState } from '../src/stores/tempoState'

const { tempoState } = useTempoState()

vi.mock('fastdom', () => ({
  default: { mutate: (fn: () => void) => fn(), measure: (fn: () => void) => fn() },
}))

/**
 * The `Song` facade: what the empty song looks like, the default objects, the accessors and
 * small mutators, and that it reads and writes through the reactive `songState`. Written
 * against `assets/js/songData.ts` before it moved to `stores/song.ts`.
 */

describe('Song facade', () => {
  it('builds the empty song', () => {
    Song.initEmptySong()
    const { tracks, measureMeta, measures, songDescription, allChannels, bpm, numMeasures, chordsMap } = Song
    expect({
      tracks,
      measureMeta: measureMeta.slice(0, 2),
      bars: measures[0].length,
      voices: measures[0][0].length,
      bar0: measures[0][0][0].map((beat) => beat.duration),
      songDescription,
      channels: allChannels.length,
      channel0: allChannels[0],
      bpm,
      numMeasures,
      chords: chordsMap.map((map) => map.size),
      tempo: tempoState.bpm,
    }).toMatchSnapshot()
  })

  it('has default objects', () => {
    expect({
      beat: Song.defaultMeasure(),
      note: Song.defaultNote(),
      effects: Song.defaultMeasureEffects(),
      meta: Song.defaultMeasureMeta(),
      chord: Song.defaultChord(),
      track: Song.defaultTrack(),
    }).toMatchSnapshot()
  })

  it('finds beats and notes, and names a missing position', () => {
    Song.initEmptySong()
    Song.measures[0][1][0][2].notes[3] = { ...Song.defaultNote(), fret: 7 }
    const ref = { trackId: 0, blockId: 1, voiceId: 0, beatId: 2 }
    expect(Song.findBeat(ref)).toBe(Song.measures[0][1][0][2])
    expect(Song.getNote({ ...ref, string: 3 })?.fret).toBe(7)
    expect(Song.getNote({ ...ref, string: 4 })).toBeNull()
    expect(Song.findBeat({ ...ref, blockId: 99 })).toBeUndefined()
    expect(() => Song.getBeat({ ...ref, beatId: 50 })).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: No beat at track 0, block 1, voice 0, beat 50]`,
    )
  })

  it('inserts beats, fills empty bars, adds chords, sets the tempo', () => {
    Song.initEmptySong()
    Song.setBeat(0, 0, 0, 1, 'q')
    const afterInsert = Song.measures[0][0][0].map((beat) => beat.duration)
    Song.measures[0].push([])
    Song.initEmptyMeasure(0, 12, 1)
    Song.addChord(0, { ...Song.defaultChord(), name: 'Am', frets: [0, 1, 2, 2, 0, -1], display: false })
    Song.setTempo(133)
    expect({
      afterInsert,
      newBar: Song.measures[0][12],
      newMeta: Song.measureMeta[12],
      chord: Song.chordsMap[0].get('Am'),
      bpm: Song.bpm,
      tempo: tempoState.bpm,
      emptyBefore: Song.isBeatEmpty(0, 1),
    }).toMatchSnapshot()
  })

  it('reads and writes through the reactive song state', () => {
    Song.initEmptySong()
    Song.currentTrackId = 3
    expect(songState.currentTrackId).toBe(3)
    songState.bpm = 77
    expect(Song.bpm).toBe(77)
    Song.currentTrackId = 0
  })
})
