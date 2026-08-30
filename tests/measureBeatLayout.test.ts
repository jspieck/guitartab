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
import { recomputeTrackLayoutFromSong } from '../src/services/editor/measureLayoutEngine'
import { getMeasureBeatX, getMeasureBeatWidth } from '../src/utils/measureBeatLayout'
import { getBlockRenderLayout } from '../src/composables/useTabRenderLayout'

const TRACK_ID = 0
const VOICE_ID = 0
const AVAILABLE_WIDTH = 900

describe('measureBeatLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Song.initEmptySong()
  })

  it('uses block-local beat positions from layout state', () => {
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, AVAILABLE_WIDTH)

    const blockLayout = getBlockRenderLayout(TRACK_ID, VOICE_ID, 0)
    expect(blockLayout).not.toBeNull()

    const beats = Song.measures[TRACK_ID][0][VOICE_ID]
    for (let beatId = 0; beatId < beats.length; beatId += 1) {
      expect(getMeasureBeatX(TRACK_ID, VOICE_ID, 0, beatId, beats)).toBe(
        blockLayout!.beatPositions[beatId],
      )
      expect(getMeasureBeatWidth(TRACK_ID, VOICE_ID, 0, beatId, beats)).toBeGreaterThan(0)
    }
  })
})
