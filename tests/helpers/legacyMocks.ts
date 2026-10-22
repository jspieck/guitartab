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

const audioEngineStub = {
  getCurrentTime: () => 0,
  setEffectGain: () => {},
  busses: [] as { volume?: { gain: { value: number } } }[],
}

export const audioEngineModule = {
  audioEngine: audioEngineStub,
  default: audioEngineStub,
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

export const liveInputModule = {
  default: {
    isRecording: false,
    writeRecordedNotes: vi.fn(),
  },
}

export const modalManagerModule = {
  modalManager: {
    toggleByModal: vi.fn(),
    toggleModal: vi.fn(),
    getHandler: vi.fn(),
    isAnyModalOpen: vi.fn(() => false),
    displayModal: vi.fn(),
    closeModal: vi.fn(),
  },
}

export const appManagerModule = {
  default: {
    duringTrackCreation: false,
  },
}
