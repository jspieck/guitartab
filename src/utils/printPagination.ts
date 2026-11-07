/**
 * Splits the tab into pages without cutting a row: each page takes whole rows (tab, lanes and
 * classical staff) while they fit. Coordinates are those of the composed export SVG.
 */

export interface RowBand {
  top: number
  bottom: number
}

export interface PageSlice {
  /** first and last y of the page's content in the export SVG */
  top: number
  bottom: number
  /** rows on the page: [first, end) */
  firstRow: number
  endRow: number
}

/** Space kept above a page's first row (not on page 1, which starts at the title). */
const PAGE_TOP_GAP = 12

/**
 * Pages of at most `pageHeight` (export units). Page 1 starts at 0, so it carries the title
 * block; a row taller than a page gets a page of its own (printing scales it down).
 */
export function paginateRows(rows: readonly RowBand[], pageHeight: number): PageSlice[] {
  const pages: PageSlice[] = []
  if (rows.length === 0 || !(pageHeight > 0)) return pages
  let page: PageSlice = { top: 0, bottom: rows[0].bottom, firstRow: 0, endRow: 1 }
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].bottom - page.top <= pageHeight) {
      page.bottom = rows[i].bottom
      page.endRow = i + 1
      continue
    }
    pages.push(page)
    const top = Math.max(page.bottom, rows[i].top - PAGE_TOP_GAP)
    page = { top, bottom: rows[i].bottom, firstRow: i, endRow: i + 1 }
  }
  pages.push(page)
  return pages
}

/** A4 portrait content area (210 × 297 mm less 12 mm margins, less room for header and footer). */
export const PRINT_CONTENT_RATIO = (297 - 24 - 16) / (210 - 24)
