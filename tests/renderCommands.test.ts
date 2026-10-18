import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  requestBlockRender,
  requestBlocksRender,
  requestChordDiagramsRender,
  requestTrackDeleteRender,
} from '../src/services/editor/renderCommands'
import { typedEventBus } from '../src/utils/typedEventBus'

afterEach(() => {
  typedEventBus.clearAll()
})

describe('renderCommands', () => {
  it('emits typed block render requests', () => {
    const handler = vi.fn()
    typedEventBus.on('render.block', handler)

    requestBlockRender(1, 2, 0)

    expect(handler).toHaveBeenCalledWith({ trackId: 1, blockId: 2, voiceId: 0 })
  })

  it('emits typed multi-block render requests', () => {
    const handler = vi.fn()
    typedEventBus.on('render.blocks', handler)

    requestBlocksRender(1, [2, 3], 0)

    expect(handler).toHaveBeenCalledWith({ trackId: 1, blockIds: [2, 3], voiceId: 0 })
  })

  it('emits chord diagram refresh requests', () => {
    const handler = vi.fn()
    typedEventBus.on('render.chordDiagrams', handler)

    requestChordDiagramsRender()

    expect(handler).toHaveBeenCalledWith(undefined)
  })

  it('emits track delete render requests', () => {
    const handler = vi.fn()
    typedEventBus.on('render.deleteTrack', handler)

    requestTrackDeleteRender(2)

    expect(handler).toHaveBeenCalledWith({ trackId: 2 })
  })
})
