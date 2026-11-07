import { toRaw } from 'vue'
import { BAR_LEFT_PADDING, barLeftOffset, keySignatureRoom } from '../../utils/measureBeatLayout'
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
import { estimateLyricWidth } from '../../utils/lyrics'
import { tabStemsGoUp } from '../../utils/otherVoiceNotes'
import { hiddenBars, multiRestRuns } from '../../utils/multiRests'
import { computeScoreLayout, scoreTrackIds } from './scoreLayout'
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
  rowStart: boolean,
): number[] {
  const leftOffset = barLeftOffset(blockId, rowStart)
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

/** Room for the H-bar of a multi-bar rest, besides the bar's own padding. */
const MULTI_REST_WIDTH = 110
/** Beat spacing inside bars hidden by a multi-bar rest: their beats sit on the bar line. */
const HIDDEN_BAR_OFFSET = 0.001

/**
 * A bar's width in its row and its spacing per sixteenth: its own width plus its share of the
 * row's spare room; a multi-bar rest spreads its rests over the whole H-bar; a bar hidden in
 * one takes no room.
 */
function barSpacing(
  widthInfo: BlockWidthInfo,
  bar: { displayWidth: number; extraWidth: number; isHidden: boolean; isMultiRest: boolean },
): { width: number; minOffset: number } {
  if (bar.isHidden) return { width: 0, minOffset: HIDDEN_BAR_OFFSET }
  const rawMinOffset =
    Number.isFinite(widthInfo.minOffset) && widthInfo.minOffset > 0
      ? widthInfo.minOffset
      : TAB_CONSTANTS.BEAT_WIDTH
  const num16ths = Math.max(1, widthInfo.num16ths || 0)
  const width = bar.displayWidth + bar.extraWidth
  const minOffset = bar.isMultiRest
    ? Math.max(rawMinOffset, (width - widthInfo.padding) / num16ths)
    : rawMinOffset + bar.extraWidth / num16ths
  return { width, minOffset }
}

/** Drum tracks name their lines at the start of every row (`utils/drumMap.ts`). */
export function isDrumLayout(trackId: number): boolean {
  return Song.playBackInstrument[trackId]?.instrument === 'drums'
}

/** The multi-bar rests of a track (empty when the view option is off), keyed for comparison. */
function currentMultiRests(trackId: number, measures: Array<TabBeat[][] | undefined>) {
  if (!Settings.multiBarRests) return { runs: new Map<number, number>(), key: '' }
  const runs = multiRestRuns(measures, Song.measureMeta, Song.tracks[trackId], isDrumLayout(trackId))
  return { runs, key: JSON.stringify([...runs]) }
}

/** Per track and voice: the multi-bar rests of the last layout (an edit that changes them lays out again). */
const layoutMultiRests = new Map<string, string>()

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

/** A staff of a score system: the shared bar widths, and whether it is below the top staff. */
export interface ScoreStaff {
  widths: number[]
  lower: boolean
  row?: { lowerStaff: true }
}

/** Bars `start`..`end - 1` in one row; `reached` is the room they take before spreading the rest. */
export interface RowSpan {
  start: number
  end: number
  reached: number
}

function shownBarCount(start: number, end: number, hidden: Set<number>): number {
  let count = 0
  for (let blockId = start; blockId < end; blockId += 1) if (!hidden.has(blockId)) count += 1
  return count
}

/**
 * Breaks bars into rows by the room each takes (`widths`); a multi-bar rest stays in one row.
 * The first row starts after the label gutter, and so does every row with `labelEveryRow`.
 */
export function breakIntoRows(
  widths: number[],
  hidden: Set<number>,
  availableWidth: number,
  labelEveryRow = false,
): RowSpan[] {
  const spans: RowSpan[] = []
  let start = 0
  let reached = TAB_CONSTANTS.TAB_LABEL_WIDTH
  for (let blockId = 0; blockId < widths.length; blockId += 1) {
    if (reached + widths[blockId] > availableWidth && blockId > start && !hidden.has(blockId)) {
      spans.push({ start, end: blockId, reached })
      start = blockId
      reached = rowStartRoom(blockId) + (labelEveryRow ? TAB_CONSTANTS.TAB_LABEL_WIDTH : 0)
    }
    reached += widths[blockId]
  }
  spans.push({ start, end: widths.length, reached })
  return spans
}

/**
 * One track's layout in the making: its bars measured (`displayWidths`), then laid out row by
 * row with `layoutRow` at a given top, and stored with `finish`. A single track breaks its own
 * rows; the score view (`scoreLayout.ts`) gives every shown track the same rows and bar widths.
 */
export interface TrackLayoutPass {
  displayWidths: number[]
  hidden: Set<number>
  /** Lays out one row from `top` and returns its bottom; `staff`: its place in a score system. */
  layoutRow(span: RowSpan, top: number, staff?: ScoreStaff): number
  finish(): MeasureLayoutResult
}

export function beginTrackLayout(
  trackId: number,
  voiceId: number,
  measures: Array<TabBeat[][] | undefined>,
  options: MeasureLayoutOptions,
  inScore = false,
  labelEveryRow = isDrumLayout(trackId),
): TrackLayoutPass {
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

  const availableWidth = options.availableWidth
  // the score view shows tab staves only, bar by bar
  const multiRests = inScore
    ? { runs: new Map<number, number>(), key: '' }
    : currentMultiRests(trackId, measures)
  layoutMultiRests.set(`${trackId}:${voiceId}`, multiRests.key)
  const hidden = hiddenBars(multiRests.runs)
  /** What a bar takes in its row: its minimum width, a multi-bar rest's, or nothing when hidden. */
  const displayWidths: number[] = []
  const numStrings = Song.tracks[trackId]?.numStrings ?? 6
  const classicalActive = !inScore && classicalNotationLayoutState.active
  const rowOwner = inScore ? { trackId, voiceId } : {}

  for (let blockId = 0; blockId < measures.length; blockId += 1) {
    allWidths[blockId] = computeBlockWidth(trackId, blockId, voiceId)
    const ownMinWidth =
      Number.isFinite(allWidths[blockId].minWidth) && allWidths[blockId].minWidth > 0
        ? allWidths[blockId].minWidth
        : TAB_CONSTANTS.MEASURE_WIDTH
    displayWidths[blockId] = hidden.has(blockId)
      ? 0
      : multiRests.runs.has(blockId)
        ? allWidths[blockId].padding + MULTI_REST_WIDTH
        : ownMinWidth
  }

  const layoutRow = (
    { start: groupStart, end: groupEnd, reached }: RowSpan,
    top: number,
    staff?: ScoreStaff,
  ) => {
    const { widths: sharedWidths, lower, row: staffRow }: Partial<ScoreStaff> = staff ?? {}
    // bar-level annotations (tempo, markers, signs, voltas) belong to a system's top staff
    const metaOf = (blockId: number) => (lower ? undefined : toRaw(Song.measureMeta[blockId]))
    const rowId = rows.length
    const numMeasures = shownBarCount(groupStart, groupEnd, hidden)
    const extraWidth = numMeasures > 0 ? Math.floor((availableWidth - reached) / numMeasures) : 0

    blocksPerRow[rowId] = { start: groupStart, end: groupEnd }

    const labelGutter = rowId === 0 || labelEveryRow
    let xOffset = labelGutter ? TAB_CONSTANTS.TAB_LABEL_WIDTH : 0
    const rowMeasures: RenderedTabRow['measures'] = []
    const laneBlocks: LaneBlockInput[] = []

    for (let blockId = groupStart; blockId < groupEnd; blockId += 1) {
      const rowStart = blockId === groupStart
      const isHidden = hidden.has(blockId)
      const restCount = multiRests.runs.get(blockId)
      const { width: finalWidth, minOffset } = barSpacing(allWidths[blockId], {
        displayWidth: (sharedWidths ?? displayWidths)[blockId] + (rowStart ? rowStartRoom(blockId) : 0),
        extraWidth,
        isHidden,
        // in the score a bar may be wider than its own notes need: they spread over it
        isMultiRest: restCount != null || sharedWidths != null,
      })

      finalBlockWidths[blockId] = finalWidth
      measureOffsets[blockId] = minOffset

      const numInRow = blockId - groupStart
      blockToRow[blockId] = { rowId, numInRow }

      // the rows hand the bar on to its components (reactive); the layout itself reads it raw
      const voiceMeasures = (measures[blockId]?.[voiceId] || []) as TabBeat[]
      const rawBeats = toRaw(voiceMeasures)
      const blockLayout: RenderBlockLayout = {
        xOffset,
        rowId,
        numInRow,
        width: finalWidth,
        minOffset,
        pageId: 0,
        beatPositions: getBeatRenderPositions(trackId, blockId, voiceId, rawBeats, minOffset, rowStart),
      }
      state.blockLayouts[blockId] = blockLayout

      laneBlocks.push({
        blockId,
        stemsUp: tabStemsGoUp(
          Settings.tabRhythmOnStems,
          voiceId,
          toRaw(measures[blockId]?.[voiceId === 0 ? 1 : 0]),
        ),
        meta: metaOf(blockId),
        beats: rawBeats.map((beat, beatIndex) => ({
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
        ...(restCount != null ? { multiRest: restCount } : {}),
        ...(isHidden ? { hidden: true } : {}),
      })
    }

    // Vertical layout: lanes above/below the strings, then the classical staff.
    const lanes = reuseUnchangedLanes(
      `${trackId}:${voiceId}:${rowId}`,
      computeRowLanes({ blocks: laneBlocks, numStrings, stringSpacing: TAB_CONSTANTS.STRING_SPACING }),
    )
    const yOffset = top + lanes.overBarHeight
    let bottom = yOffset + lanes.bodyHeight
    if (classicalActive) {
      bottom += CLASSICAL_ROW_GAP + getClassicalRowGeometry(groupStart, groupEnd).height
    }

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
      labelGutter,
      ...rowOwner,
      ...staffRow,
    })
    return bottom
  }

  const finish = (): MeasureLayoutResult => {
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

  return { displayWidths, hidden, layoutRow, finish }
}

export function computeTrackLayout(
  trackId: number,
  voiceId: number,
  measures: Array<TabBeat[][] | undefined>,
  options: MeasureLayoutOptions,
): MeasureLayoutResult {
  const pass = beginTrackLayout(trackId, voiceId, measures, options)
  if (measures.length === 0) return pass.finish()
  const rowGap = classicalNotationLayoutState.active ? CLASSICAL_ROW_SEPARATION : TAB_ROW_GAP
  let top = options.headerHeight
  for (const span of breakIntoRows(
    pass.displayWidths,
    pass.hidden,
    options.availableWidth,
    isDrumLayout(trackId),
  )) {
    top = pass.layoutRow(span, top) + rowGap
  }
  return pass.finish()
}

export function computeTrackLayoutFromSong(
  trackId: number,
  voiceId: number,
  options: MeasureLayoutOptions,
): MeasureLayoutResult {
  // in the score view a track is laid out together with the others shown
  const score = scoreTrackIds()
  if (score?.includes(trackId)) {
    const rows = computeScoreLayout(score, Song.currentTrackId, Song.currentVoiceId, options)
    const state = getTrackRenderLayout(trackId, voiceId) ?? createRenderTrackLayoutState(options)
    return { rows: rows.filter((row) => row.trackId === trackId), state, allWidths: [] }
  }
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
/** Space between neighbouring lyric syllables (and room for the hyphen). */
const LYRIC_GAP = 10

/** The offset per sixteenth that leaves room for the beat's widest syllable. */
function lyricOffset(beat: TabBeat, beatIn16ths: number): number {
  const widest = Math.max(0, ...(beat.lyrics ?? []).map(estimateLyricWidth))
  return widest > 0 ? (widest + LYRIC_GAP) / beatIn16ths : 0
}

/** What a bar needs more when it opens a row: the key signature repeated there. */
function rowStartRoom(blockId: number): number {
  return keySignatureRoom(blockId, true) - keySignatureRoom(blockId, false)
}

export function computeBarWidth(trackId: number, blockId: number, voiceId: number) {
  // key signatures of the song's start and of key changes (row starts: `rowStartRoom`)
  let padding = BAR_LEFT_PADDING * 2 + keySignatureRoom(blockId, false)
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
  // a bulk read inside the layout's computed, untracked (the layout re-runs on every edit)
  const block = toRaw(Song.measures[trackId][blockId][voiceId])

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
    minOffsetPerNote = Math.max(minOffsetPerNote, lyricOffset(beat, beatIn16ths))
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
  // in the score a bar's width also depends on the other tracks: compare the rows
  if (scoreTrackIds() != null) {
    const before = JSON.stringify(tabLayout.blocksPerRow[trackId]?.[voiceId])
    recomputeTrackLayoutFromSong(trackId, voiceId, getAvailableRowWidth())
    return before !== JSON.stringify(tabLayout.blocksPerRow[trackId]?.[voiceId])
  }
  // an edit that fills an empty bar (or empties one) changes the multi-bar rests
  const layoutKey = `${trackId}:${voiceId}`
  if (
    Settings.multiBarRests &&
    currentMultiRests(trackId, Song.measures[trackId] ?? []).key !== layoutMultiRests.get(layoutKey)
  ) {
    recomputeTrackLayoutFromSong(trackId, voiceId, getAvailableRowWidth())
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
