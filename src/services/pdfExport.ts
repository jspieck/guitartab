/**
 * Lazy Vue-tab export: compose tab + classical into one SVG, then
 * - download vector SVG
 * - rasterize that composite to a multi-page JPEG PDF
 */
import { showUserError, showUserMessage } from './userNotifications'
import { composeTabExportSvg, downloadSvgMarkup } from './tabExportSvg'
import { withAllRowsRendered } from '../stores/tabVirtualizationState'
import { classicalNotation } from './notation/classicalNotationAdapter'

/**
 * Virtualized rows are off-DOM; mount them all and draw their classical staves
 * before the surface is cloned.
 */
function composeFullTabExportSvg() {
  return withAllRowsRendered(async () => {
    await classicalNotation.flushPendingRowDraws()
    return composeTabExportSvg()
  })
}

const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89
const PAGE_MARGIN_PT = 36

function svgToDataUrl(svg: SVGSVGElement): string {
  const xml = new XMLSerializer().serializeToString(svg)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to rasterize export SVG'))
    img.src = src
  })
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.92): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

type PdfPage = {
  jpeg: Uint8Array
  widthPx: number
  heightPx: number
}

function pushPdfObject(
  chunks: Uint8Array[],
  sizeRef: { size: number },
  objStarts: number[],
  encoder: TextEncoder,
  body: string | Uint8Array[],
): void {
  objStarts.push(sizeRef.size)
  const parts = typeof body === 'string' ? [encoder.encode(body)] : body
  for (const part of parts) {
    chunks.push(part)
    sizeRef.size += part.length
  }
}

/** Minimal multi-page PDF containing JPEG images (one per page). */
export function buildJpegPdf(pages: PdfPage[]): Blob {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const sizeRef = { size: 0 }
  const objStarts: number[] = [0]
  const pushText = (s: string) => {
    const b = encoder.encode(s)
    chunks.push(b)
    sizeRef.size += b.length
  }

  pushText('%PDF-1.4\n')

  const catalogId = 1
  const pagesId = 2
  let nextId = 3

  type Pending = PdfPage & {
    pageId: number
    contentId: number
    imageId: number
    drawW: number
    drawH: number
  }
  const pending: Pending[] = []
  const kidIds: number[] = []

  for (const page of pages) {
    const availW = A4_WIDTH_PT - 2 * PAGE_MARGIN_PT
    const availH = A4_HEIGHT_PT - 2 * PAGE_MARGIN_PT
    const scale = Math.min(availW / page.widthPx, availH / page.heightPx)
    const imageId = nextId
    nextId += 1
    const contentId = nextId
    nextId += 1
    const pageId = nextId
    nextId += 1
    kidIds.push(pageId)
    pending.push({
      ...page,
      imageId,
      contentId,
      pageId,
      drawW: page.widthPx * scale,
      drawH: page.heightPx * scale,
    })
  }

  pushPdfObject(
    chunks,
    sizeRef,
    objStarts,
    encoder,
    `${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj\n`,
  )
  pushPdfObject(
    chunks,
    sizeRef,
    objStarts,
    encoder,
    `${pagesId} 0 obj\n<< /Type /Pages /Count ${kidIds.length} /Kids [${kidIds.map((id) => `${id} 0 R`).join(' ')}] >>\nendobj\n`,
  )

  for (const page of pending) {
    pushPdfObject(chunks, sizeRef, objStarts, encoder, [
      encoder.encode(
        `${page.imageId} 0 obj\n` +
          `<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
          `/Length ${page.jpeg.length} >>\nstream\n`,
      ),
      page.jpeg,
      encoder.encode('\nendstream\nendobj\n'),
    ])

    const x = PAGE_MARGIN_PT + (A4_WIDTH_PT - 2 * PAGE_MARGIN_PT - page.drawW) / 2
    const y = A4_HEIGHT_PT - PAGE_MARGIN_PT - page.drawH
    const content = `q\n${page.drawW.toFixed(2)} 0 0 ${page.drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im${page.imageId} Do\nQ\n`
    pushPdfObject(
      chunks,
      sizeRef,
      objStarts,
      encoder,
      `${page.contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`,
    )
    pushPdfObject(
      chunks,
      sizeRef,
      objStarts,
      encoder,
      `${page.pageId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R ` +
        `/MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] ` +
        `/Contents ${page.contentId} 0 R ` +
        `/Resources << /XObject << /Im${page.imageId} ${page.imageId} 0 R >> >> >>\nendobj\n`,
    )
  }

  const xrefStart = sizeRef.size
  pushText(`xref\n0 ${nextId}\n`)
  pushText('0000000000 65535 f \n')
  for (let i = 1; i < nextId; i += 1) {
    pushText(`${String(objStarts[i]).padStart(10, '0')} 00000 n \n`)
  }
  pushText(`trailer\n<< /Size ${nextId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`)

  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return new Blob([out], { type: 'application/pdf' })
}

async function rasterizeSvgPages(
  svg: SVGSVGElement,
  fullWidth: number,
  fullHeight: number,
): Promise<PdfPage[]> {
  const img = await loadImage(svgToDataUrl(svg))
  const scale = 2
  const pageContentHeightPx = Math.floor(
    ((A4_HEIGHT_PT - 2 * PAGE_MARGIN_PT) / (A4_WIDTH_PT - 2 * PAGE_MARGIN_PT)) * fullWidth * scale,
  )
  const canvasWidth = Math.max(1, Math.floor(fullWidth * scale))
  const totalHeight = Math.max(1, Math.floor(fullHeight * scale))
  const pages: PdfPage[] = []

  let y = 0
  while (y < totalHeight) {
    const sliceHeight = Math.min(pageContentHeightPx, totalHeight - y)
    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = sliceHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas unavailable for PDF export')
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, y / scale, fullWidth, sliceHeight / scale, 0, 0, canvasWidth, sliceHeight)
    pages.push({
      jpeg: canvasToJpegBytes(canvas),
      widthPx: canvasWidth,
      heightPx: sliceHeight,
    })
    y += sliceHeight
  }

  return pages
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Vector SVG of the current tab (+ classical when active). */
export async function exportTabAsSvg(): Promise<void> {
  const composed = await composeFullTabExportSvg()
  if (!composed) {
    showUserError('No tab view found to export.')
    return
  }
  downloadSvgMarkup(composed.svgMarkup)
  showUserMessage(
    composed.includesClassical ? 'SVG downloaded (tab + classical notation).' : 'SVG downloaded.',
    'info',
  )
}

/** Printable PDF + companion vector SVG of the composed tab surface. */
export async function exportTabAsPdf(): Promise<void> {
  const composed = await composeFullTabExportSvg()
  if (!composed) {
    showUserError('No tab view found to export.')
    return
  }

  try {
    showUserMessage('Creating PDF…', 'info')
    // Vector companion for editing / high-quality print via other tools
    downloadSvgMarkup(composed.svgMarkup)

    const pages = await rasterizeSvgPages(composed.svg, composed.width, composed.height)
    if (pages.length === 0) {
      showUserError('Export SVG was empty.')
      return
    }
    const blob = buildJpegPdf(pages)
    downloadBlob(blob, 'guitartab.pdf')
    const classicalNote = composed.includesClassical ? ' with classical notation' : ''
    showUserMessage(
      `PDF + SVG downloaded${classicalNote} (${pages.length} page${pages.length === 1 ? '' : 's'}).`,
      'info',
    )
  } catch (error) {
    console.error('PDF export failed', error)
    showUserError(error instanceof Error ? `PDF export failed: ${error.message}` : 'PDF export failed.')
  }
}
