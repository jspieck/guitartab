import { tabLayout } from '../../stores/tabLayoutState'
import { beatXInBar } from './beatGrouping'
import { getBeatPositionInRow } from '../../utils/beatPositionInRow'
import { registerPlaybackBarElement } from '../../stores/playbackBarState'
import {
  clearTrackRenderLayout,
  createRenderTrackLayoutState,
  getBlockRenderLayout,
  getRowRenderLayout,
  getTrackRenderLayout,
  setTrackRenderLayout,
  type RenderBlockLayout,
  type RenderRowLayout,
  type RenderTrackLayoutState,
} from '../../stores/tabRenderLayout'
import { getAvailableRowWidth } from '../../utils/tabSheetConstants'

function ensureTabLayoutArrays(trackId: number, voiceId: number) {
  if (!tabLayout.blockToRow[trackId]) tabLayout.blockToRow[trackId] = []
  if (!tabLayout.blockToRow[trackId][voiceId]) tabLayout.blockToRow[trackId][voiceId] = []

  if (!tabLayout.finalBlockWidths[trackId]) tabLayout.finalBlockWidths[trackId] = []
  if (!tabLayout.finalBlockWidths[trackId][voiceId]) tabLayout.finalBlockWidths[trackId][voiceId] = []

  if (!tabLayout.measureOffset[trackId]) tabLayout.measureOffset[trackId] = []
}

function syncTrackLayoutToTab(trackId: number, voiceId: number, state: RenderTrackLayoutState) {
  ensureTabLayoutArrays(trackId, voiceId)

  tabLayout.blockToRow[trackId][voiceId] = []
  tabLayout.finalBlockWidths[trackId][voiceId] = []

  state.blockLayouts.forEach((blockLayout, blockId) => {
    tabLayout.blockToRow[trackId][voiceId][blockId] = {
      rowId: blockLayout.rowId,
      numInRow: blockLayout.numInRow,
    }
    tabLayout.finalBlockWidths[trackId][voiceId][blockId] = blockLayout.width

    if (!tabLayout.measureOffset[trackId][blockId]) {
      tabLayout.measureOffset[trackId][blockId] = []
    }
    tabLayout.measureOffset[trackId][blockId][voiceId] = blockLayout.minOffset
  })
}

const renderBridge = {
  setTrackLayout(trackId: number, voiceId: number, state: RenderTrackLayoutState) {
    setTrackRenderLayout(trackId, voiceId, state)
    syncTrackLayoutToTab(trackId, voiceId, state)
  },

  clearTrackLayout(trackId: number, voiceId: number) {
    clearTrackRenderLayout(trackId, voiceId)
  },

  getTrackLayout(trackId: number, voiceId: number): RenderTrackLayoutState | null {
    return getTrackRenderLayout(trackId, voiceId)
  },

  getBlockLayout(trackId: number, voiceId: number, blockId: number): RenderBlockLayout | null {
    return getBlockRenderLayout(trackId, voiceId, blockId)
  },

  getRowLayout(trackId: number, voiceId: number, rowId: number): RenderRowLayout | null {
    return getRowRenderLayout(trackId, voiceId, rowId)
  },

  getRowIdForBlock(trackId: number, voiceId: number, blockId: number): number | null {
    return (
      getBlockRenderLayout(trackId, voiceId, blockId)?.rowId ??
      tabLayout.blockToRow?.[trackId]?.[voiceId]?.[blockId]?.rowId ??
      null
    )
  },

  getBlockX(trackId: number, voiceId: number, blockId: number): number {
    return getBlockRenderLayout(trackId, voiceId, blockId)?.xOffset ?? 0
  },

  getBlockWidth(trackId: number, voiceId: number, blockId: number): number {
    return (
      getBlockRenderLayout(trackId, voiceId, blockId)?.width ??
      tabLayout.finalBlockWidths?.[trackId]?.[voiceId]?.[blockId] ??
      0
    )
  },

  getMeasureOffset(trackId: number, voiceId: number, blockId: number): number {
    return (
      getBlockRenderLayout(trackId, voiceId, blockId)?.minOffset ??
      tabLayout.measureOffset?.[trackId]?.[blockId]?.[voiceId] ??
      0
    )
  },

  getRowY(trackId: number, voiceId: number, rowId: number): number {
    return getRowRenderLayout(trackId, voiceId, rowId)?.yOffset ?? 0
  },

  getRowHeight(trackId: number, voiceId: number, rowId: number): number {
    return getRowRenderLayout(trackId, voiceId, rowId)?.height ?? 0
  },

  getRowWidth(trackId: number, voiceId: number): number {
    return getTrackRenderLayout(trackId, voiceId)?.availableWidth ?? getAvailableRowWidth()
  },

  getPositionInRow(trackId: number, voiceId: number, blockId: number, beatId: number): number {
    const layoutPosition = getBeatPositionInRow(trackId, voiceId, blockId, beatId)
    if (layoutPosition != null) {
      return layoutPosition
    }

    // Fallback: beatXInBar is bar-local; add measure origin for row X.
    return beatXInBar(trackId, blockId, voiceId, beatId) + this.getBlockX(trackId, voiceId, blockId)
  },

  setPlaybackBarObject(object: SVGGElement | null) {
    registerPlaybackBarElement(object)
  },
}

export { createRenderTrackLayoutState }
export type { RenderBlockLayout, RenderRowLayout, RenderTrackLayoutState }
export { renderBridge }
export default renderBridge
