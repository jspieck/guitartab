import { beforeEach, describe, expect, it, vi } from 'vitest'
import Song from '../src/stores/song'
import Duration from '../src/utils/duration'
import { fillTimeSignatures, playbackInstrumentFor } from '../src/services/editor/trackLoading'
import { fitBarsToTimeSignature } from '../src/services/editor/timeSignatureCommands'
import { notificationState } from '../src/stores/notificationState'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
function barLength64ths(trackId: number, blockId: number, voiceId = 0): number {
  return Song.measures[trackId][blockId][voiceId].reduce(
    (sum, beat) => sum + Duration.getDurationOfNote(beat, false),
    0,
  )
}

describe('track loading', () => {
  beforeEach(() => {
    Song.initEmptySong()
  })

  it('fillTimeSignatures carries the last time signature forward', () => {
    Song.measureMeta[2].numerator = 3
    Song.measureMeta[2].denominator = 4
    delete (Song.measureMeta[3] as { numerator?: number }).numerator
    delete (Song.measureMeta[3] as { denominator?: number }).denominator
    fillTimeSignatures()
    expect([Song.measureMeta[3].numerator, Song.measureMeta[3].denominator]).toEqual([3, 4])
  })

  it('playbackInstrumentFor reads a GP channel, and a program for drums on channel 10', () => {
    Song.allChannels[0] = {
      cInstrument: 25,
      volume: 90,
      balance: 40,
      chorus: 1,
      reverb: 2,
      phaser: 3,
      tremolo: 4,
    }
    Song.tracks[0].program = undefined as never
    Song.tracks[0].channel = { index: 0, effectChannel: 0 }
    expect(playbackInstrumentFor(0)).toMatchObject({ volume: 90, balance: 40, reverb: 2 })

    Song.tracks[0].program = 0
    Song.tracks[0].primaryChannel = 9
    expect(playbackInstrumentFor(0)).toMatchObject({ instrument: 'drums', volume: 100 })
  })

  it('playbackInstrumentFor takes a GP3–5 track (program -1) from its channel', () => {
    Song.allChannels[2] = {
      cInstrument: 33,
      volume: 80,
      balance: 64,
      chorus: 0,
      reverb: 0,
      phaser: 0,
      tremolo: 0,
    }
    Song.allChannels[9] = {
      cInstrument: 0,
      volume: 90,
      balance: 64,
      chorus: 0,
      reverb: 0,
      phaser: 0,
      tremolo: 0,
    }
    Song.tracks[0].program = -1
    Song.tracks[0].primaryChannel = -1
    Song.tracks[0].channel = { index: 2, effectChannel: 3 }
    expect(playbackInstrumentFor(0)).toMatchObject({ instrument: 'bass', volume: 80 })

    Song.tracks[0].channel = { index: 9, effectChannel: 9 }
    expect(playbackInstrumentFor(0)).toMatchObject({ instrument: 'drums', volume: 90 })
  })

  it('fitBarsToTimeSignature cuts and fills bars up to the next change', () => {
    Song.measureMeta[1].numerator = 3
    Song.measureMeta[1].timeMeterPresent = true
    Song.measureMeta[2].numerator = 3
    expect(fitBarsToTimeSignature(1)).toBe(true)
    expect(barLength64ths(0, 1)).toBe(48)
    expect(barLength64ths(0, 2)).toBe(48)
    expect(barLength64ths(0, 0)).toBe(64)
  })

  it('fitBarsToTimeSignature refuses to cut a tuplet', () => {
    const beats = Song.measures[0][1][0]
    beats.splice(0, beats.length)
    for (let i = 0; i < 3; i += 1) {
      Song.setBeat(0, 1, 0, i, 'e')
      Object.assign(beats[i], { tuplet: 3, tupletId: 1 })
    }
    // Triplet eighths are 5⅓ 64ths each; a 1/16 bar (4 64ths) would cut after the first, inside the group.
    Song.measureMeta[1].numerator = 1
    Song.measureMeta[1].denominator = 16
    Song.measureMeta[1].timeMeterPresent = true
    const before = JSON.stringify(Song.measures[0][1])
    expect(fitBarsToTimeSignature(1)).toBe(false)
    expect(JSON.stringify(Song.measures[0][1])).toBe(before)
    expect(notificationState.kind).toBe('error')
  })
})
