import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  computeOverlayRectForRow,
  normalizeOverlayRange,
  type OverlayPosition,
} from '../src/utils/overlaySelectionLayout'
import { TAB_CONSTANTS } from '../src/utils/tabLayout'
import type { RenderedTabRow } from '../src/types/tab'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
vi.mock('../src/services/dialogs/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)

const getRowIdForBlock = vi.fn()
const getBeatPositionInRow = vi.fn()
const getMeasureEndPositionInRow = vi.fn()
const getRowContentWidthFromLayout = vi.fn()

vi.mock('../src/services/editor/renderBridge', () => ({
  default: {
    getRowIdForBlock: (...args: unknown[]) => getRowIdForBlock(...args),
  },
}))

vi.mock('../src/utils/beatPositionInRow', () => ({
  getBeatPositionInRow: (...args: unknown[]) => getBeatPositionInRow(...args),
  getMeasureEndPositionInRow: (...args: unknown[]) => getMeasureEndPositionInRow(...args),
  getRowContentWidthFromLayout: (...args: unknown[]) => getRowContentWidthFromLayout(...args),
}))

function pos(blockId: number, beatId: number): OverlayPosition {
  return {
    trackId: 0,
    voiceId: 0,
    blockId,
    beatId,
    abstractTimePos: 0,
  }
}

function createRowData(): Pick<RenderedTabRow, 'startBlockId' | 'measures'> {
  return {
    startBlockId: 1,
    measures: [
      {
        width: 200,
        data: [
          { duration: 'q', notes: [] },
          { duration: 'q', notes: [] },
          { duration: 'q', notes: [] },
          { duration: 'q', notes: [] },
        ],
      },
    ],
  }
}

describe('overlaySelectionLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRowIdForBlock.mockReturnValue(0)
    getBeatPositionInRow.mockReturnValue(null)
    getMeasureEndPositionInRow.mockReturnValue(null)
    getRowContentWidthFromLayout.mockReturnValue(null)
  })

  it('normalizes reversed block ranges', () => {
    expect(normalizeOverlayRange(pos(3, 1), pos(1, 0))).toEqual({
      blockIdStart: 1,
      blockIdEnd: 3,
      beatIdStart: 0,
      beatIdEnd: 1,
    })
  })

  it('normalizes reversed beat ranges within one block', () => {
    expect(normalizeOverlayRange(pos(2, 3), pos(2, 1))).toEqual({
      blockIdStart: 2,
      blockIdEnd: 2,
      beatIdStart: 1,
      beatIdEnd: 3,
    })
  })

  it('computes overlay width using layout beat positions when available', () => {
    getBeatPositionInRow.mockImplementation((_trackId, _voiceId, _blockId, beatId) => {
      if (beatId === 0) return 55
      if (beatId === 2) return 135
      return null
    })

    const rect = computeOverlayRectForRow(
      0,
      0,
      0,
      createRowData(),
      false,
      {
        blockIdStart: 1,
        blockIdEnd: 1,
        beatIdStart: 0,
        beatIdEnd: 1,
      },
      4,
      () => 10,
      6,
    )

    expect(rect).toEqual({
      x: 55,
      y: 0,
      width: 80,
      height: (6 - 1) * TAB_CONSTANTS.STRING_SPACING,
    })
  })

  it('falls back to vue tab layout math when layout positions are unavailable', () => {
    const rowData = createRowData()
    const contentPadding = () => 10

    const rect = computeOverlayRectForRow(
      0,
      0,
      0,
      rowData,
      false,
      {
        blockIdStart: 1,
        blockIdEnd: 1,
        beatIdStart: 0,
        beatIdEnd: 1,
      },
      4,
      contentPadding,
      6,
    )

    const beat0X = TAB_CONSTANTS.START_PADDING + contentPadding(1)
    const beat2X = beat0X + TAB_CONSTANTS.BEAT_WIDTH * 2

    expect(rect).toEqual({
      x: beat0X,
      y: 0,
      width: beat2X - beat0X,
      height: (6 - 1) * TAB_CONSTANTS.STRING_SPACING,
    })
  })

  it('returns null for rows outside the overlay span', () => {
    getRowIdForBlock.mockReturnValue(0)

    const rect = computeOverlayRectForRow(
      0,
      0,
      2,
      createRowData(),
      false,
      {
        blockIdStart: 1,
        blockIdEnd: 1,
        beatIdStart: 0,
        beatIdEnd: 1,
      },
      4,
      () => 10,
      6,
    )

    expect(rect).toBeNull()
  })
})
