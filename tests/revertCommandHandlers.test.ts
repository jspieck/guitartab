import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/assets/js/tab', () => ({
  tab: {
    drawTrack: vi.fn(),
    removeBlock: vi.fn(),
    addBlock: vi.fn(),
  },
  Tab: {
    deleteNote: vi.fn(),
  },
}))

vi.mock('../src/assets/js/sequencerHandler', () => ({
  sequencerHandler: {
    redrawSequencerMain: vi.fn(),
  },
  SequencerHandler: {
    setMarker: vi.fn(),
    removeMarker: vi.fn(),
  },
}))

vi.mock('../src/assets/js/menuHandler', () => ({
  menuHandler: {
    handleEffectGroupCollisionBeat: vi.fn(),
    handleEffectGroupCollision: vi.fn(),
  },
}))

vi.mock('../src/assets/js/menuHelper', () => ({
  processEffectSelect: vi.fn(),
  setEffectVariable: vi.fn(),
  handleEffectGroupCollisionBeat: vi.fn(),
  handleEffectGroupCollision: vi.fn(),
}))

vi.mock('../src/services/editor/renderCommands', () => ({
  requestBlockRender: vi.fn(),
  requestDurationRender: vi.fn(),
}))

import Song from '../src/assets/js/songData'
import { tab } from '../src/assets/js/tab'
import {
  revertNoteLength,
  restoreNoteLength,
} from '../src/services/editor/revertCommandHandlers'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/assets/js/audioEngine', () => import('./helpers/legacyMocks').then((m) => m.audioEngineModule))
vi.mock('../src/assets/js/playBackLogicNew', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/assets/js/midiReceiver', () => import('./helpers/legacyMocks').then((m) => m.midiReceiverModule))
vi.mock('../src/assets/js/modals/modalManager', () => import('./helpers/legacyMocks').then((m) => m.modalManagerModule))
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

describe('revertCommandHandlers', () => {
  beforeEach(() => {
    Song.initEmptySong()
    vi.clearAllMocks()
  })

  it('revert/restore note length swap measure snapshots', () => {
    const before = Song.measures[0][0][0]
    const after = JSON.parse(JSON.stringify(before))

    Song.measures[0][0][0] = after
    revertNoteLength({
      trackId: 0,
      blockId: 0,
      voiceId: 0,
      measureBefore: before,
    })
    expect(Song.measures[0][0][0]).toEqual(before)
    expect(tab.drawTrack).toHaveBeenCalled()

    restoreNoteLength({
      trackId: 0,
      blockId: 0,
      voiceId: 0,
      measureAfter: after,
    })
    expect(Song.measures[0][0][0]).toEqual(after)
  })
})
