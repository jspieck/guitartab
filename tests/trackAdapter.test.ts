import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Song, { type PlayBackInstrument, type Track } from '../src/assets/js/songData'
import { legacyTrackAdapter, resizeTrackTuning, trackToViewModel } from '../src/services/legacy/trackAdapter'
import { typedEventBus } from '../src/utils/typedEventBus'

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    numStrings: 6,
    capo: 0,
    strings: [64, 59, 55, 50, 45, 40],
    volume: 127,
    balance: 63,
    reverb: 0,
    name: 'Lead',
    color: { red: 10, green: 20, blue: 30 },
    channel: { index: 0, effectChannel: 1 },
    program: 0,
    primaryChannel: 0,
    letItRing: false,
    ...overrides,
  }
}

function createPlayback(overrides: Partial<PlayBackInstrument> = {}): PlayBackInstrument {
  return {
    instrument: 'guitar',
    solo: false,
    mute: false,
    volume: 100,
    tremolo: 0,
    reverb: 0,
    chorus: 0,
    phaser: 0,
    balance: 64,
    ...overrides,
  }
}

let originalTracks: Track[]
let originalPlayback: PlayBackInstrument[]
let originalCurrentTrackId: number
let originalCurrentVoiceId: number

beforeEach(() => {
  originalTracks = cloneValue(Song.tracks)
  originalPlayback = cloneValue(Song.playBackInstrument)
  originalCurrentTrackId = Song.currentTrackId
  originalCurrentVoiceId = Song.currentVoiceId

  Song.tracks = [createTrack()]
  Song.playBackInstrument = [createPlayback()]
  Song.currentTrackId = 0
  Song.currentVoiceId = 0
})

afterEach(() => {
  Song.tracks = originalTracks
  Song.playBackInstrument = originalPlayback
  Song.currentTrackId = originalCurrentTrackId
  Song.currentVoiceId = originalCurrentVoiceId
  typedEventBus.clearAll()
})

describe('trackAdapter helpers', () => {
  it('resizes tuning arrays deterministically', () => {
    expect(resizeTrackTuning([64, 59, 55], 5)).toEqual([64, 59, 55, 50, 45])
    expect(resizeTrackTuning([64, 59, 55, 50, 45, 40], 4)).toEqual([64, 59, 55, 50])
  })

  it('normalizes missing program numbers for the modern view model', () => {
    const viewModel = trackToViewModel(createTrack({ program: 0 }), createPlayback(), 0)

    expect(viewModel.program).toBe(25)
    expect(viewModel.tuning).toEqual([64, 59, 55, 50, 45, 40])
  })
})

describe('legacyTrackAdapter', () => {
  it('updates track and playback state through one typed patch', () => {
    legacyTrackAdapter.updateTrack(0, {
      name: 'Rhythm',
      capo: 3,
      program: 27,
      numStrings: 7,
      tuning: [64, 59, 55, 50, 45, 40, 35],
      volume: 120,
      balance: 40,
      reverb: 12,
      isMuted: true,
      isSolo: true,
    })

    expect(Song.tracks[0].name).toBe('Rhythm')
    expect(Song.tracks[0].capo).toBe(3)
    expect(Song.tracks[0].program).toBe(27)
    expect(Song.tracks[0].numStrings).toBe(7)
    expect(Song.tracks[0].strings).toEqual([64, 59, 55, 50, 45, 40, 35])
    expect(Song.playBackInstrument[0].volume).toBe(120)
    expect(Song.playBackInstrument[0].balance).toBe(40)
    expect(Song.playBackInstrument[0].reverb).toBe(12)
    expect(Song.playBackInstrument[0].mute).toBe(true)
    expect(Song.playBackInstrument[0].solo).toBe(true)
  })

  it('updates current track and voice through the typed event path', () => {
    const trackHandler = vi.fn()
    const voiceHandler = vi.fn()

    typedEventBus.on('ui.trackChanged', trackHandler)
    typedEventBus.on('ui.voiceChanged', voiceHandler)

    legacyTrackAdapter.selectTrack(0)
    legacyTrackAdapter.selectVoice(2)

    expect(Song.currentTrackId).toBe(0)
    expect(Song.currentVoiceId).toBe(2)
    expect(trackHandler).toHaveBeenCalledWith(0)
    expect(voiceHandler).toHaveBeenCalledWith(2)
  })
})