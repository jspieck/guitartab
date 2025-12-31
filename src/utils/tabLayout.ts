/**
 * Utility functions for calculating positions in the guitar tab layout
 */

import { getDurationBeats } from './durationUtils'

/**
 * Tab layout constants
 */
export const TAB_CONSTANTS = {
  STRING_SPACING: 12,
  MEASURE_WIDTH: 200,
  BEAT_WIDTH: 40,
  TAB_LABEL_WIDTH: 32,
  START_PADDING: 15,
  MIN_BEAT_DISPLAY_WIDTH: 20  // Minimum width for short notes (ensures clickability)
}

/**
 * Calculate the display width of a beat (with minimum for clickability)
 */
export function getDisplayWidth(duration: string | undefined): number {
  const beats = getDurationBeats(duration || 'q')
  const naturalWidth = beats * TAB_CONSTANTS.BEAT_WIDTH
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
  measures: any[], 
  measureIndex: number, 
  isFirstRow: boolean
): number {
  let offset = isFirstRow ? TAB_CONSTANTS.TAB_LABEL_WIDTH : 0
  for (let i = 0; i < measureIndex; i++) {
    const measure = measures[i]
    offset += measure.width || TAB_CONSTANTS.MEASURE_WIDTH
  }
  return offset
}

/**
 * Calculate the X position of a beat within a measure
 */
export function getBeatXOffset(
  measureData: any[], 
  beatIndex: number, 
  contentPadding: number = 0
): number {
  let beats = 0
  for (let i = 0; i < beatIndex; i++) {
    const beat = measureData[i]
    beats += getDurationInBeats(beat?.duration || 'q')
  }
  return contentPadding + TAB_CONSTANTS.START_PADDING + (beats * TAB_CONSTANTS.BEAT_WIDTH)
}

/**
 * Find which measure was clicked based on X position
 */
export function findMeasureAtPosition(
  measures: any[],
  relativeX: number
): { measureIndex: number; measureRelativeX: number } | null {
  let currentX = 0
  
  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i]
    const width = measure.width || TAB_CONSTANTS.MEASURE_WIDTH
    
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
  measureData: any[],
  beatX: number
): number {
  let currentBeatX = 0
  
  for (let i = 0; i < measureData.length; i++) {
    const beat = measureData[i]
    const duration = getDurationInBeats(beat?.duration || 'q')
    const width = duration * TAB_CONSTANTS.BEAT_WIDTH
    
    if (beatX >= currentBeatX && beatX < currentBeatX + width) {
      return i
    }
    
    currentBeatX += width
  }
  
  // Default to last beat if past the end, or first if before
  if (beatX < 0) return 0
  return Math.max(0, measureData.length - 1)
}

/**
 * Convert SVG click coordinates to tab position
 */
export function clickToTabPosition(
  event: MouseEvent,
  svgElement: SVGSVGElement,
  rowData: { measures: any[]; startBlockId: number },
  isFirstRow: boolean,
  getMeasureContentPadding: (blockId: number) => number
): { measureIndex: number; blockId: number; beatIndex: number } | null {
  // Get SVG coordinates
  const svgRect = svgElement.getBoundingClientRect()
  const svgPoint = svgElement.createSVGPoint()
  svgPoint.x = event.clientX
  svgPoint.y = event.clientY
  const transformedPoint = svgPoint.matrixTransform(svgElement.getScreenCTM()?.inverse())
  
  // Adjust for padding
  const paddingLeft = svgRect.width * (1 / 21)
  const adjustedX = transformedPoint.x - paddingLeft
  
  // Calculate relative X after TAB label offset
  const tabOffset = isFirstRow ? TAB_CONSTANTS.TAB_LABEL_WIDTH : 0
  const relativeX = adjustedX - tabOffset
  
  // Find measure
  const measureResult = findMeasureAtPosition(rowData.measures, relativeX)
  if (!measureResult) return null
  
  const { measureIndex, measureRelativeX } = measureResult
  const blockId = rowData.startBlockId + measureIndex
  
  // Find beat
  const padding = getMeasureContentPadding(blockId) + TAB_CONSTANTS.START_PADDING
  const beatX = measureRelativeX - padding
  const measureData = rowData.measures[measureIndex].data
  const beatIndex = findBeatAtPosition(measureData, beatX)
  
  return { measureIndex, blockId, beatIndex }
}
