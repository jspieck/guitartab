import Helper from '../../assets/js/helper'
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
} from '../../composables/useTabRenderLayout'
import { tab } from '../../assets/js/tab'
import { svgDrawer } from '../../assets/js/svgDrawer'

function ensureRendererArrays(trackId: number, voiceId: number) {
  svgDrawer.blockToPage = []

  if (!svgDrawer.blockToX[trackId]) svgDrawer.blockToX[trackId] = []
  if (!svgDrawer.rowToY[trackId]) svgDrawer.rowToY[trackId] = []
  if (!svgDrawer.rowToY[trackId][voiceId]) svgDrawer.rowToY[trackId][voiceId] = []
  if (!svgDrawer.heightOfRow[trackId]) svgDrawer.heightOfRow[trackId] = []
  if (!svgDrawer.heightOfRow[trackId][voiceId]) svgDrawer.heightOfRow[trackId][voiceId] = []

  if (!tab.blockToRow[trackId]) tab.blockToRow[trackId] = []
  if (!tab.blockToRow[trackId][voiceId]) tab.blockToRow[trackId][voiceId] = []

  if (!tab.finalBlockWidths[trackId]) tab.finalBlockWidths[trackId] = []
  if (!tab.finalBlockWidths[trackId][voiceId]) tab.finalBlockWidths[trackId][voiceId] = []

  if (!tab.measureOffset[trackId]) tab.measureOffset[trackId] = []
}

function syncTrackLayoutToLegacy(trackId: number, voiceId: number, state: RenderTrackLayoutState) {
  ensureRendererArrays(trackId, voiceId)

  svgDrawer.trackCreated = true
  svgDrawer.paddingTop = state.paddingTop
  svgDrawer.tabInformationHeight = state.tabInformationHeight
  svgDrawer.numRows = state.numRows
  svgDrawer.numPages = state.numPages
  svgDrawer.rowToY[trackId][voiceId] = []
  svgDrawer.heightOfRow[trackId][voiceId] = []
  tab.blockToRow[trackId][voiceId] = []
  tab.finalBlockWidths[trackId][voiceId] = []

  state.rowLayouts.forEach((rowLayout, rowId) => {
    svgDrawer.rowToY[trackId][voiceId][rowId] = rowLayout.yOffset
    svgDrawer.heightOfRow[trackId][voiceId][rowId] = rowLayout.height
  })

  state.blockLayouts.forEach((blockLayout, blockId) => {
    svgDrawer.blockToPage[blockId] = blockLayout.pageId

    if (!svgDrawer.blockToX[trackId][blockId]) svgDrawer.blockToX[trackId][blockId] = []
    svgDrawer.blockToX[trackId][blockId][voiceId] = blockLayout.xOffset

    tab.blockToRow[trackId][voiceId][blockId] = {
      rowId: blockLayout.rowId,
      numInRow: blockLayout.numInRow,
    }
    tab.finalBlockWidths[trackId][voiceId][blockId] = blockLayout.width

    if (!tab.measureOffset[trackId][blockId]) tab.measureOffset[trackId][blockId] = []
    tab.measureOffset[trackId][blockId][voiceId] = blockLayout.minOffset
  })
}

const legacyRenderBridge = {
  setTrackLayout(trackId: number, voiceId: number, state: RenderTrackLayoutState) {
    setTrackRenderLayout(trackId, voiceId, state)
    syncTrackLayoutToLegacy(trackId, voiceId, state)
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
    return getBlockRenderLayout(trackId, voiceId, blockId)?.rowId
      ?? tab.blockToRow?.[trackId]?.[voiceId]?.[blockId]?.rowId
      ?? null
  },

  getBlockX(trackId: number, voiceId: number, blockId: number): number {
    return getBlockRenderLayout(trackId, voiceId, blockId)?.xOffset
      ?? svgDrawer.blockToX?.[trackId]?.[blockId]?.[voiceId]
      ?? 0
  },

  getBlockWidth(trackId: number, voiceId: number, blockId: number): number {
    return getBlockRenderLayout(trackId, voiceId, blockId)?.width
      ?? tab.finalBlockWidths?.[trackId]?.[voiceId]?.[blockId]
      ?? 0
  },

  getMeasureOffset(trackId: number, voiceId: number, blockId: number): number {
    return getBlockRenderLayout(trackId, voiceId, blockId)?.minOffset
      ?? tab.measureOffset?.[trackId]?.[blockId]?.[voiceId]
      ?? 0
  },

  getRowY(trackId: number, voiceId: number, rowId: number): number {
    return getRowRenderLayout(trackId, voiceId, rowId)?.yOffset
      ?? svgDrawer.rowToY?.[trackId]?.[voiceId]?.[rowId]
      ?? 0
  },

  getRowHeight(trackId: number, voiceId: number, rowId: number): number {
    return getRowRenderLayout(trackId, voiceId, rowId)?.height
      ?? svgDrawer.heightOfRow?.[trackId]?.[voiceId]?.[rowId]
      ?? 0
  },

  getRowWidth(trackId: number, voiceId: number): number {
    return getTrackRenderLayout(trackId, voiceId)?.availableWidth ?? svgDrawer.getRowWidth()
  },

  getPositionInRow(trackId: number, voiceId: number, blockId: number, beatId: number): number {
    return Helper.getBeatPosX(trackId, blockId, voiceId, beatId)
      + this.getBlockX(trackId, voiceId, blockId)
  },

  setPlaybackBarObject(object: SVGGElement | null) {
    svgDrawer.playBackBarObjects = object ? [object] : []
  },
}

export { createRenderTrackLayoutState }
export type { RenderBlockLayout, RenderRowLayout, RenderTrackLayoutState }
export { legacyRenderBridge }
export default legacyRenderBridge