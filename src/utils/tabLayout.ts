/**
 * Utility functions for calculating positions in the guitar tab layout
 */

import type { RenderedMeasureData, RenderedTabRow, TabBeat } from '../types/tab'
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
    offset += measure.width || TAB_CONSTANTS.MEASURE_WIDTH
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
  measures: RenderedMeasureData[],
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
  measureData: TabBeat[],
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
  rowData: Pick<RenderedTabRow, 'measures' | 'startBlockId'>,
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
