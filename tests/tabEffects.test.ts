import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vanilla-picker', () => ({
  default: class PickerMock {},
}))

vi.mock('../src/assets/js/audioEngine', () => ({
  audioEngine: {
    getCurrentTime: () => 0,
    setEffectGain: () => {},
  },
}))

vi.mock('../src/assets/js/playBackLogicNew', () => ({
  default: {
    setPlayPosition: vi.fn(),
    getCurrentBlock: () => 0,
    currentBlockPP: 0,
  },
}))

vi.mock('../src/assets/js/midiReceiver', () => ({
  default: {
    isRecording: false,
    midiToNote: vi.fn(),
  },
}))

vi.mock('../src/assets/js/modals/modalManager', () => ({
  modalManager: {
    toggleByModal: vi.fn(),
    toggleModal: vi.fn(),
    getHandler: vi.fn(),
  },
}))

vi.mock('../src/assets/js/appManager', () => ({
  default: {
    duringTrackCreation: false,
    typeOfNote: 'e',
    changeTrack: vi.fn(),
    checkAndAdaptTimeMeter: vi.fn(),
  },
}))

import { createPinia, setActivePinia } from 'pinia'
import Song from '../src/assets/js/songData'
import type { TabBeat, TabNoteData } from '../src/types/tab'
import { recomputeTrackLayoutFromSong } from '../src/services/editor/measureLayoutEngine'
import { getMeasureBeatWidth, getMeasureBeatX } from '../src/utils/measureBeatLayout'
import { buildTabEffects } from '../src/utils/tabEffects'

const TRACK_ID = 0
const VOICE_ID = 0
const BLOCK_ID = 0

function createNote(overrides: Partial<TabNoteData> = {}): TabNoteData {
  return {
    fret: 0,
    string: 0,
    ...overrides,
  } as TabNoteData
}

function createBeat(duration: string, notes: Array<TabNoteData | null>): TabBeat {
  return {
    duration,
    notes,
  } as TabBeat
}

function buildInput(measureData: TabBeat[]) {
  return {
    measureData,
    trackId: TRACK_ID,
    voiceId: VOICE_ID,
    blockId: BLOCK_ID,
    stringSpacing: 12,
    numStrings: 6,
  }
}

describe('buildTabEffects', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Song.initEmptySong()
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, 900)
  })

  it('creates slide geometry using the next note direction', () => {
    const measureData = [
      createBeat('q', [createNote({ fret: 5, slide: true }), null, null, null, null, null]),
      createBeat('q', [createNote({ fret: 8 }), null, null, null, null, null]),
    ]

    const effects = buildTabEffects(buildInput(measureData))

    const beat0X = getMeasureBeatX(TRACK_ID, VOICE_ID, BLOCK_ID, 0, measureData)
    const beat0Width = getMeasureBeatWidth(TRACK_ID, VOICE_ID, BLOCK_ID, 0, measureData)
    const startX = beat0X + beat0Width / 2 + 8
    const slideLength = Math.min(beat0Width * 0.6, 25)

    expect(effects.slides).toHaveLength(1)
    expect(effects.slides[0].path).toBe(`M${startX} 7L${startX + slideLength} 13`)
  })

  it('deduplicates text effects per beat', () => {
    const measureData = [
      createBeat('q', [
        createNote({ palmMute: true, string: 0 }),
        createNote({ palmMute: true, string: 1 }),
        null,
        null,
        null,
        null,
      ]),
    ]

    const effects = buildTabEffects(buildInput(measureData))
    const beatCenter = getMeasureBeatX(TRACK_ID, VOICE_ID, BLOCK_ID, 0, measureData)
      + getMeasureBeatWidth(TRACK_ID, VOICE_ID, BLOCK_ID, 0, measureData) / 2

    expect(effects.textEffects).toEqual([
      {
        text: 'P.M.',
        x: beatCenter,
        y: -20,
        fontSize: '11px',
        beatIndex: 0,
      },
    ])
  })

  it('groups consecutive let-ring beats into one span', () => {
    const measureData = [
      createBeat('q', [createNote({ letRing: true }), null, null, null, null, null]),
      createBeat('q', [createNote({ letRing: true }), null, null, null, null, null]),
      createBeat('q', [createNote(), null, null, null, null, null]),
    ]

    const effects = buildTabEffects(buildInput(measureData))
    const startX = getMeasureBeatX(TRACK_ID, VOICE_ID, BLOCK_ID, 0, measureData)
      + getMeasureBeatWidth(TRACK_ID, VOICE_ID, BLOCK_ID, 0, measureData) / 2
    const endX = getMeasureBeatX(TRACK_ID, VOICE_ID, BLOCK_ID, 1, measureData)
      + getMeasureBeatWidth(TRACK_ID, VOICE_ID, BLOCK_ID, 1, measureData)

    expect(effects.letRings).toEqual([
      {
        x: startX,
        y: 70,
        lineEndX: endX,
      },
    ])
  })

  it('lays out many beat text effects in compact rows instead of a tall stack', () => {
    const effects = buildTabEffects(buildInput([
      createBeat('q', [
        createNote({
          palmMute: true,
          artificialPresent: true,
          letRing: true,
          accentuated: true,
          stacatto: true,
        }),
        null,
        null,
        null,
        null,
        null,
      ]),
    ]))

    expect(effects.textEffects).toHaveLength(5)
    expect(effects.textEffects.every((effect) => effect.y >= -32)).toBe(true)
    expect(new Set(effects.textEffects.map((effect) => effect.y)).size).toBeLessThanOrEqual(2)
  })

  it('aligns tremolo picking with the note column and duration beams', () => {
    const measureData = [
      createBeat('q', [createNote({ tremoloPicking: true, tremoloPickingLength: 's' }), null, null, null, null, null]),
    ]

    const effects = buildTabEffects(buildInput(measureData))
    const beatCenter = getMeasureBeatX(TRACK_ID, VOICE_ID, BLOCK_ID, 0, measureData)
      + getMeasureBeatWidth(TRACK_ID, VOICE_ID, BLOCK_ID, 0, measureData) / 2

    expect(effects.tremoloPickings).toEqual([
      {
        x: beatCenter - 5,
        y: 79,
        lines: 2,
        beatIndex: 0,
        stringIndex: 0,
      },
    ])
  })

  it('places trill above the affected string within the beat column', () => {
    const measureData = [
      createBeat('q', [null, null, createNote({ trillPresent: true }), null, null, null]),
    ]

    const effects = buildTabEffects(buildInput(measureData))
    const beatCenter = getMeasureBeatX(TRACK_ID, VOICE_ID, BLOCK_ID, 0, measureData)
      + getMeasureBeatWidth(TRACK_ID, VOICE_ID, BLOCK_ID, 0, measureData) / 2

    expect(effects.trills).toHaveLength(1)
    expect(effects.trills[0]).toMatchObject({
      textX: beatCenter - 8,
      textY: 17,
      beatIndex: 0,
      stringIndex: 2,
    })
    expect(effects.trills[0].path.startsWith(`M${beatCenter + 4} `)).toBe(true)
  })
})
