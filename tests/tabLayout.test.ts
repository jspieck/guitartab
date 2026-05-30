import { describe, expect, it } from 'vitest'
import type { RenderedTabRow, TabBeat } from '../src/types/tab'
import {
  clickToTabPosition,
  findBeatAtPosition,
  getSelectionRenderPoint,
} from '../src/utils/tabLayout'

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

    expect(position).toEqual({
      x: 87,
      y: 24,
    })
  })
})