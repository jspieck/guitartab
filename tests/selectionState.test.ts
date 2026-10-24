import { describe, expect, it, vi } from 'vitest'
import { effect } from 'vue'
import { clearRange } from '../src/services/editor/rangeSelection'
import { selectionState, resetSelectionState } from '../src/stores/selectionState'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
vi.mock('../src/services/dialogs/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)

describe('selection store', () => {
  it('is reactive for replaced and in-place edited cursors', () => {
    resetSelectionState()
    const seen: number[] = []
    const stop = effect(() => {
      seen.push(selectionState.cursor.beatId)
    })

    selectionState.cursor = { trackId: 0, voiceId: 0, blockId: 2, beatId: 1, string: 3 }
    selectionState.cursor.beatId = 4 // commands move the cursor in place

    expect(selectionState.cursor).toEqual({ trackId: 0, voiceId: 0, blockId: 2, beatId: 4, string: 3 })
    expect(seen).toEqual([0, 1, 4])
    stop.effect.stop()
  })

  it('clearRange empties the range', () => {
    resetSelectionState()
    selectionState.rangeStart = { trackId: 0, blockId: 1, voiceId: 0, beatId: 0, abstractTimePos: 0 }
    expect(selectionState.rangeStart?.blockId).toBe(1)
    clearRange()
    expect(selectionState.rangeStart).toBeNull()
    expect(selectionState.rangeEnd).toBeNull()
  })
})
