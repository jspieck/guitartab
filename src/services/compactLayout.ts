import Song from '../assets/js/songData'
import Settings from '../assets/js/settingManager'
import { tab } from '../assets/js/tab'
import { applyViewportPageMode, tabViewportState } from '../stores/tabViewportState'
import { sheetFitMode } from '../stores/layoutModeState'

/**
 * Sizes the tab sheet for the compact (phone) layout. Rows always fit the screen: zooming
 * makes the sheet narrower (fewer bars per row) and scales it back up to the screen width,
 * instead of scaling a wide sheet that would need sideways scrolling.
 */

export const COMPACT_ZOOM_MIN = 0.6
export const COMPACT_ZOOM_MAX = 2
const ZOOM_KEY = 'guitartab:compactZoom'

interface DesktopSheet {
  pageMode: boolean
  width: number
  zoom: number
}

let desktopSheet: DesktopSheet | null = null
let observer: ResizeObserver | null = null
let observed: HTMLElement | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null
let detachPinch: (() => void) | null = null

export function clampCompactZoom(zoom: number): number {
  return Math.min(COMPACT_ZOOM_MAX, Math.max(COMPACT_ZOOM_MIN, Math.round(zoom * 100) / 100))
}

export function readCompactZoom(): number {
  try {
    const stored = Number(localStorage.getItem(ZOOM_KEY))
    return Number.isFinite(stored) && stored > 0 ? clampCompactZoom(stored) : 1
  } catch {
    return 1
  }
}

function storeCompactZoom(zoom: number): void {
  try {
    localStorage.setItem(ZOOM_KEY, String(zoom))
  } catch {
    // The zoom then lasts for this visit only.
  }
}

/** Narrowest sheet a bar can still be drawn on. */
const MIN_SHEET_WIDTH = 240

/** The zoom actually used: capped so the sheet never gets narrower than `MIN_SHEET_WIDTH`. */
export function effectiveCompactZoom(containerWidth: number, zoom: number): number {
  return Math.min(zoom, Math.max(1, containerWidth / MIN_SHEET_WIDTH))
}

/** Sheet width for a container width and zoom; the scaled sheet exactly fills the container. */
export function compactSheetWidth(containerWidth: number, zoom: number): number {
  return Math.floor(containerWidth / effectiveCompactZoom(containerWidth, zoom))
}

function setZoom(zoom: number): void {
  tabViewportState.zoom = zoom
  Settings.currentZoom = zoom
  tab.currentZoom = zoom
}

function redraw(): void {
  tab.drawTrackMain(Song.currentTrackId, Song.currentVoiceId, true, () => {})
}

/** Fits the sheet to the container at the current compact zoom. Returns whether anything changed. */
export function fitCompactSheet(container: HTMLElement, requestedZoom = readCompactZoom()): boolean {
  if (container.clientWidth === 0) return false
  const zoom = effectiveCompactZoom(container.clientWidth, requestedZoom)
  const width = compactSheetWidth(container.clientWidth, zoom)
  if (
    !tabViewportState.pageMode &&
    tabViewportState.sheetWidthPx === width &&
    tabViewportState.zoom === zoom
  ) {
    return false
  }
  applyViewportPageMode(false, width)
  setZoom(zoom)
  redraw()
  return true
}

/** Zooms the compact sheet (pinch or buttons), keeping the reading position. */
export function setCompactZoom(container: HTMLElement, zoom: number): number {
  const next = clampCompactZoom(zoom)
  const previous = tabViewportState.zoom || 1
  const ratio = container.scrollTop / Math.max(1, container.scrollHeight)
  storeCompactZoom(next)
  if (fitCompactSheet(container, next) && previous !== next) {
    // Rows reflow, so keep the same fraction of the song in view rather than the same pixels.
    requestAnimationFrame(() => {
      container.scrollTop = ratio * container.scrollHeight
    })
  }
  return next
}

export function pinchDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Two-finger pinch on the tab. While the fingers move, the sheet is only scaled with CSS
 * (cheap); when they lift, the rows reflow at the new zoom.
 */
function attachPinchZoom(container: HTMLElement): () => void {
  const pointers = new Map<number, { x: number; y: number }>()
  let startDistance = 0
  let startZoom = 1
  let scale = 1

  const sheet = () => container.querySelector<HTMLElement>('#completeTab')

  const onDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      startDistance = pinchDistance(a, b)
      startZoom = tabViewportState.zoom || 1
      scale = 1
      const target = sheet()
      if (target) {
        const rect = target.getBoundingClientRect()
        target.style.transformOrigin = `${(a.x + b.x) / 2 - rect.left}px ${(a.y + b.y) / 2 - rect.top}px`
      }
    }
  }

  const onMove = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size !== 2 || startDistance === 0) return
    const [a, b] = [...pointers.values()]
    const zoom = clampCompactZoom(startZoom * (pinchDistance(a, b) / startDistance))
    scale = zoom / startZoom
    const target = sheet()
    if (target) target.style.transform = `scale(${scale})`
  }

  const onUp = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return
    if (pointers.size < 2 && startDistance > 0) {
      const target = sheet()
      if (target) {
        target.style.transform = ''
        target.style.transformOrigin = ''
      }
      startDistance = 0
      if (Math.abs(scale - 1) > 0.02) setCompactZoom(container, startZoom * scale)
    }
  }

  container.addEventListener('pointerdown', onDown)
  container.addEventListener('pointermove', onMove)
  container.addEventListener('pointerup', onUp)
  container.addEventListener('pointercancel', onUp)
  return () => {
    container.removeEventListener('pointerdown', onDown)
    container.removeEventListener('pointermove', onMove)
    container.removeEventListener('pointerup', onUp)
    container.removeEventListener('pointercancel', onUp)
  }
}

function observe(container: HTMLElement): void {
  if (typeof ResizeObserver === 'undefined' || observed === container) return
  observer?.disconnect()
  observed = container
  observer = new ResizeObserver(() => {
    if (resizeTimer != null) clearTimeout(resizeTimer)
    // Rotating a phone fires several sizes in a row; reflow once it settles.
    resizeTimer = setTimeout(() => {
      const mode = sheetFitMode()
      if (mode !== 'desktop') fitCompactSheet(container, mode === 'compact' ? readCompactZoom() : 1)
    }, 120)
  })
  observer.observe(container)
}

/**
 * Sizes the sheet for the layout: fitted to the window with the compact zoom (phone),
 * fitted at zoom 1 (tablet, desktop toolbar), or the desktop sheet it had before.
 */
export function syncSheetFit(mode: 'compact' | 'tablet' | 'desktop', container: HTMLElement | null): void {
  if (container == null) return
  if (mode !== 'desktop') {
    desktopSheet ??= {
      pageMode: tabViewportState.pageMode,
      width: tabViewportState.sheetWidthPx,
      zoom: tabViewportState.zoom,
    }
    observe(container)
    if (mode === 'compact') {
      detachPinch ??= attachPinchZoom(container)
    } else {
      detachPinch?.()
      detachPinch = null
    }
    fitCompactSheet(container, mode === 'compact' ? readCompactZoom() : 1)
    return
  }

  detachPinch?.()
  detachPinch = null
  observer?.disconnect()
  observer = null
  observed = null
  if (desktopSheet != null) {
    applyViewportPageMode(desktopSheet.pageMode, desktopSheet.width)
    setZoom(desktopSheet.zoom)
    desktopSheet = null
    redraw()
  }
}
