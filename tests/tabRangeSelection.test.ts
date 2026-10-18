import { describe, expect, it, vi } from 'vitest'
import type { RenderedTabRow } from '../src/types/tab'
import { findRowAtY, resolveStringIndexInRow } from '../src/utils/tabLayout'

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

function row(id: number, yOffset: number): RenderedTabRow {
  return {
    id,
    measures: [],
    startBlockId: 0,
    endBlockId: 0,
    yOffset,
  }
}

describe('tab range layout helpers', () => {
  it('finds the row that contains a Y coordinate', () => {
    const rows = [row(0, 80), row(1, 200)]

    expect(findRowAtY(rows, 120, 120)?.id).toBe(0)
    expect(findRowAtY(rows, 220, 120)?.id).toBe(1)
  })

  it('resolves the string from row-local Y: top line is the highest string', () => {
    // Third line from the top of a 6-string tab is the G string, index 3 (strings count from the low E).
    expect(resolveStringIndexInRow(104, 80, 12, 6)).toBe(3)
    expect(resolveStringIndexInRow(80, 80, 12, 6)).toBe(5) // top line: high e
    expect(resolveStringIndexInRow(140, 80, 12, 6)).toBe(0) // bottom line: low E
    expect(resolveStringIndexInRow(500, 80, 12, 6)).toBe(0) // below the tab clamps to the low E
    expect(resolveStringIndexInRow(0, 80, 12, 4)).toBe(3) // above clamps to the top line
  })
})
