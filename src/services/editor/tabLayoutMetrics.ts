import Song from '../../assets/js/songData'
import Settings from '../../assets/js/settingManager'
import { getTrackRenderLayout } from '../../composables/useTabRenderLayout'
import { TAB_SHEET } from '../../utils/tabSheetConstants'
import type { RenderedTabRow } from '../../types/tab'

const BOTTOM_BEAM_BAR_HEIGHT = 50
const CLASSICAL_GAP_BELOW_TAB = 4
/** Space between the tab content of a row and its classical staff area. */
export const CLASSICAL_ROW_GAP = 8
/**
 * Space after a classical area, before the next row. That row draws measure
 * numbers, markers and over-bar effects above its strings, and the staff should
 * read as belonging to the tab row above it.
 */
export const CLASSICAL_ROW_SEPARATION = 24
/** Space between consecutive rows when only tab is shown. */
export const TAB_ROW_GAP = 12
/** Room left of a row's first measure where the classical clef is drawn. */
export const CLASSICAL_CLEF_GUTTER = 44

export function getTabStringsBottom(trackId: number): number {
  const numStrings = Song.tracks[trackId]?.numStrings ?? 6
  return Math.max(0, numStrings - 1) * TAB_SHEET.heightPerString
}

export function getBlockHeight(trackId: number): number {
  return BOTTOM_BEAM_BAR_HEIGHT + TAB_SHEET.heightPerString * Song.tracks[trackId].numStrings
}

/** Y offset from the top of a tab row to where classical notation should begin. */
export function getClassicalNotationTop(trackId: number): number {
  return getTabStringsBottom(trackId) + BOTTOM_BEAM_BAR_HEIGHT + CLASSICAL_GAP_BELOW_TAB
}

/** Height of a tab row without classical notation (strings, effects, beams). */
export function getTabRowContentHeight(trackId: number): number {
  return getClassicalNotationTop(trackId) + 6
}

/** Y offset from a row's top string to the top of its classical staff area. */
export function getClassicalAreaTop(row: RenderedTabRow, trackId: number): number {
  return (row.lanes?.bodyHeight ?? getTabRowContentHeight(trackId)) + CLASSICAL_ROW_GAP
}

export function getPositionMarkerHeight(trackId: number): number {
  let height = (Song.tracks[trackId].numStrings - 1) * TAB_SHEET.heightPerString
  if (Settings.vexFlowIsActive) {
    height += TAB_SHEET.VEXFLOW_HEIGHT
  }
  return height
}

export function getYPosOfPage(pageId: number): number {
  return (TAB_SHEET.pageHeight + TAB_SHEET.distanceBetweenPages) * pageId
}

export function getNumChords(trackId: number): number {
  if (!Song.chordsMap[trackId]) {
    return 0
  }

  let numChords = 0
  for (const chord of Song.chordsMap[trackId].values()) {
    if (chord.display) {
      numChords += 1
    }
  }
  return numChords
}

export function getNumChordsPerRow(availableWidth: number): number {
  return Math.floor((availableWidth - 200) / (TAB_SHEET.DIA_WIDTH + TAB_SHEET.DIA_SPACING))
}

export function getNumChordDiagramRows(trackId: number, availableWidth?: number): number {
  const rowWidth =
    availableWidth ??
    getTrackRenderLayout(trackId, Song.currentVoiceId)?.availableWidth ??
    TAB_SHEET.completeWidth - 2 * TAB_SHEET.PAGE_MARGIN_SIDE
  const numChordsPerRow = Math.max(1, getNumChordsPerRow(rowWidth))
  return Math.ceil(getNumChords(trackId) / numChordsPerRow)
}
