import Song from '../stores/song'
import Settings from '../stores/settingsState'
import { getTrackRenderLayout } from '../stores/tabRenderLayout'
import { scoreSystems } from '../stores/scoreViewState'
import { scoreTrackIds } from './editor/scoreLayout'
import { paginateRows, PRINT_CONTENT_RATIO, type PageSlice, type RowBand } from '../utils/printPagination'
import { applyTheme } from './theme'
import { showUserError } from './userNotifications'

/**
 * Printing: the composed tab (tab + classical staff) laid out on A4 pages, whole rows per
 * page, a running title from page 2 on and page numbers. Built as `#printView`, which the
 * print style sheet shows alone, and removed after printing. Lazy (with the PDF export).
 */

interface ComposedTab {
  svg: SVGSVGElement
  width: number
  height: number
}

/** "Page 2 of 5". */
export function pageLabel(index: number, count: number): string {
  return `Page ${index + 1} of ${count}`
}

/** The shown track's rows in the coordinates of the tab SVG (and so of the composed export). */
function rowBands(): RowBand[] {
  const layout = getTrackRenderLayout(Song.currentTrackId, Song.currentVoiceId)
  const content = document.querySelector('.guitar-tab-view .tab-svg > g')
  const match = /translate\(\s*[-\d.]+[ ,]+([-\d.]+)/.exec(content?.getAttribute('transform') ?? '')
  const paddingTop = match ? Number(match[1]) : 0
  // the score view breaks pages between systems, never inside one
  if (scoreTrackIds() != null) {
    return scoreSystems.map(({ top, bottom }) => ({ top: paddingTop + top, bottom: paddingTop + bottom }))
  }
  return (layout?.rowLayouts ?? [])
    .filter((row) => row != null)
    .map((row) => ({
      top: paddingTop + (row.top ?? row.yOffset),
      bottom: paddingTop + row.yOffset + row.height,
    }))
}

/** Pages `pageHeight` high for a drawing `height` high; one page when the rows are unknown. */
export function printPageSlices(height: number, pageHeight: number): PageSlice[] {
  const rows = rowBands()
  const pages = paginateRows(rows, pageHeight)
  if (pages.length === 0) return [{ top: 0, bottom: height, firstRow: 0, endRow: 0 }]
  // the last row's classical staff may reach a little below its band
  const last = pages[pages.length - 1]
  last.bottom = Math.max(last.bottom, Math.min(height, last.bottom + 8))
  return pages
}

function pageSvg(source: SVGSVGElement, width: number, slice: PageSlice): SVGSVGElement {
  const svg = source.cloneNode(true) as SVGSVGElement
  svg.setAttribute('viewBox', `0 ${slice.top} ${width} ${slice.bottom - slice.top}`)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.setAttribute('class', 'print-page__tab')
  svg.setAttribute('preserveAspectRatio', 'xMidYMin meet')
  return svg
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text != null) node.textContent = text
  return node
}

/** The print pages as DOM for `composed`, the export SVG of the whole tab. */
export function buildPrintView(composed: ComposedTab): HTMLElement {
  const slices = printPageSlices(composed.height, composed.width * PRINT_CONTENT_RATIO)
  const title = [Song.songDescription.title, Song.songDescription.artist].filter(Boolean).join(' – ')
  const view = element('div', 'print-view')
  view.id = 'printView'
  slices.forEach((slice, index) => {
    const page = element('section', 'print-page')
    page.setAttribute('aria-label', pageLabel(index, slices.length))
    // page 1 carries the tab's own title block
    if (index > 0) page.appendChild(element('header', 'print-page__header', title))
    page.appendChild(pageSvg(composed.svg, composed.width, slice))
    if (slices.length > 1)
      page.appendChild(element('footer', 'print-page__footer', pageLabel(index, slices.length)))
    view.appendChild(page)
  })
  return view
}

/**
 * Opens the browser's print dialog with the print pages (which also offers "Save as PDF").
 * The pages print in the light theme, also in dark mode.
 */
export async function printTab(compose: () => Promise<ComposedTab | null>): Promise<void> {
  const composed = await compose()
  if (!composed) {
    showUserError('No tab view found to print.')
    return
  }
  document.getElementById('printView')?.remove()
  const view = buildPrintView(composed)
  document.body.appendChild(view)
  document.body.classList.add('printing')
  applyTheme(false)
  const cleanUp = () => {
    view.remove()
    document.body.classList.remove('printing')
    applyTheme(Settings.darkMode)
    window.removeEventListener('afterprint', cleanUp)
  }
  window.addEventListener('afterprint', cleanUp)
  window.print()
}
