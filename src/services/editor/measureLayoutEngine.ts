import Helper from '../../assets/js/helper'
import Duration from '../../assets/js/duration'
import Song from '../../assets/js/songData'
import { Tab, tab } from '../../assets/js/tab'
import { TAB_CONSTANTS } from '../../utils/tabLayout'
import { setTabNumRows } from '../../utils/tabSheetConstants'
import type { RenderedTabRow, TabBeat } from '../../types/tab'
import renderBridge, {
  createRenderTrackLayoutState,
  type RenderBlockLayout,
  type RenderTrackLayoutState,
} from './renderBridge'
import { getTrackRenderLayout } from '../../composables/useTabRenderLayout'

export interface MeasureLayoutOptions {
  availableWidth: number
  headerHeight: number
  rowHeight: number
  paddingTop: number
  tabInformationHeight: number
}

export type BlockWidthInfo = ReturnType<typeof Tab.computeWidthOfBlock>

export interface MeasureLayoutResult {
  rows: RenderedTabRow[]
  state: RenderTrackLayoutState
  allWidths: BlockWidthInfo[]
}

export const DEFAULT_MEASURE_LAYOUT_OPTIONS = {
  headerHeight: 80,
  rowHeight: 120,
  tabInformationHeight: 80,
} as const

export function resolveMeasureLayoutOptions(
  availableWidth: number,
  overrides: Partial<MeasureLayoutOptions> = {},
): MeasureLayoutOptions {
  const paddingTop = overrides.paddingTop ?? availableWidth * (1 / 21)
  return {
    availableWidth,
    headerHeight: overrides.headerHeight ?? DEFAULT_MEASURE_LAYOUT_OPTIONS.headerHeight,
    rowHeight: overrides.rowHeight ?? DEFAULT_MEASURE_LAYOUT_OPTIONS.rowHeight,
    paddingTop,
    tabInformationHeight: overrides.tabInformationHeight ?? DEFAULT_MEASURE_LAYOUT_OPTIONS.tabInformationHeight,
  }
}

export function resolveLayoutOptionsForTrack(
  trackId: number,
  voiceId: number,
  fallbackAvailableWidth: number,
  overrides: Partial<MeasureLayoutOptions> = {},
): MeasureLayoutOptions {
  const existing = getTrackRenderLayout(trackId, voiceId)
  const availableWidth = existing?.availableWidth ?? fallbackAvailableWidth
  return resolveMeasureLayoutOptions(availableWidth, {
    paddingTop: existing?.paddingTop,
    tabInformationHeight: existing?.tabInformationHeight,
    ...overrides,
  })
}

function getBeatRenderPositions(
  trackId: number,
  blockId: number,
  voiceId: number,
  beats: TabBeat[],
  minOffset: number,
): number[] {
  const leftOffset = Helper.getLeftOffset(blockId)
  const safeMinOffset = Number.isFinite(minOffset) && minOffset > 0 ? minOffset : TAB_CONSTANTS.BEAT_WIDTH
  const moveHelper = Song.measureMoveHelper?.[trackId]?.[blockId]?.[voiceId]

  if (Array.isArray(moveHelper) && moveHelper.length >= beats.length) {
    return beats.map((_, beatIndex) => {
      const beatOffset = moveHelper[beatIndex]
      return Number.isFinite(beatOffset) ? leftOffset + beatOffset * safeMinOffset : leftOffset
    })
  }

  let position = leftOffset
  return beats.map((beat) => {
    const currentPosition = position
    position += Duration.getDurationWidth(beat) * safeMinOffset
    return currentPosition
  })
}

function ensureTabLayoutContainers(trackId: number, voiceId: number): void {
  if (!tab.blocksPerRow[trackId]) tab.blocksPerRow[trackId] = []
  if (!tab.blocksPerRow[trackId][voiceId]) tab.blocksPerRow[trackId][voiceId] = []
  if (!tab.finalBlockWidths[trackId]) tab.finalBlockWidths[trackId] = []
  if (!tab.finalBlockWidths[trackId][voiceId]) tab.finalBlockWidths[trackId][voiceId] = []
  if (!tab.blockToRow[trackId]) tab.blockToRow[trackId] = []
  if (!tab.blockToRow[trackId][voiceId]) tab.blockToRow[trackId][voiceId] = []
  if (!tab.measureOffset[trackId]) tab.measureOffset[trackId] = []
}

function syncTabLayoutArrays(
  trackId: number,
  voiceId: number,
  blocksPerRow: Array<{ start: number, end: number }>,
  finalBlockWidths: number[],
  blockToRow: Array<{ rowId: number, numInRow: number }>,
  measureOffsets: number[],
  allWidths: BlockWidthInfo[],
  numRows: number,
): void {
  ensureTabLayoutContainers(trackId, voiceId)

  tab.blocksPerRow[trackId][voiceId] = blocksPerRow
  tab.finalBlockWidths[trackId][voiceId] = finalBlockWidths
  tab.blockToRow[trackId][voiceId] = blockToRow
  tab.allWidths = allWidths

  measureOffsets.forEach((offset, blockId) => {
    if (!tab.measureOffset[trackId][blockId]) {
      tab.measureOffset[trackId][blockId] = []
    }
    tab.measureOffset[trackId][blockId][voiceId] = offset
  })

  setTabNumRows(numRows)
}

function computeBlockWidth(
  trackId: number,
  blockId: number,
  voiceId: number,
): BlockWidthInfo {
  try {
    Helper.groupMeasureBeats(trackId, blockId, voiceId)
    return Tab.computeWidthOfBlock(trackId, blockId, voiceId)
  } catch {
    console.warn(`Failed to compute width for measure ${blockId}, using default.`)
    return { minWidth: 200, minOffset: 40, num16ths: 4, padding: 0 }
  }
}

export function computeTrackLayout(
  trackId: number,
  voiceId: number,
  measures: Array<TabBeat[][] | undefined>,
  options: MeasureLayoutOptions,
): MeasureLayoutResult {
  const rows: RenderedTabRow[] = []
  const state = createRenderTrackLayoutState({
    availableWidth: options.availableWidth,
    paddingTop: options.paddingTop,
    tabInformationHeight: options.tabInformationHeight,
  })

  const allWidths: BlockWidthInfo[] = []
  const blocksPerRow: Array<{ start: number, end: number }> = []
  const finalBlockWidths: number[] = []
  const blockToRow: Array<{ rowId: number, numInRow: number }> = []
  const measureOffsets: number[] = []

  if (measures.length === 0) {
    state.numRows = 0
    syncTabLayoutArrays(trackId, voiceId, blocksPerRow, finalBlockWidths, blockToRow, measureOffsets, allWidths, 0)
    renderBridge.setTrackLayout(trackId, voiceId, state)
    return { rows, state, allWidths }
  }

  const availableWidth = options.availableWidth
  let rowId = 0
  let groupStartIndex = 0
  let reachedWidth = 0

  const assignRow = (groupStart: number, groupEnd: number, rowReachedWidth: number) => {
    const diff = availableWidth - rowReachedWidth
    const numMeasures = groupEnd - groupStart
    const extraWidth = numMeasures > 0 ? Math.floor(diff / numMeasures) : 0

    blocksPerRow[rowId] = { start: groupStart, end: groupEnd }

    let xOffset = rowId === 0 ? TAB_CONSTANTS.TAB_LABEL_WIDTH : 0
    const rowMeasures: RenderedTabRow['measures'] = []

    for (let blockId = groupStart; blockId < groupEnd; blockId += 1) {
      const widthInfo = allWidths[blockId]
      const rawMinWidth = Number.isFinite(widthInfo.minWidth) && widthInfo.minWidth > 0
        ? widthInfo.minWidth
        : TAB_CONSTANTS.MEASURE_WIDTH
      const rawMinOffset = Number.isFinite(widthInfo.minOffset) && widthInfo.minOffset > 0
        ? widthInfo.minOffset
        : TAB_CONSTANTS.BEAT_WIDTH
      const num16ths = Math.max(1, widthInfo.num16ths || 0)
      const finalWidth = rawMinWidth + extraWidth
      const minOffset = rawMinOffset + extraWidth / num16ths

      finalBlockWidths[blockId] = finalWidth
      measureOffsets[blockId] = minOffset

      const numInRow = blockId - groupStart
      blockToRow[blockId] = { rowId, numInRow }

      const voiceMeasures = (measures[blockId]?.[voiceId] || []) as TabBeat[]
      const blockLayout: RenderBlockLayout = {
        xOffset,
        rowId,
        numInRow,
        width: finalWidth,
        minOffset,
        pageId: 0,
        beatPositions: getBeatRenderPositions(trackId, blockId, voiceId, voiceMeasures, minOffset),
      }
      state.blockLayouts[blockId] = blockLayout
      xOffset += finalWidth

      rowMeasures.push({
        data: voiceMeasures,
        width: finalWidth,
      })
    }

    const yOffset = options.headerHeight + rowId * options.rowHeight
    state.rowLayouts[rowId] = { yOffset, height: options.rowHeight }
    rows.push({
      id: rowId,
      measures: rowMeasures,
      startBlockId: groupStart,
      endBlockId: groupEnd - 1,
      yOffset,
    })

    rowId += 1
  }

  for (let blockId = 0; blockId < measures.length; blockId += 1) {
    if (blockId === 0) {
      reachedWidth = TAB_CONSTANTS.TAB_LABEL_WIDTH
    }

    allWidths[blockId] = computeBlockWidth(trackId, blockId, voiceId)
    const blockMinWidth = Number.isFinite(allWidths[blockId].minWidth) && allWidths[blockId].minWidth > 0
      ? allWidths[blockId].minWidth
      : TAB_CONSTANTS.MEASURE_WIDTH

    if (reachedWidth + blockMinWidth > availableWidth && blockId > groupStartIndex) {
      assignRow(groupStartIndex, blockId, reachedWidth)
      groupStartIndex = blockId
      reachedWidth = 0
    }

    reachedWidth += blockMinWidth
  }

  assignRow(groupStartIndex, measures.length, reachedWidth)

  state.numRows = rows.length
  syncTabLayoutArrays(
    trackId,
    voiceId,
    blocksPerRow,
    finalBlockWidths,
    blockToRow,
    measureOffsets,
    allWidths,
    rows.length,
  )
  renderBridge.setTrackLayout(trackId, voiceId, state)

  return { rows, state, allWidths }
}

export function computeTrackLayoutFromSong(
  trackId: number,
  voiceId: number,
  options: MeasureLayoutOptions,
): MeasureLayoutResult {
  return computeTrackLayout(trackId, voiceId, Song.measures[trackId] || [], options)
}

export function recomputeTrackLayoutFromSong(
  trackId: number,
  voiceId: number,
  fallbackAvailableWidth: number,
  overrides: Partial<MeasureLayoutOptions> = {},
): MeasureLayoutResult {
  const options = resolveLayoutOptionsForTrack(trackId, voiceId, fallbackAvailableWidth, overrides)
  return computeTrackLayoutFromSong(trackId, voiceId, options)
}
