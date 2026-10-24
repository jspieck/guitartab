/**
 * Build a single export SVG of the live Vue tab surface, including classical
 * notation row SVGs when active. Pure DOM composition.
 */

export interface ComposedTabExport {
  svg: SVGSVGElement
  width: number
  height: number
  includesClassical: boolean
  svgMarkup: string
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export function computeExportBounds(
  tab: { width: number; height: number },
  layers: { left: number; top: number; width: number; height: number }[],
): { width: number; height: number } {
  let width = tab.width
  let height = tab.height
  for (const layer of layers) {
    width = Math.max(width, Math.ceil(layer.left + layer.width))
    height = Math.max(height, Math.ceil(layer.top + layer.height))
  }
  return { width, height }
}

function findTabView(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null
  }
  return document.querySelector('.guitar-tab-view')
}

function findTabSvg(view: HTMLElement): SVGSVGElement | null {
  return view.querySelector('.tab-svg')
}

/** Collect VexFlow SVGs painted into classical row surfaces. */
function findClassicalSvgs(view: HTMLElement): {
  svg: SVGSVGElement
  left: number
  top: number
  width: number
  height: number
}[] {
  const viewRect = view.getBoundingClientRect()
  const results: {
    svg: SVGSVGElement
    left: number
    top: number
    width: number
    height: number
  }[] = []
  view.querySelectorAll('.vexFlowRow svg').forEach((node) => {
    if (!(node instanceof SVGSVGElement)) {
      return
    }
    const rect = node.getBoundingClientRect()
    const width = Number(node.getAttribute('width')) || node.clientWidth || rect.width || 0
    const height = Number(node.getAttribute('height')) || node.clientHeight || rect.height || 0
    results.push({
      svg: node,
      left: rect.left - viewRect.left + view.scrollLeft,
      top: rect.top - viewRect.top + view.scrollTop,
      width,
      height,
    })
  })
  return results
}

// Editing aids drawn into the tab SVG that don't belong in an export (they are also coloured with
// CSS variables, which a standalone SVG can't resolve).
const INTERACTION_LAYERS =
  '#playBackBarGroup0, .range-selection-overlay, .selection-indicator, .string-click-area'

function cloneSvgContents(source: SVGSVGElement, targetGroup: SVGGElement): void {
  Array.from(source.childNodes).forEach((child) => {
    targetGroup.appendChild(child.cloneNode(true))
  })
  targetGroup.querySelectorAll(INTERACTION_LAYERS).forEach((node) => node.remove())
}

/**
 * Compose tab SVG + classical overlay into one standalone SVG document.
 * Returns null when no tab view is mounted.
 */
export function composeTabExportSvg(): ComposedTabExport | null {
  const view = findTabView()
  if (!view) {
    return null
  }
  const tabSvg = findTabSvg(view)
  if (!tabSvg) {
    return null
  }

  const tabWidth = Number(tabSvg.getAttribute('width')) || tabSvg.clientWidth || 800
  const tabHeight = Number(tabSvg.getAttribute('height')) || tabSvg.clientHeight || 600
  const classical = findClassicalSvgs(view)
  const { width, height } = computeExportBounds({ width: tabWidth, height: tabHeight }, classical)

  const root = document.createElementNS(SVG_NS, 'svg')
  root.setAttribute('xmlns', SVG_NS)
  root.setAttribute('width', String(width))
  root.setAttribute('height', String(height))
  root.setAttribute('viewBox', `0 0 ${width} ${height}`)

  const bg = document.createElementNS(SVG_NS, 'rect')
  bg.setAttribute('width', String(width))
  bg.setAttribute('height', String(height))
  bg.setAttribute('fill', '#ffffff')
  root.appendChild(bg)

  const tabGroup = document.createElementNS(SVG_NS, 'g')
  tabGroup.setAttribute('class', 'tab-export-layer')
  cloneSvgContents(tabSvg, tabGroup)
  root.appendChild(tabGroup)

  for (const layer of classical) {
    const group = document.createElementNS(SVG_NS, 'g')
    group.setAttribute('class', 'classical-export-layer')
    group.setAttribute('transform', `translate(${layer.left}, ${layer.top})`)
    cloneSvgContents(layer.svg, group)
    root.appendChild(group)
  }

  const svgMarkup = new XMLSerializer().serializeToString(root)
  return {
    svg: root,
    width,
    height,
    includesClassical: classical.length > 0,
    svgMarkup,
  }
}

export function downloadSvgMarkup(markup: string, filename = 'guitartab.svg'): void {
  if (typeof document === 'undefined') {
    return
  }
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
