/**
 * Utility functions for calculating positions in the guitar tab layout
 */

import { stringLine } from './tabStrings'
import type { RenderedMeasureData, RenderedTabRow, RendererSelectionPosition, TabBeat } from '../types/tab'
import { getDurationBeats } from './durationUtils'
import { getBlockRenderLayout } from '../composables/useTabRenderLayout'
import { getBeatPositionInRow } from './beatPositionInRow'
import { getMeasureBeatWidth } from './measureBeatLayout'

/**
 * Tab layout constants
 */
export const TAB_CONSTANTS = {
  STRING_SPACING: 12,
  MEASURE_WIDTH: 200,
  BEAT_WIDTH: 40,
  TAB_LABEL_WIDTH: 32,
  START_PADDING: 15,
  MIN_BEAT_DISPLAY_WIDTH: 20,  // Minimum width for short notes (ensures clickability)
  PAGE_WIDTH: 1200,
  PAGE_HEIGHT: 1600
}

/**
 * Calculate the standard page margins
 */
export function getPageMargins(width: number = TAB_CONSTANTS.PAGE_WIDTH, height: number = TAB_CONSTANTS.PAGE_HEIGHT) {
  return {
    left: width * (1 / 21),
    top: height * (1 / 29.7)
  }
}

/**
 * Calculate the display width of a beat (with minimum for clickability)
 */
export function getDisplayWidth(duration: string | undefined): number {
  const beats = getDurationBeats(duration || 'q')
  const safeBeats = Number.isFinite(beats) && beats > 0 ? beats : 1
  const naturalWidth = safeBeats * TAB_CONSTANTS.BEAT_WIDTH

  if (!Number.isFinite(naturalWidth) || naturalWidth <= 0) {
    return TAB_CONSTANTS.MIN_BEAT_DISPLAY_WIDTH
  }

  return Math.max(naturalWidth, TAB_CONSTANTS.MIN_BEAT_DISPLAY_WIDTH)
}

/**
 * Get duration value in beats
 * @deprecated Use getDurationBeats from durationUtils instead
 */
export function getDurationInBeats(duration: string): number {
  return getDurationBeats(duration)
}

/**
 * Calculate the X offset for a measure within a row
 */
export function getMeasureXOffset(
  measures: RenderedMeasureData[], 
  measureIndex: number, 
  isFirstRow: boolean
): number {
  let offset = isFirstRow ? TAB_CONSTANTS.TAB_LABEL_WIDTH : 0
  for (let i = 0; i < measureIndex; i++) {
    const measure = measures[i]
    offset += Number.isFinite(measure.width) && measure.width > 0
      ? measure.width
      : TAB_CONSTANTS.MEASURE_WIDTH
  }
  return offset
}

/**
 * Calculate the X position of a beat within a measure
 */
export function getBeatXOffset(
  measureData: TabBeat[], 
  beatIndex: number, 
  contentPadding: number = 0
): number {
  let xOffset = 0
  for (let i = 0; i < beatIndex; i++) {
    const beat = measureData[i]
    xOffset += getDisplayWidth(beat?.duration)
  }
  return contentPadding + TAB_CONSTANTS.START_PADDING + xOffset
}

/**
 * Find which measure was clicked based on X position
 */
export function findMeasureAtPosition(
  measures: RenderedMeasureData[],
  relativeX: number
): { measureIndex: number; measureRelativeX: number } | null {
  let currentX = 0
  
  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i]
    const width = Number.isFinite(measure.width) && measure.width > 0
      ? measure.width
      : TAB_CONSTANTS.MEASURE_WIDTH
    
    if (relativeX >= currentX && relativeX < currentX + width) {
      return {
        measureIndex: i,
        measureRelativeX: relativeX - currentX
      }
    }
    currentX += width
  }
  
  return null
}

/**
 * Find which beat was clicked based on X position within a measure
 */
export function findBeatAtPosition(
  measureData: TabBeat[],
  beatX: number
): number {
  let currentBeatX = 0
  
  for (let i = 0; i < measureData.length; i++) {
    const beat = measureData[i]
    const width = getDisplayWidth(beat?.duration)
    
    if (beatX >= currentBeatX && beatX < currentBeatX + width) {
      return i
    }
    
    currentBeatX += width
  }
  
  // Default to last beat if past the end, or first if before
  if (beatX < 0) return 0
  return Math.max(0, measureData.length - 1)
}

function findBeatAtLayoutX(
  beatPositions: number[],
  measureRelativeX: number,
): number {
  if (beatPositions.length === 0) {
    return 0
  }

  let beatIndex = 0
  for (let i = 0; i < beatPositions.length; i += 1) {
    const beatX = beatPositions[i]
    if (!Number.isFinite(beatX)) {
      continue
    }
    if (measureRelativeX >= beatX) {
      beatIndex = i
    } else {
      break
    }
  }

  return beatIndex
}

function resolveBeatIndexInMeasure(
  trackId: number | undefined,
  voiceId: number | undefined,
  blockId: number,
  measureData: TabBeat[],
  measureRelativeX: number,
  contentPadding: number,
): number {
  if (trackId != null && voiceId != null) {
    const beatPositions = getBlockRenderLayout(trackId, voiceId, blockId)?.beatPositions
    if (Array.isArray(beatPositions) && beatPositions.length > 0) {
      return findBeatAtLayoutX(beatPositions, measureRelativeX)
    }
  }

  const beatX = measureRelativeX - contentPadding
  return findBeatAtPosition(measureData, beatX)
}

function getSvgViewportSize(svgElement: SVGSVGElement): { width: number; height: number } {
  const viewBoxWidth = svgElement.viewBox?.baseVal?.width
  const viewBoxHeight = svgElement.viewBox?.baseVal?.height
  const width = viewBoxWidth || svgElement.width?.baseVal?.value || TAB_CONSTANTS.PAGE_WIDTH
  const height = viewBoxHeight || svgElement.height?.baseVal?.value || TAB_CONSTANTS.PAGE_HEIGHT

  return { width, height }
}

/**
 * Page margins as actually applied to the tab content: the translate of the
 * SVG's content group. Recomputing them from the SVG size is wrong once the
 * sheet grows beyond one page (the SVG height is the whole song, while the
 * margins are derived from the page height).
 */
export function getSvgPageMargins(svgElement: SVGSVGElement) {
  const contentGroup = typeof svgElement.querySelector === 'function'
    ? svgElement.querySelector(':scope > g')
    : null
  const matrix = typeof SVGGraphicsElement !== 'undefined' && contentGroup instanceof SVGGraphicsElement
    ? contentGroup.transform.baseVal.consolidate()?.matrix
    : null
  if (matrix) {
    return { left: matrix.e, top: matrix.f }
  }
  const { width, height } = getSvgViewportSize(svgElement)
  return getPageMargins(width, height)
}

export function getSvgLocalPoint(
  event: Pick<MouseEvent, 'clientX' | 'clientY'>,
  svgElement: SVGSVGElement,
): { x: number; y: number } | null {
  const ctm = svgElement.getScreenCTM()
  if (!ctm) {
    return null
  }

  const point = svgElement.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY

  const transformedPoint = point.matrixTransform(ctm.inverse())
  return {
    x: transformedPoint.x,
    y: transformedPoint.y,
  }
}

export function getSvgScreenPoint(
  svgElement: SVGSVGElement,
  point: { x: number; y: number },
): { x: number; y: number } | null {
  const ctm = svgElement.getScreenCTM()
  if (!ctm) {
    return null
  }

  const svgPoint = svgElement.createSVGPoint()
  svgPoint.x = point.x
  svgPoint.y = point.y

  const transformedPoint = svgPoint.matrixTransform(ctm)
  return {
    x: transformedPoint.x,
    y: transformedPoint.y,
  }
}

/**
 * Convert SVG click coordinates to tab position
 */
export function clickToTabPosition(
  event: MouseEvent,
  svgElement: SVGSVGElement,
  rowData: Pick<RenderedTabRow, 'measures' | 'startBlockId'>,
  isFirstRow: boolean,
  getMeasureContentPadding: (blockId: number) => number,
  trackId?: number,
  voiceId?: number,
): { measureIndex: number; blockId: number; beatIndex: number } | null {
  const transformedPoint = getSvgLocalPoint(event, svgElement)
  if (!transformedPoint) {
    return null
  }
  
  // Adjust for padding
  const paddingLeft = getSvgPageMargins(svgElement).left
  const adjustedX = transformedPoint.x - paddingLeft
  
  // Calculate relative X after TAB label offset
  const tabOffset = isFirstRow ? TAB_CONSTANTS.TAB_LABEL_WIDTH : 0
  const relativeX = adjustedX - tabOffset
  
  // Find measure
  const measureResult = findMeasureAtPosition(rowData.measures, relativeX)
  if (!measureResult) return null
  
  const { measureIndex, measureRelativeX } = measureResult
  const blockId = rowData.startBlockId + measureIndex
  const padding = getMeasureContentPadding(blockId) + TAB_CONSTANTS.START_PADDING
  const measureData = rowData.measures[measureIndex].data
  const beatIndex = resolveBeatIndexInMeasure(
    trackId,
    voiceId,
    blockId,
    measureData,
    measureRelativeX,
    padding,
  )
  
  return { measureIndex, blockId, beatIndex }
}

export function findRowAtY(
  tabRows: RenderedTabRow[],
  localY: number,
  rowHeight: number,
  rowYOffsetAdjust = 0,
): RenderedTabRow | null {
  for (const row of tabRows) {
    // Rows with lanes own their full vertical span (annotations above the strings included).
    const rowTop = (row.top ?? row.yOffset) + rowYOffsetAdjust
    const height = row.height ?? rowHeight
    if (localY >= rowTop && localY < rowTop + height) {
      return row
    }
  }

  return tabRows.at(-1) ?? null
}

/** The string under `localY`: lines are counted from the top, strings from the lowest (see `tabStrings`). */
export function resolveStringIndexInRow(localY: number, rowYOffset: number, stringSpacing: number, numStrings: number): number {
  const line = Math.round((localY - rowYOffset) / stringSpacing)
  return stringLine(Math.min(numStrings - 1, Math.max(0, line)), numStrings)
}

export function resolveTabPointerPosition(
  event: MouseEvent,
  svgElement: SVGSVGElement,
  tabRows: RenderedTabRow[],
  rowHeight: number,
  stringSpacing: number,
  getMeasureContentPadding: (blockId: number) => number,
  rowYOffsetAdjust = 0,
  trackId?: number,
  voiceId?: number,
): {
  row: RenderedTabRow
  blockId: number
  beatIndex: number
  isFirstRow: boolean
} | null {
  const transformedPoint = getSvgLocalPoint(event, svgElement)
  if (!transformedPoint) {
    return null
  }

  const margins = getSvgPageMargins(svgElement)
  const localY = transformedPoint.y - margins.top
  const row = findRowAtY(tabRows, localY, rowHeight, rowYOffsetAdjust)
  if (!row) {
    return null
  }

  const isFirstRow = tabRows[0]?.id === row.id
  const beatPosition = clickToTabPosition(
    event,
    svgElement,
    row,
    isFirstRow,
    getMeasureContentPadding,
    trackId,
    voiceId,
  )
  if (!beatPosition) {
    return null
  }

  return {
    row,
    blockId: beatPosition.blockId,
    beatIndex: beatPosition.beatIndex,
    isFirstRow,
  }
}

export function getSelectionRenderPoint(
  rowData: Pick<RenderedTabRow, 'measures' | 'startBlockId'>,
  selection: RendererSelectionPosition,
  isFirstRow: boolean,
  stringSpacing: number,
  getMeasureContentPadding: (blockId: number) => number,
  trackId?: number,
  voiceId?: number,
  numStrings = 6,
): { x: number; y: number } | null {
  const measure = rowData.measures[selection.measureIndex]
  if (!measure || !measure.data?.[selection.beatIndex]) {
    return null
  }

  const y = stringLine(selection.stringIndex, numStrings) * stringSpacing

  if (trackId != null && voiceId != null) {
    const rowX = getBeatPositionInRow(trackId, voiceId, selection.blockId, selection.beatIndex)
    if (rowX != null) {
      // Same width TabNote centres its digit in (also correct for the last beat,
      // which has no following beat to measure against).
      const beatWidth = getMeasureBeatWidth(trackId, voiceId, selection.blockId, selection.beatIndex, measure.data)
      return {
        x: rowX + beatWidth / 2,
        y,
      }
    }
  }

  const measureX = getMeasureXOffset(rowData.measures, selection.measureIndex, isFirstRow)
  const beatX = getBeatXOffset(
    measure.data,
    selection.beatIndex,
    getMeasureContentPadding(selection.blockId),
  )

  return {
    x: measureX + beatX + getDisplayWidth(measure.data[selection.beatIndex]?.duration) / 2,
    y,
  }
}
