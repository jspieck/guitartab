import { selectionState } from '../src/stores/selectionState'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { undoHistory } from '../src/services/editor/editCommands'
import Song from '../src/assets/js/songData'
import { tab, Tab } from '../src/assets/js/tab'
import { recordTrackEdit } from '../src/services/editor/songSettingsCommands'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)
vi.mock('../src/assets/js/playbackEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.playbackModule),
)
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

describe('undo/redo', () => {
  beforeEach(() => {
    Song.initEmptySong()
    undoHistory.clear()
    selectionState.cursor = {
      trackId: 0,
      voiceId: 0,
      blockId: 0,
      beatId: 0,
      string: 5,
    }
  })

  it('records note placement when drawNote is called during editing', () => {
    tab.drawNote(0, 0, 0, 0, 5, 3, false)

    expect(undoHistory.canUndo()).toBe(true)
    expect(Song.measures[0][0][0][0].notes[5]?.fret).toBe(3)
  })

  it('undoes and redoes a note placement', () => {
    tab.drawNote(0, 0, 0, 0, 5, 3, false)

    undoHistory.undo()
    expect(Song.measures[0][0][0][0].notes[5] ?? null).toBeNull()
    expect(undoHistory.canRedo()).toBe(true)

    undoHistory.redo()
    expect(Song.measures[0][0][0][0].notes[5]?.fret).toBe(3)
  })

  it('deleting a note is undoable, and deleting it removes the tied note after it in one step', () => {
    tab.drawNote(0, 0, 0, 0, 5, 3, true)
    tab.drawNote(0, 0, 0, 1, 5, 3, true)
    Song.measures[0][0][0][1].notes[5]!.tied = true

    Tab.deleteNote(0, 0, 0, 0, 5)
    expect(Song.measures[0][0][0][0].notes[5] ?? null).toBeNull()
    expect(Song.measures[0][0][0][1].notes[5] ?? null).toBeNull()

    undoHistory.undo()
    expect(Song.measures[0][0][0][0].notes[5]?.fret).toBe(3)
    expect(Song.measures[0][0][0][1].notes[5]?.tied).toBe(true)
    expect(undoHistory.canUndo()).toBe(false)
  })

  it('track settings are one undo step', () => {
    const nameBefore = Song.tracks[0].name
    recordTrackEdit('Track settings', 0, () => {
      Song.tracks[0].name = 'Lead'
      Song.tracks[0].capo = 3
    })
    undoHistory.undo()
    expect(Song.tracks[0].name).toBe(nameBefore)
    expect(Song.tracks[0].capo).toBe(0)
    undoHistory.redo()
    expect(Song.tracks[0]).toMatchObject({ name: 'Lead', capo: 3 })
  })
})
