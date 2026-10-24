import { beforeEach, describe, expect, it, vi } from 'vitest'

class HTMLElementStub {}
vi.stubGlobal('HTMLElement', HTMLElementStub)

import Settings from '../src/stores/settingsState'
import {
  applyViewportPageMode,
  registerMainContentElement,
  syncViewportZoom,
  tabViewportState,
} from '../src/stores/tabViewportState'
import {
  clearClassicalRowSurfaces,
  getClassicalRowSurface,
  registerClassicalRowSurface,
} from '../src/stores/classicalNotationSurfaceState'

describe('tabViewportState', () => {
  beforeEach(() => {
    tabViewportState.zoom = 1
    tabViewportState.pageMode = true
    tabViewportState.sheetWidthPx = 1200
    tabViewportState.mainContentEl = null
    Settings.currentZoom = 1
    Settings.pageMode = true
  })

  it('syncs zoom into settings', () => {
    syncViewportZoom(1.2, 1)

    expect(tabViewportState.zoom).toBe(1.2)
    expect(Settings.currentZoom).toBe(1.2)
  })

  it('applies page mode width and resets zoom in fullscreen', () => {
    tabViewportState.zoom = 1.3
    applyViewportPageMode(false, 1600)

    expect(tabViewportState.pageMode).toBe(false)
    expect(tabViewportState.sheetWidthPx).toBe(1600)
    expect(Settings.pageMode).toBe(false)
    expect(tabViewportState.zoom).toBe(1)
  })

  it('registers the scroll container element', () => {
    const element = { marker: 'main-content' } as HTMLElement
    registerMainContentElement(element)

    expect(tabViewportState.mainContentEl?.marker).toBe('main-content')
  })
})

describe('classicalNotationSurfaceState', () => {
  beforeEach(() => {
    clearClassicalRowSurfaces()
  })

  it('registers and resolves row surfaces by id', () => {
    const row = new HTMLElementStub()
    registerClassicalRowSurface(2, row)

    expect(getClassicalRowSurface(2)).toBe(row)
    expect(getClassicalRowSurface(0)).toBeNull()
  })

  it('clears registered row surfaces', () => {
    registerClassicalRowSurface(0, new HTMLElementStub())
    clearClassicalRowSurfaces()

    expect(getClassicalRowSurface(0)).toBeNull()
  })
})
