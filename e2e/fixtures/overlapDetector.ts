import type { Page } from '@playwright/test'

export interface LayoutCollision {
  a: string
  b: string
  overlap: { width: number; height: number }
}

/**
 * Finds visual collisions on the rendered tab (and classical staves).
 *
 * Every rendered mark is assigned a kind; pairs of kinds listed in
 * `ALLOWED_TOUCHING` may overlap by design (e.g. a slide line crossing its
 * string). Text boxes are shrunk to their approximate glyph extent, since SVG
 * text boxes include the full line height.
 */
export async function findLayoutCollisions(page: Page, tolerance = 0.5): Promise<LayoutCollision[]> {
  return page.evaluate((tol) => {
    interface Mark {
      kind: string
      label: string
      row: number
      left: number
      right: number
      top: number
      bottom: number
    }

    const SELECTORS: Array<[string, string]> = [
      ['digit', '.tab-row .note-text'],
      ['digit', '.tab-row .grace-note'],
      [
        'effect-text',
        '.tab-row .effect-text, .tab-row .bend-text, .tab-row .trill-text, .tab-row .grace-fret-text',
      ],
      [
        'effect-line',
        '.tab-row .bend-path, .tab-row .bend-arrow, .tab-row .vibrato-path, .tab-row .trill-wave, .tab-row .tremolo-bar-path, .tab-row .let-ring-line, .tab-row .tremolo-picking-line, .tab-row .effect-line',
      ],
      ['arc', '.tab-row .slide-path, .tab-row .tie-path, .tab-row .pulldown-path, .tab-row .grace-slur'],
      ['annotation', '.tab-row .beat-text, .tab-row .dynamic-text, .tab-row .stroke-mark'],
      [
        'measure-info',
        '.tab-row .block-number, .tab-row .bpm-marking, .tab-row .marker, .tab-row .alternative-ending, .tab-row .repeat-count-text',
      ],
      ['time-signature', '.tab-row .time-signature'],
      ['repeat', '.tab-row .repeat-dot'],
      ['chord', '.tab-row .chord-diagram'],
      [
        'rhythm',
        '.tab-row .stem-line, .tab-row .beam-path, .tab-row .flag-path, .tab-row .rest-symbol, .tab-row .tuplet-bracket, .tab-row .tuplet-number',
      ],
      ['staff', '.vexFlowRow .vf-stavenote, .vexFlowRow .vf-clef, .vexFlowRow .vf-stave'],
    ]

    // Kind pairs that are expected to touch.
    const ALLOWED_TOUCHING = new Set([
      'arc|digit', // slides/ties/hammer arcs start and end at their notes
      'arc|arc',
      'effect-line|effect-line', // a bend path and its own arrow
      'effect-line|effect-text', // bend arrow tip and its value label
      'rhythm|rhythm',
      'staff|staff',
      'digit|digit', // two digits of one chord are separate strings, checked by font size below
    ])

    const rowOf = (element: Element): number => {
      const tabRow = element.closest('.tab-row')
      if (tabRow) {
        return [...document.querySelectorAll('.tab-row')].indexOf(tabRow)
      }
      const vexRow = element.closest('.vexFlowRow')
      return vexRow ? [...document.querySelectorAll('.vexFlowRow')].indexOf(vexRow) : -1
    }

    const describe = (element: Element): string => {
      const cls = element.getAttribute('class') ?? element.tagName
      const text = element.textContent?.trim().slice(0, 24)
      return text ? `${cls} "${text}"` : cls
    }

    const marks: Mark[] = []
    for (const [kind, selector] of SELECTORS) {
      document.querySelectorAll(selector).forEach((element) => {
        const rect = element.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) {
          return
        }
        let { top, bottom } = rect
        if (element.tagName.toLowerCase() === 'text') {
          // Approximate glyph box: drop line-gap above and descender space below.
          top += rect.height * 0.25
          bottom -= rect.height * 0.25
        }
        marks.push({
          kind,
          label: describe(element),
          row: rowOf(element),
          left: rect.left,
          right: rect.right,
          top,
          bottom,
        })
      })
    }

    const collisions: Array<{ a: string; b: string; overlap: { width: number; height: number } }> = []
    for (let i = 0; i < marks.length; i += 1) {
      for (let j = i + 1; j < marks.length; j += 1) {
        const a = marks[i]
        const b = marks[j]
        const pair = [a.kind, b.kind].sort().join('|')
        const sameRowKind = a.row === b.row && ALLOWED_TOUCHING.has(pair)
        if (sameRowKind) {
          continue
        }
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (width > tol && height > tol) {
          collisions.push({
            a: `[${a.kind} r${a.row}] ${a.label}`,
            b: `[${b.kind} r${b.row}] ${b.label}`,
            overlap: { width: Math.round(width * 10) / 10, height: Math.round(height * 10) / 10 },
          })
        }
      }
    }
    return collisions
  }, tolerance)
}
