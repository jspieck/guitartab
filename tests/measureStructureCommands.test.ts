import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/editor/trackLoading', () => ({
  initTrackPlayback: vi.fn(),
}))

vi.mock('../src/stores/notificationState', () => ({
  showNotification: vi.fn(),
}))

vi.mock('../src/services/editor/renderCommands', () => ({
  requestDurationRender: vi.fn(),
  requestBlocksRender: vi.fn(),
}))

vi.mock('../src/services/editor/barFilling', () => ({
  fillMeasure: vi.fn(),
}))

vi.mock('../src/services/editor/layoutInvalidation', () => ({
  redrawTrack: vi.fn(),
}))

vi.mock('fastdom', () => ({
  default: {
    mutate: (fn: () => void) => fn(),
  },
}))

import Song from '../src/stores/song'
import { showNotification } from '../src/stores/notificationState'
import { initTrackPlayback } from '../src/services/editor/trackLoading'
import { undoHistory } from '../src/services/editor/editCommands'
import { selectionState } from '../src/stores/selectionState'
import { tabLayout } from '../src/stores/tabLayoutState'
import { fillMeasure } from '../src/services/editor/barFilling'
import { redrawTrack } from '../src/services/editor/layoutInvalidation'
import {
  addBlock,
  addMeasureSlot,
  createNewTrack,
  createMeasures,
  removeBlock,
} from '../src/services/editor/measureStructureCommands'

describe('measureStructureCommands', () => {
  beforeEach(() => {
    Song.initEmptySong()
    undoHistory.clear()
    vi.clearAllMocks()
    tabLayout.measureOffset = []
  })

  it('addMeasureSlot initializes a finite default offset', () => {
    addMeasureSlot(0, 0, 0)
    expect(tabLayout.measureOffset[0][0][0]).toBe(20)
  })

  it('createMeasures fills offsets for every measure', () => {
    createMeasures(0, 0)
    expect(tabLayout.measureOffset[0]).toHaveLength(Song.numMeasures)
    expect(tabLayout.measureOffset[0][Song.numMeasures - 1][0]).toBe(20)
  })

  it('addBlock appends a measure, undo removes it again', () => {
    const before = Song.numMeasures
    addBlock()
    expect(Song.numMeasures).toBe(before + 1)
    expect(fillMeasure).toHaveBeenCalled()
    expect(redrawTrack).toHaveBeenCalled()

    undoHistory.undo()
    expect(Song.numMeasures).toBe(before)
    expect(Song.measures[0]).toHaveLength(before)
    undoHistory.redo()
    expect(Song.numMeasures).toBe(before + 1)
  })

  it('removeBlock pops the last measure; undo brings its notes back', () => {
    const lastBar = Song.numMeasures - 1
    Song.measures[0][lastBar][0][0].text = 'last'
    selectionState.cursor = { trackId: 0, voiceId: 0, blockId: lastBar, beatId: 3, string: 0 }

    removeBlock()

    expect(Song.numMeasures).toBe(lastBar)
    expect(selectionState.cursor.blockId).toBe(lastBar - 1)
    expect(selectionState.cursor.beatId).toBe(0)

    undoHistory.undo()
    expect(Song.numMeasures).toBe(lastBar + 1)
    expect(Song.measures[0][lastBar][0][0].text).toBe('last')
    expect(Song.measureMeta).toHaveLength(lastBar + 1)
  })

  it('removeBlock offers an Undo that only reverts while the removal is the last edit', () => {
    const before = Song.numMeasures

    removeBlock()

    const [text, kind, action] = vi.mocked(showNotification).mock.calls.at(-1)!
    expect(text).toBe(`Removed bar ${before}`)
    expect(kind).toBe('info')
    expect(action?.label).toBe('Undo')

    addBlock() // a later edit: the banner must not undo it
    action!.run()
    expect(Song.numMeasures).toBe(before)

    undoHistory.undo() // undo the added bar; now the removal is the last edit again
    action!.run()
    expect(Song.numMeasures).toBe(before)
    expect(undoHistory.canUndo()).toBe(false)
  })

  it('createNewTrack seeds measures and offsets for a track', () => {
    createNewTrack(1, {
      name: 'Guitar',
      channel: 24,
      numStrings: 6,
      strings: [64, 59, 55, 50, 45, 40],
    })
    expect(Song.tracks[1].name).toBe('Guitar')
    expect(Song.measures[1]).toHaveLength(Song.numMeasures)
    expect(tabLayout.measureOffset[1][0][0]).toBe(20)
    expect(initTrackPlayback).toHaveBeenCalledWith(1)
  })
})
