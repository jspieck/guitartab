import Helper from '../../assets/js/helper'
import EventBus from '../../assets/js/eventBus'
import Song from '../../assets/js/songData'
import { Tab, tab } from '../../assets/js/tab'
import { svgDrawer } from '../../assets/js/svgDrawer'
import { TAB_CONSTANTS } from '../../utils/tabLayout'
import type { RenderedTabRow, TabBeat, TabMeasureMetaData, TabNoteData } from '../../types/tab'

interface ModernLayoutOptions {
  availableWidth: number
  headerHeight: number
  rowHeight: number
  paddingTop: number
  tabInformationHeight: number
}

interface ModernBlockLayout {
  xOffset: number
  rowId: number
  numInRow: number
  width: number
  minOffset: number
}

interface ModernRowLayout {
  yOffset: number
  height: number
}

interface ModernTrackLayoutState {
  blockLayouts: ModernBlockLayout[]
  rowLayouts: ModernRowLayout[]
  paddingTop: number
  tabInformationHeight: number
  numRows: number
  numPages: number
}

type BlockWidthInfo = ReturnType<typeof Tab.computeWidthOfBlock>

const modernLayoutState = new Map<string, ModernTrackLayoutState>()

function layoutKey(trackId: number, voiceId: number): string {
  return `${trackId}:${voiceId}`
}

function createModernLayoutState(paddingTop: number, tabInformationHeight: number): ModernTrackLayoutState {
  return {
    blockLayouts: [],
    rowLayouts: [],
    paddingTop,
    tabInformationHeight,
    numRows: 0,
    numPages: 1,
  }
}

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

function syncModernLayoutToLegacy(trackId: number, voiceId: number, state: ModernTrackLayoutState) {
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
    svgDrawer.blockToPage[blockId] = 0
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

const legacyEditorCore = {
  ensureSongInitialized(): boolean {
    if (!Song.measures || Song.measures.length === 0) {
      Song.initEmptySong()
      return true
    }

    return false
  },

  getTrackStringCount(trackId: number): number {
    return Song.tracks?.[trackId]?.numStrings || 6
  },

  getMeasureMeta(blockId: number): TabMeasureMetaData {
    return Song.measureMeta?.[blockId] || Song.defaultMeasureMeta()
  },

  defaultMeasure(): TabBeat {
    return Song.defaultMeasure() as TabBeat
  },

  defaultNote(): TabNoteData {
    return Song.defaultNote() as TabNoteData
  },

  buildModernTabRows(
    trackId: number,
    voiceId: number,
    measures: Array<TabBeat[][] | undefined>,
    options: ModernLayoutOptions,
  ): RenderedTabRow[] {
    const rows: RenderedTabRow[] = []
    const state = createModernLayoutState(options.paddingTop, options.tabInformationHeight)

    if (measures.length === 0) {
      modernLayoutState.set(layoutKey(trackId, voiceId), state)
      syncModernLayoutToLegacy(trackId, voiceId, state)
      return rows
    }

    let currentRowMeasures: RenderedTabRow['measures'] = []
    let currentWidth = TAB_CONSTANTS.TAB_LABEL_WIDTH
    let startBlockId = 0

    for (let blockId = 0; blockId < measures.length; blockId++) {
      const measure = measures[blockId]

      let widthInfo: BlockWidthInfo | null = null
      try {
        Helper.groupMeasureBeats(trackId, blockId, voiceId)
        widthInfo = Tab.computeWidthOfBlock(trackId, blockId, voiceId)
      } catch {
        console.warn(`Failed to compute width for measure ${blockId}, using default.`)
      }

      const measureWidth = widthInfo && Number.isFinite(widthInfo.minWidth) && widthInfo.minWidth > 0
        ? widthInfo.minWidth
        : 200
      const minOffset = widthInfo && Number.isFinite(widthInfo.minOffset) && widthInfo.minOffset > 0
        ? widthInfo.minOffset
        : 40

      if (currentWidth + measureWidth > options.availableWidth && currentRowMeasures.length > 0) {
        const rowId = rows.length
        const yOffset = options.headerHeight + rowId * options.rowHeight
        state.rowLayouts[rowId] = { yOffset, height: options.rowHeight }
        rows.push({
          id: rowId,
          measures: currentRowMeasures,
          startBlockId,
          endBlockId: blockId - 1,
          yOffset,
        })
        currentRowMeasures = []
        currentWidth = 0
        startBlockId = blockId
      }

      const rowId = rows.length
      state.blockLayouts[blockId] = {
        xOffset: currentWidth,
        rowId,
        numInRow: currentRowMeasures.length,
        width: measureWidth,
        minOffset,
      }

      currentRowMeasures.push({
        data: (measure?.[voiceId] || []) as TabBeat[],
        width: measureWidth,
      })
      currentWidth += measureWidth
    }

    if (currentRowMeasures.length > 0) {
      const rowId = rows.length
      const yOffset = options.headerHeight + rowId * options.rowHeight
      state.rowLayouts[rowId] = { yOffset, height: options.rowHeight }
      rows.push({
        id: rowId,
        measures: currentRowMeasures,
        startBlockId,
        endBlockId: measures.length - 1,
        yOffset,
      })
    }

    state.numRows = rows.length
    modernLayoutState.set(layoutKey(trackId, voiceId), state)
    syncModernLayoutToLegacy(trackId, voiceId, state)

    return rows
  },

  getModernLayout(trackId: number, voiceId: number): ModernTrackLayoutState | null {
    return modernLayoutState.get(layoutKey(trackId, voiceId)) ?? null
  },

  changeNoteDuration(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatIndex: number,
    stringIndex: number,
    durationId: string,
  ) {
    tab.changeNoteDuration(trackId, blockId, voiceId, beatIndex, stringIndex, durationId, false)
  },

  setNoteAtPosition(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatIndex: number,
    stringIndex: number,
    fret: number,
    numStrings: number,
  ) {
    const beat = legacyEditorCore.ensureBeatAtPosition(trackId, blockId, voiceId, beatIndex, numStrings)

    beat.notes[stringIndex] = fret === -1
      ? null
      : {
          ...legacyEditorCore.defaultNote(),
          fret,
          string: stringIndex,
        }

    EventBus.emit('song-data-changed')
  },

  setPlaybackBarObject(object: SVGGElement | null) {
    svgDrawer.playBackBarObjects = object ? [object] : []
  },

  ensureBeatAtPosition(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatIndex: number,
    numStrings: number,
  ): TabBeat {
    if (!Song.measures[trackId]) Song.measures[trackId] = []
    if (!Song.measures[trackId][blockId]) Song.measures[trackId][blockId] = []
    if (!Song.measures[trackId][blockId][voiceId]) Song.measures[trackId][blockId][voiceId] = []

    if (!Song.measures[trackId][blockId][voiceId][beatIndex]) {
      const defaultBeat = Song.defaultMeasure() as TabBeat
      defaultBeat.duration = 'quarter'
      defaultBeat.notes = new Array(numStrings).fill(null)
      Song.measures[trackId][blockId][voiceId][beatIndex] = defaultBeat
    }

    const beat = Song.measures[trackId][blockId][voiceId][beatIndex] as TabBeat
    if (!beat.notes) {
      beat.notes = new Array(numStrings).fill(null)
    }

    return beat
  },
}

export { legacyEditorCore }
export default legacyEditorCore