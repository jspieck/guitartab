import Settings from '../../assets/js/settingManager'
import AppManager from '../../assets/js/appManager'
import { tab } from '../../assets/js/tab'
import renderBridge from './renderBridge'
import {
  getBlockRenderPageId,
} from '../../composables/useTabRenderLayout'
import { getYPosOfPage } from './tabLayoutMetrics'
import { getScrollTop, setScrollTop, TAB_SHEET } from '../../utils/tabSheetConstants'
import { getRowRenderLayout, getTrackRenderLayout } from '../../composables/useTabRenderLayout'
import { getViewportMainContent } from '../../stores/tabViewportState'
import { revealScrollTop, ROW_SCROLL_MARGIN, smoothScrollTo } from '../../utils/smoothScroll'

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

/**
 * Brings a row into view like turning a page: nothing moves while the row is fully visible;
 * when it isn't (playback reached the bottom of the screen, or jumped back), the view scrolls
 * once so the row sits just below the top and the following rows show underneath.
 */
export function scrollToSvgPos(
  trackId: number,
  voiceId: number,
  rowId: number,
  blockId: number,
): void {
  if (AppManager.duringTrackCreation) {
    return
  }

  const mainContentDiv = getViewportMainContent()
  if (!mainContentDiv) {
    return
  }
  const span = measuredRowSpan(mainContentDiv, trackId, voiceId, rowId)
  const target = span != null
    ? revealScrollTop(span, mainContentDiv.scrollTop, mainContentDiv.clientHeight)
    : estimatedRowScrollTop(trackId, voiceId, rowId, blockId)
  if (target == null) {
    return
  }
  smoothScrollTo(mainContentDiv, target)
  setScrollTop(target)
}

/**
 * The row's top edge (annotation lanes included) and bottom edge in the scroll area's content
 * coordinates, measured through the sheet's own transform (zoom, page margins).
 * Null when the sheet isn't rendered.
 */
function measuredRowSpan(scroller: HTMLElement, trackId: number, voiceId: number, rowId: number): { top: number, bottom: number } | null {
  const row = getRowRenderLayout(trackId, voiceId, rowId)
  const content = scroller.querySelector('.tab-svg > g')
  if (!row || !(content instanceof SVGGraphicsElement)) {
    return null
  }
  const matrix = content.getScreenCTM()
  if (!matrix) {
    return null
  }
  const offset = scroller.scrollTop - scroller.getBoundingClientRect().top
  return {
    top: matrix.d * (row.top ?? row.yOffset) + matrix.f + offset,
    bottom: matrix.d * (row.yOffset + row.height) + matrix.f + offset,
  }
}

/** Fallback without a rendered sheet: the row's position from the layout numbers. */
function estimatedRowScrollTop(trackId: number, voiceId: number, rowId: number, blockId: number): number | null {
  const rowY = renderBridge.getRowY(trackId, voiceId, rowId)
  if (rowY === 0 && renderBridge.getRowIdForBlock(trackId, voiceId, blockId) == null) {
    return null
  }
  const pageId = getBlockRenderPageId(trackId, voiceId, blockId) ?? 0
  const layout = getTrackRenderLayout(trackId, voiceId)
  const pagePosition = TAB_SHEET.FIRST_PAGE_TOP_MARGIN + getYPosOfPage(pageId) * Settings.currentZoom
  const tabGroupOffset = (layout?.paddingTop ?? TAB_SHEET.PAGE_MARGIN_TOP) * Settings.currentZoom
  const row = getRowRenderLayout(trackId, voiceId, rowId)
  const rowTop = row?.top ?? rowY
  return Math.max(0, pagePosition + tabGroupOffset + rowTop * Settings.currentZoom - ROW_SCROLL_MARGIN)
}

export { getScrollTop, setScrollTop }
