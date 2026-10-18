import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import type { RenderedTabRow } from '../types/tab'
import { tabViewportState } from '../stores/tabViewportState'
import {
  beginRenderAllRows,
  endRenderAllRows,
  isRenderingAllRows,
} from '../stores/tabVirtualizationState'

interface VisibleWindow {
  top: number
  bottom: number
}

/** Extra rendered area above and below the viewport, in viewport heights. */
const BUFFER_VIEWPORTS = 1

const FALLBACK_ROW_HEIGHT = 120

export function isRowInWindow(
  row: Pick<RenderedTabRow, 'yOffset' | 'top' | 'height'>,
  range: VisibleWindow,
): boolean {
  const top = row.top ?? row.yOffset
  const bottom = top + (row.height ?? FALLBACK_ROW_HEIGHT)
  return bottom >= range.top && top <= range.bottom
}

/**
 * Window of row-group coordinates worth rendering: the scroll viewport plus a
 * buffer, converted from screen pixels through the sheet's zoom.
 */
export function computeVisibleWindow(
  svg: SVGSVGElement,
  container: HTMLElement,
  zoom: number,
  paddingTop: number,
): VisibleWindow {
  const scale = zoom > 0 ? zoom : 1
  const viewportHeight = container.clientHeight / scale
  const top = (container.getBoundingClientRect().top - svg.getBoundingClientRect().top) / scale - paddingTop
  const buffer = viewportHeight * BUFFER_VIEWPORTS
  return { top: top - buffer, bottom: top + viewportHeight + buffer }
}

/**
 * Render only the tab rows near the scroll viewport. The window is expressed in
 * the coordinates of the translated row group (same space as `row.yOffset`).
 * Until the viewport has been measured, every row is rendered.
 */
export function useVisibleTabRows(
  tabRows: Ref<RenderedTabRow[]>,
  paddingTop: Ref<number>,
  svgRoot: Ref<SVGSVGElement | null>,
) {
  const visibleWindow = ref<VisibleWindow | null>(null)
  let frameHandle: number | null = null
  let observedContainer: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null

  function measure(): void {
    frameHandle = null
    const container = tabViewportState.mainContentEl
    const svg = svgRoot.value
    if (!container || !svg) {
      visibleWindow.value = null
      return
    }

    const next = computeVisibleWindow(svg, container, tabViewportState.zoom, paddingTop.value)
    const current = visibleWindow.value
    // Ignore sub-row scroll jitter: only publish when the window moved noticeably.
    if (
      current
      && Math.abs(current.top - next.top) < FALLBACK_ROW_HEIGHT / 2
      && Math.abs(current.bottom - next.bottom) < FALLBACK_ROW_HEIGHT / 2
    ) {
      return
    }
    visibleWindow.value = next
  }

  function scheduleMeasure(): void {
    if (frameHandle != null) {
      return
    }
    frameHandle = requestAnimationFrame(measure)
  }

  function observe(container: HTMLElement | null): void {
    if (observedContainer === container) {
      return
    }
    observedContainer?.removeEventListener('scroll', scheduleMeasure)
    resizeObserver?.disconnect()
    observedContainer = container
    if (!container) {
      return
    }
    container.addEventListener('scroll', scheduleMeasure, { passive: true })
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleMeasure)
      resizeObserver.observe(container)
    }
    scheduleMeasure()
  }

  const visibleTabRows = computed<RenderedTabRow[]>(() => {
    const range = visibleWindow.value
    if (!range || isRenderingAllRows()) {
      return tabRows.value
    }
    return tabRows.value.filter((row) => isRowInWindow(row, range))
  })

  watch(() => tabViewportState.mainContentEl, observe)
  watch([() => tabViewportState.zoom, () => tabRows.value.length, svgRoot], scheduleMeasure)

  onMounted(() => {
    observe(tabViewportState.mainContentEl)
    window.addEventListener('beforeprint', beginRenderAllRows)
    window.addEventListener('afterprint', endRenderAllRows)
  })

  onUnmounted(() => {
    observe(null)
    if (frameHandle != null) {
      cancelAnimationFrame(frameHandle)
    }
    window.removeEventListener('beforeprint', beginRenderAllRows)
    window.removeEventListener('afterprint', endRenderAllRows)
  })

  return {
    visibleTabRows,
  }
}
