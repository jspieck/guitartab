import { vi } from 'vitest'

/**
 * Stand-ins for legacy singletons that need a real browser (Web Audio, the playback worker,
 * modal DOM, the app shell). Tests that import code depending on them opt in per file:
 *
 *   vi.mock('../src/assets/js/audioEngine', () => import('./helpers/legacyMocks').then((m) => m.audioEngineModule))
 *
 * (A factory has to load this lazily: vi.mock calls are hoisted above imports.)
 * Everything else runs against the real modules.
 */

export const audioEngineModule = {
  audioEngine: {
    getCurrentTime: () => 0,
    setEffectGain: () => {},
  },
}

export const playbackModule = {
  default: {
    setPlayPosition: vi.fn(),
    getCurrentBlock: () => 0,
    currentBlockPP: 0,
    startPlayBack: vi.fn(),
    stopPlayBack: vi.fn(),
  },
}

export const midiReceiverModule = {
  default: {
    isRecording: false,
    midiToNote: vi.fn(),
  },
}

export const modalManagerModule = {
  modalManager: {
    toggleByModal: vi.fn(),
    toggleModal: vi.fn(),
    getHandler: vi.fn(),
    isAnyModalOpen: vi.fn(() => false),
  },
}

export const appManagerModule = {
  default: {
    duringTrackCreation: false,
    typeOfNote: 'e',
    changeTrack: vi.fn(),
    checkAndAdaptTimeMeter: vi.fn(),
  },
}
