import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revertHandler } from '../src/assets/js/revertHandler'
import Song from '../src/assets/js/songData'
import { tab } from '../src/assets/js/tab'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)
vi.mock('../src/assets/js/playbackEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.playbackModule),
)
vi.mock('../src/assets/js/midiReceiver', () =>
  import('./helpers/legacyMocks').then((m) => m.midiReceiverModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

describe('undo/redo', () => {
  beforeEach(() => {
    Song.initEmptySong()
    revertHandler.clearHistory()
    tab.markedNoteObj = {
      trackId: 0,
      voiceId: 0,
      blockId: 0,
      beatId: 0,
      string: 5,
    }
  })

  it('records note placement when drawNote is called during editing', () => {
    tab.drawNote(0, 0, 0, 0, 5, 3, false)

    expect(revertHandler.canUndo()).toBe(true)
    expect(Song.measures[0][0][0][0].notes[5]?.fret).toBe(3)
  })

  it('undoes and redoes a note placement', () => {
    tab.drawNote(0, 0, 0, 0, 5, 3, false)

    revertHandler.revertState()
    expect(Song.measures[0][0][0][0].notes[5] ?? null).toBeNull()
    expect(revertHandler.canRedo()).toBe(true)

    revertHandler.restoreState()
    expect(Song.measures[0][0][0][0].notes[5]?.fret).toBe(3)
  })
})
