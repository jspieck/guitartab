import { reactive } from 'vue'

/** Below this width the app uses the compact (phone) layout. */
export const COMPACT_MAX_WIDTH = 899
/** Up to this width (tablets in landscape) the desktop layout fits the sheet to the window. */
export const TABLET_MAX_WIDTH = 1199
const COMPACT_QUERY = `(max-width: ${COMPACT_MAX_WIDTH}px)`
const TABLET_QUERY = `(max-width: ${TABLET_MAX_WIDTH}px)`
// `?layout=compact` / `?layout=desktop` force a layout, e.g. to try the phone layout on a desktop.
const LAYOUT_PARAM = 'layout'

export interface LayoutModeState {
  /** Phone layout: tab full width, one transport bar, desktop chrome hidden. */
  compact: boolean
  /** Compact layout with the touch note pad open. */
  editing: boolean
  /** Desktop layout on a narrow screen: the sheet follows the window width. */
  tablet: boolean
}

export const layoutModeState = reactive<LayoutModeState>({ compact: false, editing: false, tablet: false })

/** How the tab sheet is sized: fitted to the screen (phone, tablet) or the fixed desktop sheet. */
export function sheetFitMode(state: LayoutModeState = layoutModeState): 'compact' | 'tablet' | 'desktop' {
  if (state.compact) return 'compact'
  return state.tablet ? 'tablet' : 'desktop'
}

function forcedLayout(): 'compact' | 'desktop' | null {
  if (typeof location === 'undefined') return null
  const value = new URLSearchParams(location.search).get(LAYOUT_PARAM)
  return value === 'compact' || value === 'desktop' ? value : null
}

export function isCompactViewport(matches: boolean, forced = forcedLayout()): boolean {
  if (forced != null) return forced === 'compact'
  return matches
}

export function setCompactLayout(compact: boolean): void {
  layoutModeState.compact = compact
  if (!compact) layoutModeState.editing = false
}

export function setCompactEditing(editing: boolean): void {
  layoutModeState.editing = layoutModeState.compact && editing
}

/** Follows the viewport width; returns a function that stops following. */
export function watchViewportLayout(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }
  const query = window.matchMedia(COMPACT_QUERY)
  const tabletQuery = window.matchMedia(TABLET_QUERY)
  const apply = () => {
    const compact = isCompactViewport(query.matches)
    layoutModeState.tablet = !compact && tabletQuery.matches
    setCompactLayout(compact)
  }
  apply()
  query.addEventListener('change', apply)
  tabletQuery.addEventListener('change', apply)
  return () => {
    query.removeEventListener('change', apply)
    tabletQuery.removeEventListener('change', apply)
  }
}
