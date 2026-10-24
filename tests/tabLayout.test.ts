import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderedTabRow, TabBeat } from '../src/types/tab'
import { clickToTabPosition, findBeatAtPosition, getSelectionRenderPoint } from '../src/utils/tabLayout'

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

const { getBlockRenderLayout } = vi.hoisted(() => ({
  getBlockRenderLayout: vi.fn(),
}))

vi.mock('../src/stores/tabRenderLayout', () => ({
  getBlockRenderLayout: (...args: unknown[]) => getBlockRenderLayout(...args),
  getTrackRenderLayout: () => null,
}))

function createBeat(duration: string): TabBeat {
  return {
    duration,
    notes: [],
  } as TabBeat
}

function createRow(measures: TabBeat[][]): RenderedTabRow {
  return {
    id: 0,
    measures: measures.map((measure) => ({
      width: 200,
      data: measure,
    })),
    startBlockId: 0,
    endBlockId: Math.max(0, measures.length - 1),
    yOffset: 0,
  }
}

function createSvgElement(width: number, height: number): SVGSVGElement {
  const matrix = {
    inverse: () => matrix,
  }

  return {
    width: { baseVal: { value: width } },
    height: { baseVal: { value: height } },
    viewBox: { baseVal: { width: 0, height: 0 } },
    createSVGPoint: () => {
      const point = {
        x: 0,
        y: 0,
        matrixTransform: () => ({ x: point.x, y: point.y }),
      }

      return point
    },
    getScreenCTM: () => matrix,
  } as unknown as SVGSVGElement
}

describe('tabLayout', () => {
  beforeEach(() => {
    getBlockRenderLayout.mockReset()
    getBlockRenderLayout.mockReturnValue(null)
  })
  it('uses displayed beat widths when hit-testing short notes', () => {
    const measure = [createBeat('s'), createBeat('s'), createBeat('q')]

    expect(findBeatAtPosition(measure, 25)).toBe(1)
  })

  it('converts scaled SVG clicks to the correct beat position', () => {
    const rowData = createRow([[createBeat('e'), createBeat('e'), createBeat('q')]])
    const svgElement = createSvgElement(1200, 1600)

    const position = clickToTabPosition(
      {
        clientX: 139.14285714285714,
        clientY: 100,
      } as MouseEvent,
      svgElement,
      rowData,
      true,
      () => 10,
    )

    expect(position).toEqual({
      measureIndex: 0,
      blockId: 0,
      beatIndex: 1,
    })
  })

  it('returns the shared selection render point for the active beat center', () => {
    const rowData = createRow([[createBeat('e'), createBeat('e'), createBeat('q')]])

    const position = getSelectionRenderPoint(
      rowData,
      {
        stringIndex: 2,
        measureIndex: 0,
        beatIndex: 1,
        blockId: 0,
      },
      true,
      12,
      () => 10,
    )

    // String 2 (D) is the fourth line from the bottom: line 3 from the top, 3 × 12.
    expect(position).toEqual({
      x: 87,
      y: 36,
    })
  })

  it('maps clicks to layout beat positions when measure slots are stretched', () => {
    getBlockRenderLayout.mockReturnValue({
      xOffset: 32,
      rowId: 0,
      numInRow: 0,
      width: 400,
      minOffset: 50,
      pageId: 0,
      beatPositions: [53, 103, 203, 303],
    })

    const rowData = createRow([[createBeat('e'), createBeat('e'), createBeat('q'), createBeat('q')]])
    rowData.measures[0].width = 400
    const svgElement = createSvgElement(1200, 1600)
    const paddingLeft = 1200 / 21
    const tabLabel = 32
    const clickInThirdBeat = paddingLeft + tabLabel + 220

    const position = clickToTabPosition(
      {
        clientX: clickInThirdBeat,
        clientY: 100,
      } as MouseEvent,
      svgElement,
      rowData,
      true,
      () => 10,
      0,
      0,
    )

    expect(position).toEqual({
      measureIndex: 0,
      blockId: 0,
      beatIndex: 2,
    })
  })

  it('centers the selection on layout beat positions', () => {
    getBlockRenderLayout.mockReturnValue({
      xOffset: 32,
      rowId: 0,
      numInRow: 0,
      width: 400,
      minOffset: 50,
      pageId: 0,
      beatPositions: [53, 153, 253],
    })

    const rowData = createRow([[createBeat('q'), createBeat('q')]])

    const position = getSelectionRenderPoint(
      rowData,
      {
        stringIndex: 1,
        measureIndex: 0,
        beatIndex: 1,
        blockId: 0,
      },
      true,
      12,
      () => 10,
      0,
      0,
    )

    // String 1 (A) is the second line from the bottom: line 4 from the top.
    expect(position).toEqual({
      x: 32 + 153 + 50,
      y: 48,
    })
  })
})
