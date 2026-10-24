import Settings from '../../stores/settingsState'
import { showNotification } from '../../stores/notificationState'
import { typedEventBus } from '../../utils/typedEventBus'

const ZOOM_STEP = 0.05
const ZOOM_MAX = 1.5
const ZOOM_MIN = 0.5

/** Zooms the desktop sheet one step in or out (the zoom is a saved setting). */
export function zoomTab(zoomIn: boolean): void {
  const before = Settings.currentZoom
  const next = zoomIn ? Math.min(before + ZOOM_STEP, ZOOM_MAX) : Math.max(before - ZOOM_STEP, ZOOM_MIN)
  showNotification(`${Math.round(next * 100)}%`)
  if (next !== before) {
    Settings.currentZoom = next
    typedEventBus.emit('ui.zoomChanged', next)
  }
}

/**
 * Ctrl/⌘ + mouse wheel zooms the tab instead of the page. Registered as a non-passive
 * `wheel` listener: browsers make document-level wheel listeners passive by default, and a
 * passive listener can't stop the page zoom.
 */
export function zoomOnWheel(event: WheelEvent): void {
  if (!event.ctrlKey) return
  event.preventDefault()
  zoomTab(event.deltaY < 0)
}
