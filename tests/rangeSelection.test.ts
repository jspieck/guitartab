import { beforeEach, describe, expect, it, vi } from 'vitest'
import Song from '../src/assets/js/songData'
import { selectionState, resetSelectionState } from '../src/stores/selectionState'
import { playbackLoopState } from '../src/stores/playbackLoopState'
import {
  applyRangeAsLoop,
  clearRange,
  currentLoopInterval,
  extendRange,
  notesInRange,
  rangeHasNotes,
  startRange,
} from '../src/services/editor/rangeSelection'

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

const beat = (duration: string, fret?: number) => ({
  ...Song.defaultMeasure(),
  duration: duration as never,
  notes: fret == null ? [] : [{ ...Song.defaultNote(), fret }],
})

describe('rangeSelection', () => {
  beforeEach(() => {
    Song.initEmptySong()
    resetSelectionState()
    clearRange()
    // bar 0: q(5) q- h(7); bar 1: w-
    Song.measures[0][0][0] = [beat('q', 5), beat('qr'), beat('h', 7)]
    Song.measures[0][1][0] = [beat('wr')]
  })

  it('records where in the bar each end is', () => {
    startRange(0, 0, 0, 1)
    extendRange(0, 0, 0, 2)
    // start of beat 1 = after one quarter; end of beat 2 = the whole bar
    expect(selectionState.rangeStart?.abstractTimePos).toBe(0.25)
    expect(selectionState.rangeEnd?.abstractTimePos).toBe(1)
  })

  it('becomes the loop interval only once the drag ends', () => {
    startRange(0, 0, 0, 0)
    expect(currentLoopInterval()).toBeNull()
    extendRange(0, 1, 0, 0)
    applyRangeAsLoop()
    expect(currentLoopInterval()).toMatchObject({ startBlock: 0, endBlock: 1 })
    expect(playbackLoopState.active).toBe(true)
    // a new click drops it again
    startRange(0, 1, 0, 0)
    expect(currentLoopInterval()).toBeNull()
    expect(playbackLoopState.active).toBe(false)
  })

  it('lists the notes in the loop interval, or the note under the cursor', () => {
    selectionState.cursor = { trackId: 0, voiceId: 0, blockId: 0, beatId: 2, string: 0 }
    expect(notesInRange()?.notes.map((n) => n.note.fret)).toEqual([7])

    startRange(0, 0, 0, 0)
    extendRange(0, 1, 0, 0)
    applyRangeAsLoop()
    const content = notesInRange()
    expect(content?.notes.map((n) => n.note.fret)).toEqual([5, 7])
    expect(content?.beats.map((b) => b.beatId)).toEqual([0, 2])
    expect(content?.blocks).toEqual([0, 1])
  })

  it('knows whether a range has notes, however it was dragged', () => {
    startRange(0, 0, 0, 1)
    extendRange(0, 0, 0, 1)
    expect(rangeHasNotes()).toBe(false) // only the rest
    extendRange(0, 0, 0, 0)
    expect(rangeHasNotes()).toBe(true) // dragged back over the first note
  })
})
