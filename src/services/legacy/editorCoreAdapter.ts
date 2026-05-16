import Helper from '../../assets/js/helper'
import Song from '../../assets/js/songData'
import { Tab, tab } from '../../assets/js/tab'
import { svgDrawer } from '../../assets/js/svgDrawer'
import type { TabBeat, TabMeasureMetaData, TabNoteData } from '../../types/tab'

type BlockWidthInfo = ReturnType<typeof Tab.computeWidthOfBlock>

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

  groupMeasureBeats(trackId: number, blockId: number, voiceId: number) {
    Helper.groupMeasureBeats(trackId, blockId, voiceId)
  },

  computeBlockWidth(trackId: number, blockId: number, voiceId: number): BlockWidthInfo {
    return Tab.computeWidthOfBlock(trackId, blockId, voiceId)
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

  initializeModernRendererState(trackId: number, voiceId: number, paddingTop: number, tabInformationHeight: number) {
    ensureRendererArrays(trackId, voiceId)
    svgDrawer.trackCreated = true
    svgDrawer.paddingTop = paddingTop
    svgDrawer.tabInformationHeight = tabInformationHeight
  },

  setBlockLayout(
    trackId: number,
    voiceId: number,
    blockId: number,
    xOffset: number,
    rowId: number,
    numInRow: number,
    width: number,
    minOffset: number,
  ) {
    svgDrawer.blockToPage[blockId] = 0
    if (!svgDrawer.blockToX[trackId][blockId]) svgDrawer.blockToX[trackId][blockId] = []
    svgDrawer.blockToX[trackId][blockId][voiceId] = xOffset

    tab.blockToRow[trackId][voiceId][blockId] = { rowId, numInRow }
    tab.finalBlockWidths[trackId][voiceId][blockId] = width

    if (!tab.measureOffset[trackId][blockId]) tab.measureOffset[trackId][blockId] = []
    tab.measureOffset[trackId][blockId][voiceId] = minOffset
  },

  markRowStartBlock(trackId: number, voiceId: number, blockId: number, rowId: number) {
    if (svgDrawer.blockToX[trackId][blockId]) {
      svgDrawer.blockToX[trackId][blockId][voiceId] = 0
    }

    if (tab.blockToRow[trackId][voiceId][blockId]) {
      tab.blockToRow[trackId][voiceId][blockId].rowId = rowId
      tab.blockToRow[trackId][voiceId][blockId].numInRow = 0
    }
  },

  setRowLayout(trackId: number, voiceId: number, rowId: number, yOffset: number, rowHeight: number) {
    svgDrawer.rowToY[trackId][voiceId][rowId] = yOffset
    svgDrawer.heightOfRow[trackId][voiceId][rowId] = rowHeight
  },

  finalizeModernRendererState(rowCount: number) {
    svgDrawer.numRows = rowCount
    svgDrawer.numPages = 1
  },

  setPlayBackBarObjects(objects: SVGGElement[]) {
    svgDrawer.playBackBarObjects = objects
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