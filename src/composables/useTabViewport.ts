import { computed, onMounted, onUnmounted, type ComputedRef, type Ref } from 'vue'
import { tab } from '../assets/js/tab'
import {
  DIN_A4_WIDTH_CM,
  registerMainContentElement,
  syncViewportZoom,
  tabViewportState,
} from '../stores/tabViewportState'
import { typedEventBus } from '../utils/typedEventBus'
import { TAB_SHEET } from '../utils/tabSheetConstants'

interface TabViewportBindings {
  completeTabClass: ComputedRef<Record<string, boolean>>
  completeTabStyle: ComputedRef<Record<string, string>>
  tabViewClass: ComputedRef<Record<string, boolean>>
  tabViewStyle: ComputedRef<Record<string, string>>
  sheetWidth: ComputedRef<number>
  sheetHeight: ComputedRef<number>
  registerMainContent: (element: HTMLElement | null) => void
}

export function useTabViewport(mainContentRef?: Ref<HTMLElement | null>): TabViewportBindings {
  const completeTabClass = computed(() => ({
    dinA4Size: tabViewportState.pageMode,
  }))

  const completeTabStyle = computed(() => {
    if (!tabViewportState.pageMode) {
      return {
        width: `${tabViewportState.sheetWidthPx}px`,
      }
    }

    return {
      width: `${tabViewportState.zoom * DIN_A4_WIDTH_CM}cm`,
    }
  })

  const tabViewClass = computed(() => ({
    'guitar-tab-view': true,
    svgMainFullscreen: !tabViewportState.pageMode,
  }))

  const tabViewStyle = computed(() => ({
    transform: `scale(${tabViewportState.zoom})`,
    transformOrigin: '0 0',
  }))

  const sheetWidth = computed(() => tabViewportState.sheetWidthPx)
  const sheetHeight = computed(() => TAB_SHEET.completeHeight)

  function registerMainContent(element: HTMLElement | null): void {
    registerMainContentElement(element)
  }

  function handleZoomChanged(zoom: number): void {
    const previousZoom = tabViewportState.zoom
    syncViewportZoom(zoom, previousZoom)
  }

  onMounted(() => {
    if (mainContentRef?.value) {
      registerMainContent(mainContentRef.value)
    }

    tabViewportState.zoom = tab.currentZoom
    typedEventBus.on('ui.zoomChanged', handleZoomChanged)
  })

  onUnmounted(() => {
    typedEventBus.off('ui.zoomChanged', handleZoomChanged)
    registerMainContentElement(null)
  })

  return {
    completeTabClass,
    completeTabStyle,
    tabViewClass,
    tabViewStyle,
    sheetWidth,
    sheetHeight,
    registerMainContent,
  }
}
