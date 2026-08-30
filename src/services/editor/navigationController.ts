import Settings from '../../assets/js/settingManager'
import AppManager from '../../assets/js/appManager'
import Helper from '../../assets/js/helper'
import { tab } from '../../assets/js/tab'
import renderBridge from './renderBridge'
import {
  getBlockRenderPageId,
} from '../../composables/useTabRenderLayout'
import {
  getChordDiagramRowHeight,
  getOverBarHeight,
  getYPosOfPage,
} from './tabLayoutMetrics'
import { getScrollTop, setScrollTop, TAB_SHEET } from '../../utils/tabSheetConstants'
import { getTrackRenderLayout } from '../../composables/useTabRenderLayout'
import { getViewportMainContent } from '../../stores/tabViewportState'

export function scrollToSvgBlock(trackId: number, voiceId: number, blockId: number): void {
  if (AppManager.duringTrackCreation) {
    return
  }

  const rowId = tab.blockToRow?.[trackId]?.[voiceId]?.[blockId]?.rowId
  if (rowId == null) {
    return
  }

  scrollToSvgPos(trackId, voiceId, rowId, blockId)
}

export function scrollToSvgPos(
  trackId: number,
  voiceId: number,
  rowId: number,
  blockId: number,
): void {
  if (AppManager.duringTrackCreation) {
    return
  }

  const pageId = getBlockRenderPageId(trackId, voiceId, blockId) ?? 0
  const PAGE_POSITION = TAB_SHEET.FIRST_PAGE_TOP_MARGIN
    + getYPosOfPage(pageId) * Settings.currentZoom

  const layout = getTrackRenderLayout(trackId, voiceId)
  let tabGroupOffset = layout?.paddingTop ?? TAB_SHEET.PAGE_MARGIN_TOP
  if (pageId === 0) {
    tabGroupOffset += getChordDiagramRowHeight(trackId, layout?.availableWidth)
  }
  tabGroupOffset *= Settings.currentZoom

  const rowY = renderBridge.getRowY(trackId, voiceId, rowId)
  if (rowY === 0 && renderBridge.getRowIdForBlock(trackId, voiceId, blockId) == null) {
    return
  }

  const scrollTopMargin = getOverBarHeight(trackId, voiceId, rowId) * Settings.currentZoom
  const newScrollPos = PAGE_POSITION + tabGroupOffset
    + rowY * Settings.currentZoom - scrollTopMargin

  const mainContentDiv = getViewportMainContent()
  if (mainContentDiv) {
    Helper.scrollToPure(mainContentDiv, getScrollTop(), newScrollPos, 800)
    setScrollTop(newScrollPos)
  }
}

export { getScrollTop, setScrollTop }
