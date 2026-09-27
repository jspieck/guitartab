import { vi } from 'vitest'

/**
 * Shared Vitest setup for GuitarTabVue.
 * Stubs browser-only APIs and heavy singletons so unit tests can import
 * editor/layout modules without AudioContext / Worker / modal side effects.
 */

class AudioContextStub {
  currentTime = 0
  destination = {}
  createGain() {
    return {
      connect: vi.fn(),
      gain: { value: 1 },
    }
  }
  createAnalyser() {
    return { connect: vi.fn() }
  }
  createOscillator() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { value: 440 },
    }
  }
  resume() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
}

class WorkerStub {
  onmessage: ((event: MessageEvent) => void) | null = null
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}

vi.stubGlobal('AudioContext', AudioContextStub)
vi.stubGlobal('webkitAudioContext', AudioContextStub)
vi.stubGlobal('Worker', WorkerStub)

if (typeof URL !== 'undefined') {
  URL.createObjectURL = () => 'blob:vitest-mock'
  URL.revokeObjectURL = () => {}
}

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
    startPlayBack: vi.fn(),
    stopPlayBack: vi.fn(),
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
