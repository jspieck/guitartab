import { describe, expect, it, vi } from 'vitest'
import { arrangeOnStrings } from '../src/services/midi/noteArranger'

vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/dialogs/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)

const GUITAR = [40, 45, 50, 55, 59, 64]

describe('arrangeOnStrings', () => {
  it('puts a single pitch where its fret is smallest', () => {
    expect(arrangeOnStrings([60], GUITAR, 0)).toEqual([{ pitch: 60, string: 4, fret: 1 }])
    // A capo shifts the fret down.
    expect(arrangeOnStrings([60], GUITAR, 1)).toEqual([{ pitch: 60, string: 4, fret: 0 }])
  })

  it('places a chord lowest pitch on the lowest string, whatever the input order', () => {
    // Open E major: E2 B2 E3 G#3 B3 E4
    const chord = arrangeOnStrings([64, 59, 56, 52, 47, 40], GUITAR, 0)
    expect(chord.map((n) => `${n.string}:${n.fret}`)).toEqual(['0:0', '1:2', '2:2', '3:1', '4:0', '5:0'])
  })

  it('skips strings in use and reports pitches with no place', () => {
    expect(arrangeOnStrings([60], GUITAR, 0, new Set([4]))).toEqual([{ pitch: 60, string: 3, fret: 5 }])
    expect(arrangeOnStrings([30], GUITAR, 0)).toEqual([{ pitch: 30, string: -1, fret: -1 }])
  })
})

describe('nearestBeat', () => {
  it('finds the beat starting closest to a position in the bar', async () => {
    const { default: Song } = await import('../src/stores/song')
    const { nearestBeat } = await import('../src/services/midi/liveInput')
    Song.initEmptySong()
    const beat = (duration: string) => ({ ...Song.defaultMeasure(), duration: duration as never, notes: [] })
    // 4/4: beats start at 0, 0.25, 0.5 (half note)
    Song.measures[0][0][0] = [beat('qr'), beat('qr'), beat('hr')]
    expect(nearestBeat(0, 0, 0, 0.1)).toBe(0)
    expect(nearestBeat(0, 0, 0, 0.3)).toBe(1)
    expect(nearestBeat(0, 0, 0, 0.45)).toBe(2)
    expect(nearestBeat(0, 0, 0, 0.9)).toBe(2)
  })
})

describe('live notes', () => {
  it('sound at the key pitch past the capo, and as the drum note on a drum track', async () => {
    const { default: Song } = await import('../src/stores/song')
    const { samplePlayer } = await import('../src/services/audio/samplePlayer')
    const { default: liveInput } = await import('../src/services/midi/liveInput')
    Song.initEmptySong()
    const played = vi.spyOn(samplePlayer, 'playFret').mockReturnValue(null)
    Song.tracks[0].capo = 2
    liveInput.noteOn(64, 100)
    // string 0 is E2 (40): the key E4 is fret 22 above a capo on 2 (it used to sound 2 semitones sharp)
    expect(played.mock.calls[0].slice(2, 4)).toEqual([0, 22])

    // a drum track used to throw here (the old drum samples were never loaded)
    Song.tracks[0].capo = 0
    Song.tracks[0].channel.index = 9
    Song.playBackInstrument[0].instrument = 'drums'
    liveInput.noteOn(38, 100)
    expect(played.mock.calls[1].slice(2, 4)).toEqual([0, 38])
    expect(played.mock.calls[1][9]).toBe('drums')
    played.mockRestore()
  })
})
