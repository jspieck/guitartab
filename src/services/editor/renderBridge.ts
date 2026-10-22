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
import { tab } from '../../assets/js/tab'
import { getAvailableRowWidth } from '../../utils/tabSheetConstants'

function ensureTabLayoutArrays(trackId: number, voiceId: number) {
  if (!tab.blockToRow[trackId]) tab.blockToRow[trackId] = []
  if (!tab.blockToRow[trackId][voiceId]) tab.blockToRow[trackId][voiceId] = []

  if (!tab.finalBlockWidths[trackId]) tab.finalBlockWidths[trackId] = []
  if (!tab.finalBlockWidths[trackId][voiceId]) tab.finalBlockWidths[trackId][voiceId] = []

  if (!tab.measureOffset[trackId]) tab.measureOffset[trackId] = []
}

function syncTrackLayoutToTab(trackId: number, voiceId: number, state: RenderTrackLayoutState) {
  ensureTabLayoutArrays(trackId, voiceId)

  tab.blockToRow[trackId][voiceId] = []
  tab.finalBlockWidths[trackId][voiceId] = []

  state.blockLayouts.forEach((blockLayout, blockId) => {
    tab.blockToRow[trackId][voiceId][blockId] = {
      rowId: blockLayout.rowId,
      numInRow: blockLayout.numInRow,
    }
    tab.finalBlockWidths[trackId][voiceId][blockId] = blockLayout.width

    if (!tab.measureOffset[trackId][blockId]) {
      tab.measureOffset[trackId][blockId] = []
    }
    tab.measureOffset[trackId][blockId][voiceId] = blockLayout.minOffset
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
      tab.blockToRow?.[trackId]?.[voiceId]?.[blockId]?.rowId ??
      null
    )
  },

  getBlockX(trackId: number, voiceId: number, blockId: number): number {
    return getBlockRenderLayout(trackId, voiceId, blockId)?.xOffset ?? 0
  },

  getBlockWidth(trackId: number, voiceId: number, blockId: number): number {
    return (
      getBlockRenderLayout(trackId, voiceId, blockId)?.width ??
      tab.finalBlockWidths?.[trackId]?.[voiceId]?.[blockId] ??
      0
    )
  },

  getMeasureOffset(trackId: number, voiceId: number, blockId: number): number {
    return (
      getBlockRenderLayout(trackId, voiceId, blockId)?.minOffset ??
      tab.measureOffset?.[trackId]?.[blockId]?.[voiceId] ??
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
