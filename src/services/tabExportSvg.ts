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

// Editing aids drawn into the tab SVG that don't belong in an export.
const INTERACTION_LAYERS =
  '#playBackBarGroup0, .range-selection-overlay, .selection-indicator, .string-click-area, .tab-empty-hint'

/**
 * Presentation properties copied from the live drawing. The tab is coloured by the app's style
 * sheets (classes, scoped styles, CSS variables), none of which reach a standalone SVG drawn as
 * an image, so without them string and bar lines vanish and text falls back to black.
 */
const INLINED_PROPERTIES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
] as const

function inlineComputedStyle(source: Element, target: Element): boolean {
  if (typeof getComputedStyle !== 'function') return true
  const computed = getComputedStyle(source)
  if (computed.display === 'none' || computed.visibility === 'hidden') return false
  const declarations: string[] = []
  for (const property of INLINED_PROPERTIES) {
    const value = computed.getPropertyValue(property).trim()
    // happy-dom (tests) may hand back unresolved variables; a standalone SVG can't use them
    if (value !== '' && !value.includes('var(')) declarations.push(`${property}: ${value}`)
  }
  if (declarations.length > 0) target.setAttribute('style', declarations.join('; '))
  else target.removeAttribute('style')
  return true
}

/** Clones `source` with its computed look inlined; null for parts that aren't drawn. */
function cloneWithStyles(source: Node): Node | null {
  if (!(source instanceof Element)) return source.cloneNode(true)
  if (source.matches(INTERACTION_LAYERS)) return null
  const clone = source.cloneNode(false) as Element
  if (!inlineComputedStyle(source, clone)) return null
  source.childNodes.forEach((child) => {
    const childClone = cloneWithStyles(child)
    if (childClone) clone.appendChild(childClone)
  })
  return clone
}

function cloneSvgContents(source: SVGSVGElement, targetGroup: SVGGElement): void {
  source.childNodes.forEach((child) => {
    const clone = cloneWithStyles(child)
    if (clone) targetGroup.appendChild(clone)
  })
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

/** Families named in the export's inlined styles ("Source Sans Pro", "notesFont", …). */
export function usedFontFamilies(markup: string): Set<string> {
  const families = new Set<string>()
  // inlined styles (`font-family: &quot;Source Sans Pro&quot;`) and attributes (`font-family="…"`)
  for (const match of markup.replace(/&quot;/g, "'").matchAll(/font-family(?::\s*|=")([^;"]+)/g)) {
    for (const name of match[1].split(',')) {
      const family = name.trim().replace(/^["']|["']$/g, '')
      if (family) families.add(family.toLowerCase())
    }
  }
  return families
}

/** The page's `@font-face` rules for `families`: family, absolute font URL and the rule's descriptors. */
function fontFacesFor(
  families: Set<string>,
): { family: string; url: string; weight: string; style: string }[] {
  const faces: { family: string; url: string; weight: string; style: string }[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // a cross-origin sheet
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      const family = rule.style
        .getPropertyValue('font-family')
        .trim()
        .replace(/^["']|["']$/g, '')
      if (!families.has(family.toLowerCase())) continue
      const src = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue('src'))?.[1]
      if (src == null) continue
      faces.push({
        family,
        url: new URL(src, sheet.href ?? document.baseURI).href,
        weight: rule.style.getPropertyValue('font-weight') || 'normal',
        style: rule.style.getPropertyValue('font-style') || 'normal',
      })
    }
  }
  return faces
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/**
 * Embeds the web fonts the export uses as data URLs. An SVG drawn as an image (the PDF
 * raster) or opened on its own can't load the app's font files, so the digits and dynamics
 * fell back to a default font. Fonts that fail to load are left out.
 */
export async function embedExportFonts(composed: ComposedTabExport): Promise<ComposedTabExport> {
  const faces = fontFacesFor(usedFontFamilies(composed.svgMarkup))
  const rules = await Promise.all(
    faces.map(async (face) => {
      try {
        const response = await fetch(face.url)
        if (!response.ok) return ''
        const type = response.headers.get('content-type') || 'font/ttf'
        const data = bytesToBase64(new Uint8Array(await response.arrayBuffer()))
        return (
          `@font-face { font-family: "${face.family}"; src: url(data:${type};base64,${data}); ` +
          `font-weight: ${face.weight}; font-style: ${face.style}; }`
        )
      } catch {
        return ''
      }
    }),
  )
  const css = rules.filter(Boolean).join('\n')
  if (css === '') return composed
  const style = document.createElementNS(SVG_NS, 'style')
  style.textContent = css
  composed.svg.insertBefore(style, composed.svg.firstChild)
  return { ...composed, svgMarkup: new XMLSerializer().serializeToString(composed.svg) }
}
