import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/assets/js/appManager', () => ({
  default: {
    duringTrackCreation: false,
    setTracks: vi.fn(),
  },
}))

vi.mock('../src/assets/js/sequencerHandler', () => ({
  sequencerHandler: {
    redrawSequencerMain: vi.fn(),
  },
}))

vi.mock('../src/assets/js/revertHandler', () => ({
  revertHandler: {
    addBlock: vi.fn(),
    removeBlock: vi.fn(),
  },
}))

vi.mock('../src/services/editor/renderCommands', () => ({
  requestDurationRender: vi.fn(),
}))

vi.mock('fastdom', () => ({
  default: {
    mutate: (fn: () => void) => fn(),
  },
}))

import Song from '../src/assets/js/songData'
import AppManager from '../src/assets/js/appManager'
import { revertHandler } from '../src/assets/js/revertHandler'
import {
  addBlock,
  addTakt,
  createNewTrack,
  createTakte,
  initEmptyTab,
  removeBlock,
} from '../src/services/editor/measureStructureCommands'

function createHost() {
  return {
    measureOffset: [] as number[][][],
    markedNoteObj: null as null | {
      trackId: number
      voiceId: number
      blockId: number
      beatId: number
      string: number
    },
    fillMeasure: vi.fn(),
    drawTrack: vi.fn(),
  }
}

describe('measureStructureCommands', () => {
  beforeEach(() => {
    Song.initEmptySong()
    AppManager.duringTrackCreation = false
    vi.clearAllMocks()
  })

  it('addTakt initializes a finite default offset', () => {
    const host = createHost()
    addTakt(host, 0, 0, 0)
    expect(host.measureOffset[0][0][0]).toBe(20)
  })

  it('createTakte fills offsets for every measure', () => {
    const host = createHost()
    createTakte(host, 0, 0)
    expect(host.measureOffset[0]).toHaveLength(Song.numMeasures)
    expect(host.measureOffset[0][Song.numMeasures - 1][0]).toBe(20)
  })

  it('addBlock appends a measure and records undo', () => {
    const host = createHost()
    const before = Song.numMeasures
    addBlock(host, false)
    expect(Song.numMeasures).toBe(before + 1)
    expect(host.fillMeasure).toHaveBeenCalled()
    expect(host.drawTrack).toHaveBeenCalled()
    expect(revertHandler.addBlock).toHaveBeenCalled()
  })

  it('addBlock skips undo while restoring', () => {
    const host = createHost()
    addBlock(host, true)
    expect(revertHandler.addBlock).not.toHaveBeenCalled()
  })

  it('removeBlock pops the last measure and records undo', () => {
    const host = createHost()
    addBlock(host, true)
    host.markedNoteObj = {
      trackId: 0, voiceId: 0, blockId: Song.numMeasures - 1, beatId: 3, string: 0,
    }
    const before = Song.numMeasures

    removeBlock(host, false)

    expect(Song.numMeasures).toBe(before - 1)
    expect(host.markedNoteObj.blockId).toBe(Song.numMeasures - 1)
    expect(host.markedNoteObj.beatId).toBe(0)
    expect(revertHandler.removeBlock).toHaveBeenCalled()
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
    expect(AppManager.setTracks).toHaveBeenCalledWith(1)
  })

  it('initEmptyTab clears measure helpers and fills rests', () => {
    Song.measureMoveHelper[0] = [{ beatId: 1 } as any]
    initEmptyTab()
    expect(Song.measureMoveHelper).toHaveLength(1)
    expect(Song.measures[0]).toHaveLength(Song.numMeasures)
    expect(Song.measures[0][0][0].length).toBeGreaterThan(0)
  })
})
