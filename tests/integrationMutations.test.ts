import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('../src/assets/js/sequencerHandler', () => ({
  sequencerHandler: {
    redrawSequencerMain: vi.fn(),
    registerEditModeActiveRef: vi.fn(),
    registerSequencerSetIndicatorCallback: vi.fn(),
    registerSequencerRedrawCallback: vi.fn(),
    registerFaderContext: vi.fn(),
    unregisterFaderContext: vi.fn(),
    toggleEditMode: vi.fn(),
  },
  SequencerHandler: {
    removeOverlay: vi.fn(),
    removeMarker: vi.fn(),
  },
}))

vi.mock('../src/services/editor/classicalNotationAdapter', () => ({
  classicalNotation: {
    updateVexFlowBlock: vi.fn(),
  },
}))

vi.mock('../src/services/menuMutationRouting', () => ({
  findMenuEffectGroup: () => ({ id: 'dynamic' }),
  getDynamicValue: () => 'mf',
}))

vi.mock('../src/assets/js/menuHandler', () => ({
  menuHandler: {
    deactivateEffects: vi.fn(),
    setEffectVariable: vi.fn(),
    showAvailableTupletSizes: vi.fn(),
  },
}))

import { createPinia, setActivePinia } from 'pinia'
import Song from '../src/assets/js/songData'
import { tab } from '../src/assets/js/tab'
import { revertHandler } from '../src/assets/js/revertHandler'
import { overlayHandler } from '../src/assets/js/overlayHandler'
import { changeNoteDuration } from '../src/services/editor/durationCommands'
import { processDynamicSelect } from '../src/services/editor/dynamicsCommands'
import {
  initPlayBackParameters,
  movePlayBackBarToBeat,
} from '../src/services/editor/playbackController'
import {
  registerPlaybackBarElement,
  resetPlaybackBarState,
  usePlaybackBarState,
} from '../src/composables/usePlaybackBarState'
import { clearTrackRenderLayout } from '../src/composables/useTabRenderLayout'
import { assertTabAndRenderLayoutMatch } from './helpers/layoutConvergence'

const tabDurationHost = {
  isNotePlaceable: vi.fn(() => true),
  changeBeatDuration: vi.fn(),
  trackRerenderNecessary: vi.fn(() => false),
  drawTrack: vi.fn(),
}

describe('integration mutations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Song.initEmptySong()
    clearTrackRenderLayout(0, 0)
    tab.assignBlocksToRows(0, 0)
    tab.markedNoteObj = { trackId: 0, voiceId: 0, blockId: 0, beatId: 0, string: 0 }
    revertHandler.revertStack = []
    revertHandler.revertStackIndex = -1
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetPlaybackBarState()
    overlayHandler.resetOverlays()
  })

  describe('duration change', () => {
    it('updates beat duration through the duration command pipeline', () => {
      const beat = Song.measures[0][0][0][0]
      beat.duration = 'e'

      const applied = changeNoteDuration(tabDurationHost, 0, 0, 0, 0, 0, 'q', false)

      expect(applied).toBe(true)
      expect(tabDurationHost.changeBeatDuration).toHaveBeenCalled()
      expect(revertHandler.revertStackIndex).toBe(0)
    })
  })

  describe('effect toggle', () => {
    it('applies a dynamic marking and requests over-bar render', () => {
      processDynamicSelect({
        notes: [{
          trackId: 0,
          blockId: 0,
          voiceId: 0,
          beatId: 0,
          string: 0,
        }],
        blocks: [0],
      }, 'mfDynamic', false)

      expect(Song.measures[0][0][0][0].dynamic).toBe('mf')
    })
  })

  describe('undo / redo stack', () => {
    it('pops the revert stack when undo is invoked', () => {
      processDynamicSelect({
        notes: [{
          trackId: 0,
          blockId: 0,
          voiceId: 0,
          beatId: 0,
          string: 0,
        }],
        blocks: [0],
      }, 'mfDynamic', null)

      expect(revertHandler.revertStackIndex).toBe(0)

      revertHandler.revertState()

      expect(revertHandler.revertStackIndex).toBe(-1)
    })
  })

  describe('overlay copy / paste', () => {
    it('copies selected beats into the overlay clipboard', () => {
      overlayHandler.initOverlay(0, 0, 0, 0)
      overlayHandler.setEndOverlay(0, 0, 0, 1)
      overlayHandler.copyHandler()

      expect(overlayHandler.copyObject.array).toHaveLength(2)
      expect(overlayHandler.copyObject.array[0]).toBe(Song.measures[0][0][0][0])
      expect(overlayHandler.copyObject.array[1]).toBe(Song.measures[0][0][0][1])
    })

    it('pastes copied beats into the selected range', () => {
      const sourceDuration = Song.measures[0][0][0][0].duration
      overlayHandler.initOverlay(0, 0, 0, 0)
      overlayHandler.setEndOverlay(0, 0, 0, 0)
      overlayHandler.copyHandler()

      overlayHandler.initOverlay(0, 1, 0, 0)
      overlayHandler.setEndOverlay(0, 1, 0, 0)
      overlayHandler.pasteHandler()

      expect(Song.measures[0][1][0][0].duration).toBe(sourceDuration)
    })
  })

  describe('playback bar position', () => {
    it('moves the reactive playback bar to a beat position', () => {
      registerPlaybackBarElement({} as SVGGElement)
      initPlayBackParameters()

      movePlayBackBarToBeat(0, 0, 0, 0, 0)

      const { playbackBarState } = usePlaybackBarState()
      expect(playbackBarState.visible).toBe(false)
      expect(playbackBarState.x).toBeGreaterThan(0)
      expect(playbackBarState.y).toBeGreaterThanOrEqual(0)
    })

    it('keeps playback layout aligned after a duration mutation', () => {
      Song.measures[0][0][0][0].duration = 'h'
      tab.assignBlocksToRows(0, 0)
      assertTabAndRenderLayoutMatch(0, 0)
    })
  })
})
