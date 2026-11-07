import { setFret } from '../src/services/editor/noteCommands'
import { selectionState } from '../src/stores/selectionState'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import Song from '../src/stores/song'
import { clearRange } from '../src/services/editor/rangeSelection'
import { noteInputState } from '../src/stores/noteInputState'
import { useToolbarState } from '../src/composables/useToolbarState'
import { recordBarEdit, undoHistory } from '../src/services/editor/editCommands'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
describe('toolbar state', () => {
  beforeEach(() => {
    Song.initEmptySong()
    undoHistory.clear()
    clearRange()
    selectionState.cursor = { trackId: 0, voiceId: 0, blockId: 1, beatId: 0, string: 2 }
  })

  it('follows the cursor and edits (including undo) without any resync event', async () => {
    const toolbar = useToolbarState(ref('3'))
    expect(toolbar.isPressed('addText')).toBe(false)

    recordBarEdit('Text', { trackId: 0, blockIds: [1] }, () => {
      Song.measures[0][1][0][0].text = 'Verse'
    })
    expect(toolbar.isPressed('addText')).toBe(true)

    undoHistory.undo()
    expect(toolbar.isPressed('addText')).toBe(false)

    Song.measureMeta[2].repeatOpen = true
    expect(toolbar.isPressed('openBar')).toBe(false)
    selectionState.cursor = { trackId: 0, voiceId: 0, blockId: 2, beatId: 0, string: 2 }
    expect(toolbar.isPressed('openBar')).toBe(true)
  })

  it('disables note effects on an empty string and enables them on a note', () => {
    const toolbar = useToolbarState(ref('3'))
    expect(toolbar.isDisabled('bend')).toBe(true)
    setFret(0, 1, 0, 0, 2, 5, true)
    expect(toolbar.isDisabled('bend')).toBe(false)
  })

  it('keeps the legacy note length for new notes in sync', async () => {
    useToolbarState(ref('3'))
    Song.measures[0][1][0][0].duration = 'q'
    await nextTick()
    expect(noteInputState.noteLength).toBe('q')
  })
})
