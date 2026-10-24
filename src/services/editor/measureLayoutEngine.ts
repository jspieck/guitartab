import { BAR_LEFT_PADDING, barLeftOffset } from '../../utils/measureBeatLayout'
import { groupMeasureBeats } from './beatGrouping'
import Duration from '../../utils/duration'
import Song from '../../stores/song'
import Settings, { EPSILON } from '../../stores/settingsState'
import { tabLayout } from '../../stores/tabLayoutState'
import { classicalNotation } from '../notation/classicalNotationAdapter'
import { TAB_CONSTANTS } from '../../utils/tabLayout'
import { getAvailableRowWidth, setTabNumRows } from '../../utils/tabSheetConstants'
import type { RenderedTabRow, TabBeat } from '../../types/tab'
import renderBridge, {
  createRenderTrackLayoutState,
  type RenderBlockLayout,
  type RenderTrackLayoutState,
} from './renderBridge'
import { getTrackRenderLayout } from '../../stores/tabRenderLayout'
import {
  classicalNotationLayoutState,
  getClassicalRowGeometry,
} from '../../stores/classicalNotationLayoutState'
import { computeRowLanes, type LaneBlockInput, type RowLanes } from '../../utils/tabRowLanes'
import { CLASSICAL_ROW_GAP, CLASSICAL_ROW_SEPARATION, TAB_ROW_GAP } from './tabLayoutMetrics'

export interface MeasureLayoutOptions {
  availableWidth: number
  headerHeight: number
  /** @deprecated Rows are sized from their content (see `tabRowLanes`). Ignored. */
  rowHeight?: number
  paddingTop: number
  tabInformationHeight: number
}

export type BlockWidthInfo = ReturnType<typeof computeBarWidth>

export interface MeasureLayoutResult {
  rows: RenderedTabRow[]
  state: RenderTrackLayoutState
  allWidths: BlockWidthInfo[]
}

export const DEFAULT_MEASURE_LAYOUT_OPTIONS = {
  headerHeight: 80,
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
    paddingTop,
    tabInformationHeight:
      overrides.tabInformationHeight ?? DEFAULT_MEASURE_LAYOUT_OPTIONS.tabInformationHeight,
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
  const leftOffset = barLeftOffset(blockId)
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
  if (!tabLayout.blocksPerRow[trackId]) tabLayout.blocksPerRow[trackId] = []
  if (!tabLayout.blocksPerRow[trackId][voiceId]) tabLayout.blocksPerRow[trackId][voiceId] = []
  if (!tabLayout.finalBlockWidths[trackId]) tabLayout.finalBlockWidths[trackId] = []
  if (!tabLayout.finalBlockWidths[trackId][voiceId]) tabLayout.finalBlockWidths[trackId][voiceId] = []
  if (!tabLayout.blockToRow[trackId]) tabLayout.blockToRow[trackId] = []
  if (!tabLayout.blockToRow[trackId][voiceId]) tabLayout.blockToRow[trackId][voiceId] = []
  if (!tabLayout.measureOffset[trackId]) tabLayout.measureOffset[trackId] = []
}

function syncTabLayoutArrays(
  trackId: number,
  voiceId: number,
  blocksPerRow: Array<{ start: number; end: number }>,
  finalBlockWidths: number[],
  blockToRow: Array<{ rowId: number; numInRow: number }>,
  measureOffsets: number[],
  allWidths: BlockWidthInfo[],
  numRows: number,
): void {
  ensureTabLayoutContainers(trackId, voiceId)

  tabLayout.blocksPerRow[trackId][voiceId] = blocksPerRow
  tabLayout.finalBlockWidths[trackId][voiceId] = finalBlockWidths
  tabLayout.blockToRow[trackId][voiceId] = blockToRow
  tabLayout.allWidths = allWidths

  measureOffsets.forEach((offset, blockId) => {
    if (!tabLayout.measureOffset[trackId][blockId]) {
      tabLayout.measureOffset[trackId][blockId] = []
    }
    tabLayout.measureOffset[trackId][blockId][voiceId] = offset
  })

  setTabNumRows(numRows)
}

function computeBlockWidth(trackId: number, blockId: number, voiceId: number): BlockWidthInfo {
  try {
    groupMeasureBeats(trackId, blockId, voiceId)
    return computeBarWidth(trackId, blockId, voiceId)
  } catch {
    console.warn(`Failed to compute width for measure ${blockId}, using default.`)
    return { minWidth: 200, minOffset: 40, num16ths: 4, padding: 0 }
  }
}

const previousLanes = new Map<string, { json: string; lanes: RowLanes }>()

/**
 * Lanes are passed to every measure of a row as a prop. Returning the previous
 * object when nothing changed keeps edits from re-rendering untouched measures.
 */
function reuseUnchangedLanes(key: string, lanes: RowLanes): RowLanes {
  const json = JSON.stringify(lanes)
  const previous = previousLanes.get(key)
  if (previous?.json === json) {
    return previous.lanes
  }
  previousLanes.set(key, { json, lanes })
  return lanes
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
  const blocksPerRow: Array<{ start: number; end: number }> = []
  const finalBlockWidths: number[] = []
  const blockToRow: Array<{ rowId: number; numInRow: number }> = []
  const measureOffsets: number[] = []

  if (measures.length === 0) {
    state.numRows = 0
    syncTabLayoutArrays(
      trackId,
      voiceId,
      blocksPerRow,
      finalBlockWidths,
      blockToRow,
      measureOffsets,
      allWidths,
      0,
    )
    renderBridge.setTrackLayout(trackId, voiceId, state)
    return { rows, state, allWidths }
  }

  const availableWidth = options.availableWidth
  const numStrings = Song.tracks[trackId]?.numStrings ?? 6
  const classicalActive = classicalNotationLayoutState.active
  const rowGap = classicalActive ? CLASSICAL_ROW_SEPARATION : TAB_ROW_GAP
  let nextRowTop = options.headerHeight
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
    const laneBlocks: LaneBlockInput[] = []

    for (let blockId = groupStart; blockId < groupEnd; blockId += 1) {
      const widthInfo = allWidths[blockId]
      const rawMinWidth =
        Number.isFinite(widthInfo.minWidth) && widthInfo.minWidth > 0
          ? widthInfo.minWidth
          : TAB_CONSTANTS.MEASURE_WIDTH
      const rawMinOffset =
        Number.isFinite(widthInfo.minOffset) && widthInfo.minOffset > 0
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

      laneBlocks.push({
        blockId,
        meta: Song.measureMeta[blockId],
        beats: voiceMeasures.map((beat, beatIndex) => ({
          beat,
          centerX:
            xOffset +
            blockLayout.beatPositions[beatIndex] +
            (Duration.getDurationWidth(beat) * minOffset) / 2,
        })),
      })
      xOffset += finalWidth

      rowMeasures.push({
        data: voiceMeasures,
        width: finalWidth,
      })
    }

    // Vertical layout: lanes above/below the strings, then the classical staff.
    const lanes = reuseUnchangedLanes(
      `${trackId}:${voiceId}:${rowId}`,
      computeRowLanes({ blocks: laneBlocks, numStrings, stringSpacing: TAB_CONSTANTS.STRING_SPACING }),
    )
    const top = nextRowTop
    const yOffset = top + lanes.overBarHeight
    let bottom = yOffset + lanes.bodyHeight
    if (classicalActive) {
      bottom += CLASSICAL_ROW_GAP + getClassicalRowGeometry(groupStart, groupEnd).height
    }
    nextRowTop = bottom + rowGap

    state.rowLayouts[rowId] = { yOffset, height: bottom - yOffset, top }
    rows.push({
      id: rowId,
      measures: rowMeasures,
      startBlockId: groupStart,
      endBlockId: groupEnd - 1,
      yOffset,
      top,
      height: bottom - top,
      lanes,
    })

    rowId += 1
  }

  for (let blockId = 0; blockId < measures.length; blockId += 1) {
    if (blockId === 0) {
      reachedWidth = TAB_CONSTANTS.TAB_LABEL_WIDTH
    }

    allWidths[blockId] = computeBlockWidth(trackId, blockId, voiceId)
    const blockMinWidth =
      Number.isFinite(allWidths[blockId].minWidth) && allWidths[blockId].minWidth > 0
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

/** Minimum width of a bar: padding for repeat/tempo/time signature plus a width per sixteenth. */
export function computeBarWidth(trackId: number, blockId: number, voiceId: number) {
  let padding = BAR_LEFT_PADDING * 2
  if (Song.measureMeta[blockId].repeatOpen) {
    padding += 20
  }
  if (Song.measureMeta[blockId].repeatClose != null) {
    padding += 10
  }
  if (blockId === 0 || Song.measureMeta[blockId].bpm != null) {
    padding += 43
    if (`${Song.measureMeta[blockId].bpm}`.length > 2) {
      padding += 8
    }
  } else if (blockId === 0 || Song.measureMeta[blockId].timeMeterPresent) {
    padding += 10
  }

  // run over all notes and get biggest size
  // Consider: Bend (width += 25), TremoloBar (width = 25), PalmMute (width = 20),
  // Trill (width = 13), note (width = 17), harmonic (width = 22),
  // stroke (width = 25 (note + arrow))
  // Varibale lengths: chords, texts & marker (not bigger than measure)
  const BASIC_OFFSET = 20
  let minOffsetPerNote = 25
  let numOf16th = 0
  const block = Song.measures[trackId][blockId][voiceId]

  for (let beatId = 0, n = block.length; beatId < n; beatId += 1) {
    // check beat effects
    const beat = block[beatId]
    const beatIn16ths = Duration.getDurationWidth(beat)
    numOf16th += beatIn16ths

    if (beat.effects != null) {
      if ((beat.effects.stroke != null || beat.effects.tremoloBar != null) && beatIn16ths === 1) {
        minOffsetPerNote = Math.max(minOffsetPerNote, BASIC_OFFSET + 5)
      }
    }
    // check note effects
    if (beat.notes != null) {
      for (let string = 0, w = beat.notes.length; string < w; string += 1) {
        const note = beat.notes[string]
        if (note != null) {
          if (note.bendObj != null && beatIn16ths === 1) {
            minOffsetPerNote = Math.max(minOffsetPerNote, BASIC_OFFSET + 17)
          }
        }
      }
    }
  }
  if (Settings.vexFlowIsActive) {
    const vexFlowOffset = classicalNotation.calculateLargestBeatWidth(trackId, blockId, voiceId)
    if (Number.isFinite(vexFlowOffset) && vexFlowOffset > minOffsetPerNote) {
      minOffsetPerNote = vexFlowOffset
    }
  }
  const minWidth = numOf16th * minOffsetPerNote + padding
  return {
    minWidth,
    minOffset: minOffsetPerNote,
    num16ths: numOf16th,
    padding,
  }
}

/** After an edit in a bar: whether its new width moves bars to other rows (then the track is laid out again). */
export function barWidthChangesRows(trackId: number, blockId: number, voiceId: number): boolean {
  if (Settings.vexFlowIsActive) {
    classicalNotation.convertBlockToNotation(trackId, blockId, voiceId)
  }
  if (!tabLayout.allWidths[blockId]) {
    return true
  }
  let completeRerenderNecessary =
    Math.abs(tabLayout.allWidths[blockId].minWidth - computeBarWidth(trackId, blockId, voiceId).minWidth) >
    EPSILON
  if (completeRerenderNecessary) {
    const { rowId } = tabLayout.blockToRow[trackId][voiceId][blockId]
    const oldMapping = tabLayout.blocksPerRow[trackId][voiceId][rowId]
    recomputeTrackLayoutFromSong(trackId, voiceId, getAvailableRowWidth())
    completeRerenderNecessary =
      oldMapping.start !== tabLayout.blocksPerRow[trackId][voiceId][rowId].start ||
      oldMapping.end !== tabLayout.blocksPerRow[trackId][voiceId][rowId].end
  }
  return completeRerenderNecessary
}

/** Lays a track's bars out into rows again (at the current sheet width). */
export function relayoutTrack(trackId: number, voiceId: number): void {
  recomputeTrackLayoutFromSong(trackId, voiceId, getAvailableRowWidth())
}
