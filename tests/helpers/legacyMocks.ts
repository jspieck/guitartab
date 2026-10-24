import { vi } from 'vitest'

/**
 * Stand-ins for legacy singletons that need a real browser (Web Audio, the playback worker,
 * modal DOM, the app shell). Tests that import code depending on them opt in per file:
 *
 *   vi.mock('../src/services/audio/audioGraph', () => import('./helpers/legacyMocks').then((m) => m.audioGraphModule))
 *
 * (A factory has to load this lazily: vi.mock calls are hoisted above imports.)
 * Everything else runs against the real modules. The audio graph is the one audio module
 * that touches Web Audio on import (it creates the AudioContext); with it stubbed, the
 * sample player, drum kit and SoundFont code load in node.
 */

const audioGraphStub = {
  getCurrentTime: () => 0,
  setEffectGain: () => {},
  updateBusses: () => {},
  busses: [] as { volume?: { gain: { value: number } } }[],
  drumBusses: [] as { volume?: { gain: { value: number } } }[],
}

export const audioGraphModule = {
  audioGraph: audioGraphStub,
}

const playbackStub = {
  setPlayPosition: vi.fn(),
  getCurrentBlock: () => 0,
  songPosition: () => ({ blockId: 0, positionInBlock: 0 }),
  playingBlock: 0,
  start: vi.fn(),
  stop: vi.fn(),
  adaptToLoopChange: vi.fn(),
  jumpToPosition: vi.fn(),
}

export const playbackModule = {
  playback: playbackStub,
  default: playbackStub,
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
