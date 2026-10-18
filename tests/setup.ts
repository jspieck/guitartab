import { vi } from 'vitest'

/**
 * Shared Vitest setup for GuitarTabVue.
 * Stubs browser-only globals (AudioContext, Worker, object URLs) and a DOM-only
 * third-party widget, so modules can be imported in node.
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

// Legacy app singletons are no longer mocked for every test; files that need that opt in
// with tests/helpers/legacyMocks.ts.
