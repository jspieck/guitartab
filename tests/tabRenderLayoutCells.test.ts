import { describe, expect, it } from 'vitest'
import { effect } from 'vue'
import {
  clearTrackRenderLayout,
  createRenderTrackLayoutState,
  getBlockRenderLayout,
  setTrackRenderLayout,
  type RenderBlockLayout,
} from '../src/stores/tabRenderLayout'

function block(xOffset: number, beatPositions = [10, 40]): RenderBlockLayout {
  return { xOffset, rowId: 0, numInRow: 0, width: 200, minOffset: 30, pageId: 0, beatPositions }
}

function stateWith(blocks: RenderBlockLayout[]) {
  const state = createRenderTrackLayoutState({ availableWidth: 1000, paddingTop: 0, tabInformationHeight: 0 })
  state.blockLayouts = blocks
  return state
}

describe('per-block render layout cells', () => {
  it('only notifies readers of blocks whose geometry changed', () => {
    setTrackRenderLayout(9, 0, stateWith([block(0), block(200)]))

    const runs = [0, 0]
    effect(() => {
      void getBlockRenderLayout(9, 0, 0)
      runs[0] += 1
    })
    effect(() => {
      void getBlockRenderLayout(9, 0, 1)
      runs[1] += 1
    })

    const firstBefore = getBlockRenderLayout(9, 0, 0)
    setTrackRenderLayout(9, 0, stateWith([block(0), block(200, [10, 55])]))

    expect(runs).toEqual([1, 2])
    expect(getBlockRenderLayout(9, 0, 0)).toBe(firstBefore)
    expect(getBlockRenderLayout(9, 0, 1)?.beatPositions).toEqual([10, 55])
  })

  it('drops cells for blocks that no longer exist', () => {
    setTrackRenderLayout(8, 0, stateWith([block(0), block(200)]))
    setTrackRenderLayout(8, 0, stateWith([block(0)]))
    expect(getBlockRenderLayout(8, 0, 1)).toBeNull()

    clearTrackRenderLayout(8, 0)
    expect(getBlockRenderLayout(8, 0, 0)).toBeNull()
  })
})
