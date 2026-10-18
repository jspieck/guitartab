import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isCompactViewport,
  layoutModeState,
  setCompactEditing,
  setCompactLayout,
  sheetFitMode,
  watchViewportLayout,
} from '../src/stores/layoutModeState'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)
vi.mock('../src/assets/js/playBackLogicNew', () =>
  import('./helpers/legacyMocks').then((m) => m.playbackModule),
)
vi.mock('../src/assets/js/midiReceiver', () =>
  import('./helpers/legacyMocks').then((m) => m.midiReceiverModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

describe('layout mode', () => {
  beforeEach(() => {
    setCompactLayout(false)
    layoutModeState.tablet = false
  })

  it('follows the media query unless ?layout= forces a layout', () => {
    expect(isCompactViewport(true, null)).toBe(true)
    expect(isCompactViewport(false, null)).toBe(false)
    expect(isCompactViewport(true, 'desktop')).toBe(false)
    expect(isCompactViewport(false, 'compact')).toBe(true)
  })

  it('only edits with the touch pad in the compact layout', () => {
    setCompactEditing(true)
    expect(layoutModeState.editing).toBe(false)
    setCompactLayout(true)
    setCompactEditing(true)
    expect(layoutModeState.editing).toBe(true)
    // Leaving the compact layout closes the pad.
    setCompactLayout(false)
    expect(layoutModeState.editing).toBe(false)
  })

  it('follows the window width through matchMedia until stopped', () => {
    let width = 412
    const listeners = new Set<() => void>()
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({
        get matches() {
          return width <= Number(/max-width: (\d+)px/.exec(query)![1])
        },
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      }),
    })
    const resize = (next: number) => {
      width = next
      listeners.forEach((listener) => listener())
    }

    const stop = watchViewportLayout()
    expect(layoutModeState).toMatchObject({ compact: true, tablet: false })
    resize(1024)
    expect(layoutModeState).toMatchObject({ compact: false, tablet: true })
    resize(1600)
    expect(layoutModeState).toMatchObject({ compact: false, tablet: false })

    stop()
    expect(listeners.size).toBe(0)
    vi.unstubAllGlobals()
  })

  it('fits the sheet on phones and tablets, not on desktops', () => {
    expect(sheetFitMode({ compact: true, editing: false, tablet: false })).toBe('compact')
    expect(sheetFitMode({ compact: false, editing: false, tablet: true })).toBe('tablet')
    expect(sheetFitMode({ compact: false, editing: false, tablet: false })).toBe('desktop')
  })
})

describe('compact sheet', () => {
  it('makes the zoomed sheet exactly fill the screen', async () => {
    const { compactSheetWidth, effectiveCompactZoom } = await import('../src/services/compactLayout')
    expect(compactSheetWidth(400, 1)).toBe(400)
    // Zoomed in: a narrower sheet (fewer bars per row), scaled up to the screen width.
    expect(compactSheetWidth(600, 2)).toBe(300)
    expect(compactSheetWidth(400, 0.8)).toBe(500)
    // The zoom is capped so the sheet stays wide enough for a bar, and still fills the screen.
    expect(effectiveCompactZoom(360, 2)).toBe(1.5)
    expect(compactSheetWidth(360, 2)).toBe(240)
    expect(compactSheetWidth(360, 2) * effectiveCompactZoom(360, 2)).toBe(360)
  })

  it('keeps the zoom within its limits, rounded to whole percent', async () => {
    const { clampCompactZoom, COMPACT_ZOOM_MAX, COMPACT_ZOOM_MIN } =
      await import('../src/services/compactLayout')
    expect(clampCompactZoom(5)).toBe(COMPACT_ZOOM_MAX)
    expect(clampCompactZoom(0.1)).toBe(COMPACT_ZOOM_MIN)
    expect(clampCompactZoom(1.23456)).toBe(1.23)
  })

  it('measures the pinch between two fingers', async () => {
    const { pinchDistance } = await import('../src/services/compactLayout')
    expect(pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})
