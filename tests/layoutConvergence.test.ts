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
import { tab } from '../src/assets/js/tab'
import { clearTrackRenderLayout } from '../src/composables/useTabRenderLayout'
import { recomputeTrackLayoutFromSong } from '../src/services/editor/measureLayoutEngine'
import { getAvailableRowWidth } from '../src/utils/tabSheetConstants'
import { assertBeatPositionsMatchLayout, assertTabAndRenderLayoutMatch } from './helpers/layoutConvergence'

const TRACK_ID = 0
const VOICE_ID = 0
const AVAILABLE_WIDTH = 900

describe('layout convergence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Song.initEmptySong()
    clearTrackRenderLayout(TRACK_ID, VOICE_ID)
  })

  it('keeps tab.blockToRow aligned with useTabRenderLayout after assignBlocksToRows', () => {
    tab.assignBlocksToRows(TRACK_ID, VOICE_ID)
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
    assertBeatPositionsMatchLayout(TRACK_ID, VOICE_ID)
  })

  it('keeps tab and render layout aligned after direct measureLayoutEngine recompute', () => {
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, AVAILABLE_WIDTH)
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
  })

  it('reconverges after widening a measure duration', () => {
    tab.assignBlocksToRows(TRACK_ID, VOICE_ID)
    Song.measures[TRACK_ID][0][VOICE_ID][0].duration = 'w'
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, getAvailableRowWidth())
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
  })

  it('reconverges when additional empty measures are appended', () => {
    tab.assignBlocksToRows(TRACK_ID, VOICE_ID)
    const templateMeasure = Song.measures[TRACK_ID][0]
    Song.measures[TRACK_ID].push(templateMeasure)
    Song.measureMeta.push(Song.defaultMeasureMeta())
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, AVAILABLE_WIDTH)
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
    expect(tab.blockToRow[TRACK_ID][VOICE_ID].length).toBe(Song.measures[TRACK_ID].length)
  })

  it('wraps a default empty song onto multiple rows with finite measure widths', () => {
    const layout = recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, AVAILABLE_WIDTH).state
    expect(layout.numRows).toBeGreaterThan(1)
    expect(layout.blockLayouts.length).toBe(Song.measures[TRACK_ID].length)

    for (const block of layout.blockLayouts) {
      expect(Number.isFinite(block.width)).toBe(true)
      expect(block.width).toBeGreaterThan(0)
      for (const beatX of block.beatPositions) {
        expect(Number.isFinite(beatX)).toBe(true)
      }
    }
  })
})
