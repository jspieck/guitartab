import { describe, expect, it, vi } from 'vitest'
import { isRowInWindow } from '../src/composables/useVisibleTabRows'
import { isRenderingAllRows, withAllRowsRendered } from '../src/stores/tabVirtualizationState'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)
vi.mock('../src/assets/js/playbackEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.playbackModule),
)
vi.mock('../src/assets/js/midiReceiver', () =>
  import('./helpers/legacyMocks').then((m) => m.midiReceiverModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

describe('tab row virtualization', () => {
  it('keeps rows whose full span (lanes included) overlaps the window', () => {
    const range = { top: 500, bottom: 1000 }
    expect(isRowInWindow({ yOffset: 330, top: 300, height: 120 }, range)).toBe(false)
    expect(isRowInWindow({ yOffset: 430, top: 400, height: 120 }, range)).toBe(true)
    expect(isRowInWindow({ yOffset: 1030, top: 1000, height: 120 }, range)).toBe(true)
    expect(isRowInWindow({ yOffset: 1031, top: 1001, height: 120 }, range)).toBe(false)
    // A tall annotation stack above the strings still counts.
    expect(isRowInWindow({ yOffset: 1100, top: 990, height: 200 }, range)).toBe(true)
  })

  it('renders all rows only while an export task runs, even if it throws', async () => {
    expect(isRenderingAllRows()).toBe(false)
    const seen = await withAllRowsRendered(() => isRenderingAllRows())
    expect(seen).toBe(true)
    expect(isRenderingAllRows()).toBe(false)

    await expect(
      withAllRowsRendered(() => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(isRenderingAllRows()).toBe(false)
  })
})
