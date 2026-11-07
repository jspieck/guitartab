import { describe, expect, it } from 'vitest'
import { paginateRows } from '../src/utils/printPagination'

const rows = (heights: number[], start = 100, gap = 20) => {
  let y = start
  return heights.map((height) => {
    const band = { top: y, bottom: y + height }
    y += height + gap
    return band
  })
}

describe('print pagination', () => {
  it('fills pages with whole rows; page 1 keeps the title above the first row', () => {
    const pages = paginateRows(rows([200, 200, 200, 200, 200]), 760)
    expect(pages.map((page) => [page.firstRow, page.endRow])).toEqual([
      [0, 3],
      [3, 5],
    ])
    expect(pages[0].top).toBe(0)
    // page 2 starts just above its first row, after page 1's last row
    expect(pages[1].top).toBeGreaterThanOrEqual(pages[0].bottom)
    expect(pages[1].top).toBeLessThanOrEqual(rows([200, 200, 200, 200])[3].top)
  })

  it('never splits a row, even one taller than a page', () => {
    const pages = paginateRows(rows([300, 900, 300]), 700)
    expect(pages.map((page) => [page.firstRow, page.endRow])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ])
    for (const page of pages) expect(page.bottom).toBeGreaterThan(page.top)
  })

  it('has no pages without rows', () => {
    expect(paginateRows([], 700)).toEqual([])
  })
})
