import renderBridge from '../services/editor/renderBridge'
import type { RenderedTabRow } from '../types/tab'
import {
  getBeatPositionInRow,
  getMeasureEndPositionInRow,
  getRowContentWidthFromLayout,
} from './beatPositionInRow'
import { getBeatXOffset, getDisplayWidth, getMeasureXOffset, TAB_CONSTANTS } from './tabLayout'

export interface OverlayPosition {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  abstractTimePos: number
}

export interface OverlaySelectionRect {
  x: number
  y: number
  width: number
  height: number
}

export interface NormalizedOverlayRange {
  blockIdStart: number
  blockIdEnd: number
  beatIdStart: number
  beatIdEnd: number
}

export function normalizeOverlayRange(start: OverlayPosition, end: OverlayPosition): NormalizedOverlayRange {
  const blockIdStart = start.blockId
  const blockIdEnd = end.blockId
  const beatIdStart = start.beatId
  const beatIdEnd = end.beatId

  if (blockIdStart < blockIdEnd) {
    return { blockIdStart, blockIdEnd, beatIdStart, beatIdEnd }
  }

  if (blockIdStart === blockIdEnd) {
    if (beatIdStart <= beatIdEnd) {
      return { blockIdStart, blockIdEnd, beatIdStart, beatIdEnd }
    }
    return {
      blockIdStart,
      blockIdEnd,
      beatIdStart: beatIdEnd,
      beatIdEnd: beatIdStart,
    }
  }

  return {
    blockIdStart: blockIdEnd,
    blockIdEnd: blockIdStart,
    beatIdStart: beatIdEnd,
    beatIdEnd: beatIdStart,
  }
}

function getBeatXInRow(
  trackId: number,
  voiceId: number,
  rowData: Pick<RenderedTabRow, 'startBlockId' | 'measures'>,
  blockId: number,
  beatId: number,
  isFirstRow: boolean,
  getMeasureContentPadding: (blockId: number) => number,
): number | null {
  const measureIndex = blockId - rowData.startBlockId
  if (measureIndex < 0 || measureIndex >= rowData.measures.length) {
    return null
  }

  const layoutX = getBeatPositionInRow(trackId, voiceId, blockId, beatId)
  if (layoutX != null) {
    return layoutX
  }

  const measure = rowData.measures[measureIndex]
  const measureX = getMeasureXOffset(rowData.measures, measureIndex, isFirstRow)
  const beatX = getBeatXOffset(measure.data, beatId, getMeasureContentPadding(blockId))
  return measureX + beatX
}

function getMeasureEndXInRow(
  trackId: number,
  voiceId: number,
  rowData: Pick<RenderedTabRow, 'startBlockId' | 'measures'>,
  blockId: number,
  isFirstRow: boolean,
): number | null {
  const measureIndex = blockId - rowData.startBlockId
  if (measureIndex < 0 || measureIndex >= rowData.measures.length) {
    return null
  }

  const layoutEnd = getMeasureEndPositionInRow(trackId, voiceId, blockId)
  if (layoutEnd != null) {
    return layoutEnd
  }

  const measureX = getMeasureXOffset(rowData.measures, measureIndex, isFirstRow)
  const measure = rowData.measures[measureIndex]
  return measureX + (measure.width || TAB_CONSTANTS.MEASURE_WIDTH)
}

function getRowContentWidth(
  trackId: number,
  voiceId: number,
  rowId: number,
  rowData: Pick<RenderedTabRow, 'measures'>,
  isFirstRow: boolean,
): number {
  const layoutWidth = getRowContentWidthFromLayout(trackId, voiceId, rowId)
  if (layoutWidth != null) {
    return layoutWidth
  }

  let width = isFirstRow ? TAB_CONSTANTS.TAB_LABEL_WIDTH : 0
  for (const measure of rowData.measures) {
    width += measure.width || TAB_CONSTANTS.MEASURE_WIDTH
  }
  return width
}

export function computeOverlayRectForRow(
  trackId: number,
  voiceId: number,
  rowId: number,
  rowData: Pick<RenderedTabRow, 'startBlockId' | 'measures'>,
  isFirstRow: boolean,
  range: NormalizedOverlayRange,
  beatCountInEndBlock: number,
  getMeasureContentPadding: (blockId: number) => number,
  numStrings: number,
): OverlaySelectionRect | null {
  const { blockIdStart, blockIdEnd, beatIdStart, beatIdEnd } = range

  const rowBegin = renderBridge.getRowIdForBlock(trackId, voiceId, blockIdStart)
  const rowEnd = renderBridge.getRowIdForBlock(trackId, voiceId, blockIdEnd)

  if (rowBegin == null || rowEnd == null || rowId < rowBegin || rowId > rowEnd) {
    return null
  }

  const xPosStart =
    rowId === rowBegin
      ? getBeatXInRow(
          trackId,
          voiceId,
          rowData,
          blockIdStart,
          beatIdStart,
          isFirstRow,
          getMeasureContentPadding,
        )
      : 0

  if (xPosStart == null) {
    return null
  }

  let xPosEnd: number | null
  if (rowId === rowEnd) {
    if (beatCountInEndBlock === beatIdEnd + 1) {
      xPosEnd = getMeasureEndXInRow(trackId, voiceId, rowData, blockIdEnd, isFirstRow)
    } else {
      xPosEnd = getBeatXInRow(
        trackId,
        voiceId,
        rowData,
        blockIdEnd,
        beatIdEnd + 1,
        isFirstRow,
        getMeasureContentPadding,
      )
    }
  } else {
    xPosEnd = getRowContentWidth(trackId, voiceId, rowId, rowData, isFirstRow)
  }

  if (xPosEnd == null) {
    return null
  }

  const width = xPosEnd - xPosStart
  if (width <= 0) {
    return null
  }

  const stringSpan = Math.max(0, (numStrings - 1) * TAB_CONSTANTS.STRING_SPACING)
  const height = stringSpan > 0 ? stringSpan : getDisplayWidth('q')

  return {
    x: xPosStart,
    y: 0,
    width,
    height,
  }
}
