import { describe, expect, it } from 'vitest'
import type { RenderedTabRow } from '../src/types/tab'
import { findRowAtY, resolveStringIndexInRow } from '../src/utils/tabLayout'

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

  it('resolves string index from row-local Y', () => {
    expect(resolveStringIndexInRow(104, 80, 12)).toBe(2)
  })
})
