import { vi } from 'vitest'

/**
 * Stand-ins for legacy singletons that need a real browser (Web Audio, the playback worker,
 * the app shell). Tests that import code depending on them opt in per file:
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
  // Loading a song (trackLoading.ts) rewinds and follows the shown track.
  resetPosition: vi.fn(),
  followTrackChange: vi.fn(),
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
