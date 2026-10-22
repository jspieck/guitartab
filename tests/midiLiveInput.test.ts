import { describe, expect, it, vi } from 'vitest'
import { arrangeOnStrings } from '../src/services/midi/noteArranger'

vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)
vi.mock('../src/assets/js/playbackEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.playbackModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

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
    const { default: Song } = await import('../src/assets/js/songData')
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
