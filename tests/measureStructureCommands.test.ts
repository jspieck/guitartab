import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/assets/js/appManager', () => ({
  default: {
    duringTrackCreation: false,
  },
}))

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

vi.mock('fastdom', () => ({
  default: {
    mutate: (fn: () => void) => fn(),
  },
}))

import Song from '../src/assets/js/songData'
import AppManager from '../src/assets/js/appManager'
import { showNotification } from '../src/stores/notificationState'
import { initTrackPlayback } from '../src/services/editor/trackLoading'
import { undoHistory } from '../src/services/editor/editCommands'
import { selectionState } from '../src/stores/selectionState'
import {
  addBlock,
  addMeasureSlot,
  createNewTrack,
  createMeasures,
  initEmptyTab,
  removeBlock,
} from '../src/services/editor/measureStructureCommands'

function createHost() {
  return {
    measureOffset: [] as number[][][],
    fillMeasure: vi.fn(),
    drawTrack: vi.fn(),
  }
}

describe('measureStructureCommands', () => {
  beforeEach(() => {
    Song.initEmptySong()
    undoHistory.clear()
    AppManager.duringTrackCreation = false
    vi.clearAllMocks()
  })

  it('addMeasureSlot initializes a finite default offset', () => {
    const host = createHost()
    addMeasureSlot(host, 0, 0, 0)
    expect(host.measureOffset[0][0][0]).toBe(20)
  })

  it('createMeasures fills offsets for every measure', () => {
    const host = createHost()
    createMeasures(host, 0, 0)
    expect(host.measureOffset[0]).toHaveLength(Song.numMeasures)
    expect(host.measureOffset[0][Song.numMeasures - 1][0]).toBe(20)
  })

  it('addBlock appends a measure, undo removes it again', () => {
    const host = createHost()
    const before = Song.numMeasures
    addBlock(host)
    expect(Song.numMeasures).toBe(before + 1)
    expect(host.fillMeasure).toHaveBeenCalled()
    expect(host.drawTrack).toHaveBeenCalled()

    undoHistory.undo()
    expect(Song.numMeasures).toBe(before)
    expect(Song.measures[0]).toHaveLength(before)
    undoHistory.redo()
    expect(Song.numMeasures).toBe(before + 1)
  })

  it('removeBlock pops the last measure; undo brings its notes back', () => {
    const host = createHost()
    const lastBar = Song.numMeasures - 1
    Song.measures[0][lastBar][0][0].text = 'last'
    selectionState.cursor = { trackId: 0, voiceId: 0, blockId: lastBar, beatId: 3, string: 0 }

    removeBlock(host)

    expect(Song.numMeasures).toBe(lastBar)
    expect(selectionState.cursor.blockId).toBe(lastBar - 1)
    expect(selectionState.cursor.beatId).toBe(0)

    undoHistory.undo()
    expect(Song.numMeasures).toBe(lastBar + 1)
    expect(Song.measures[0][lastBar][0][0].text).toBe('last')
    expect(Song.measureMeta).toHaveLength(lastBar + 1)
  })

  it('removeBlock offers an Undo that only reverts while the removal is the last edit', () => {
    const host = createHost()
    const before = Song.numMeasures

    removeBlock(host)

    const [text, kind, action] = vi.mocked(showNotification).mock.calls.at(-1)!
    expect(text).toBe(`Removed bar ${before}`)
    expect(kind).toBe('info')
    expect(action?.label).toBe('Undo')

    addBlock(host) // a later edit: the banner must not undo it
    action!.run()
    expect(Song.numMeasures).toBe(before)

    undoHistory.undo() // undo the added bar; now the removal is the last edit again
    action!.run()
    expect(Song.numMeasures).toBe(before)
    expect(undoHistory.canUndo()).toBe(false)
  })

  it('createNewTrack seeds measures and offsets for a track', () => {
    const host = createHost()
    createNewTrack(host, 1, {
      name: 'Guitar',
      channel: 24,
      numStrings: 6,
      strings: [64, 59, 55, 50, 45, 40],
    })
    expect(Song.tracks[1].name).toBe('Guitar')
    expect(Song.measures[1]).toHaveLength(Song.numMeasures)
    expect(host.measureOffset[1][0][0]).toBe(20)
    expect(initTrackPlayback).toHaveBeenCalledWith(1)
  })

  it('initEmptyTab clears measure helpers and fills rests', () => {
    Song.measureMoveHelper[0] = [{ beatId: 1 } as any]
    initEmptyTab()
    expect(Song.measureMoveHelper).toHaveLength(1)
    expect(Song.measures[0]).toHaveLength(Song.numMeasures)
    expect(Song.measures[0][0][0].length).toBeGreaterThan(0)
  })
})
