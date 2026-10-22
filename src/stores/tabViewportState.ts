import { reactive } from 'vue'
import Settings from './settingsState'
import { tab } from '../assets/js/tab'
import { setScrollTop, TAB_SHEET } from '../utils/tabSheetConstants'

export const DIN_A4_WIDTH_CM = 31.5
export const CM_TO_PX = 37.795276

export interface TabViewportState {
  zoom: number
  pageMode: boolean
  sheetWidthPx: number
  mainContentEl: HTMLElement | null
}

export const tabViewportState = reactive<TabViewportState>({
  zoom: Settings.currentZoom,
  pageMode: Settings.pageMode,
  sheetWidthPx: TAB_SHEET.completeWidth,
  mainContentEl: null,
})

export function registerMainContentElement(element: HTMLElement | null): void {
  tabViewportState.mainContentEl = element
}

export function syncViewportZoom(zoom: number, previousZoom: number): void {
  tabViewportState.zoom = zoom
  Settings.currentZoom = zoom
  tab.currentZoom = zoom

  const parent = tabViewportState.mainContentEl
  if (parent == null || previousZoom === zoom) {
    return
  }

  const scrollPosBefore = parent.scrollTop
  parent.scrollLeft = (parent.scrollWidth - parent.clientWidth) / 2
  const scrollTopPos = scrollPosBefore * (zoom / previousZoom)
  parent.scrollTop = scrollTopPos
  setScrollTop(scrollTopPos)
}

export function recomputeViewportWidthFromContainer(): number | null {
  const mainContent = tabViewportState.mainContentEl
  if (mainContent == null) {
    return null
  }

  TAB_SHEET.completeWidth = mainContent.clientWidth
  tabViewportState.sheetWidthPx = TAB_SHEET.completeWidth
  return TAB_SHEET.completeWidth
}

export function applyViewportPageMode(pageMode: boolean, sheetWidthPx: number): void {
  tabViewportState.pageMode = pageMode
  tabViewportState.sheetWidthPx = sheetWidthPx
  Settings.pageMode = pageMode
  TAB_SHEET.completeWidth = sheetWidthPx

  if (!pageMode) {
    tabViewportState.zoom = 1
    Settings.currentZoom = 1
    tab.currentZoom = 1
  }
}

export function getViewportMainContent(): HTMLElement | null {
  return tabViewportState.mainContentEl
}
