import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Colours are written as literals only in src/assets/css/tokens.css; everything else uses the
 * tokens (var(--color-*), var(--tab-*), …), so light and dark mode come from one place.
 */

const TOKENS_FILE = 'src/assets/css/tokens.css'

// Literals that are not theme colours, each with the reason.
const ALLOWED: Array<{ file: string; line: RegExp; reason: string }> = [
  {
    file: 'src/services/dialogs/equalizerModalHandler.ts',
    line: /./,
    reason: 'canvas drawing of the always-dark studio panel; band colours get alpha suffixes appended',
  },
  {
    file: 'src/components/Sequencer.vue',
    line: /const colorPalette =/,
    reason: 'track colours are song data',
  },
  { file: 'src/services/pdfExport.ts', line: /'#ffffff'/, reason: 'exported pages are white paper' },
  { file: 'src/services/tabExportSvg.ts', line: /'#ffffff'/, reason: 'exported pages are white paper' },
  {
    file: 'src/services/notation/classicalNotation.ts',
    line: /setBackgroundFillStyle\('#eed'\)/,
    reason: 'VexFlow annotation background, drawn into the notation SVG',
  },
]

const CSS_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:white|black)\b/
// A quoted string that is nothing but a colour, as in fill="#fff" or ctx.fillStyle = 'rgba(0, 0, 0, .2)'.
const QUOTED_COLOR = /(['"`])\s*(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\(\s*\d[^'"`]*\)|white|black)\s*\1/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(vue|ts|css|scss)$/.test(name) && !name.endsWith('.d.ts') ? [path] : []
  })
}

/** Blanks comments but keeps line breaks, so reported line numbers stay right. */
function stripComments(text: string, lineComments: boolean): string {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  if (lineComments)
    out = out.replace(
      /(^|[\s;{}(,])\/\/.*$/gm,
      (c, lead: string) => lead + ' '.repeat(c.length - lead.length),
    )
  return out
}

/** Colour literals in declaration values (segments that end in { are selectors, e.g. #add). */
function cssFindings(css: string, lineOffset: number): Array<[number, string]> {
  const findings: Array<[number, string]> = []
  let segmentStart = 0
  for (let i = 0; i <= css.length; i++) {
    const ch = css[i]
    if (i < css.length && ch !== ';' && ch !== '{' && ch !== '}') continue
    if (ch !== '{') {
      const segment = css.slice(segmentStart, i)
      const colon = segment.search(/[a-z-]\s*:/)
      if (colon >= 0) {
        const valueStart = segment.indexOf(':', colon) + 1
        const match = segment.slice(valueStart).match(CSS_COLOR)
        if (match) {
          const at = segmentStart + valueStart + (match.index ?? 0)
          findings.push([lineOffset + css.slice(0, at).split('\n').length, match[0]])
        }
      }
    }
    segmentStart = i + 1
  }
  return findings
}

function codeFindings(code: string, lineOffset: number): Array<[number, string]> {
  return code.split('\n').flatMap((line, i): Array<[number, string]> => {
    const match = line.match(QUOTED_COLOR)
    return match ? [[lineOffset + i + 1, match[0]]] : []
  })
}

function findingsFor(file: string, text: string): Array<[number, string]> {
  if (/\.(css|scss)$/.test(file)) return cssFindings(stripComments(text, false), 0)
  if (file.endsWith('.ts')) return codeFindings(stripComments(text, true), 0)
  // .vue: the style block as CSS, the rest (template and script) as code.
  const style = text.match(/<style[^>]*>([\s\S]*?)<\/style>/)
  if (style == null) return codeFindings(stripComments(text, true), 0)
  const styleStart = (style.index ?? 0) + style[0].indexOf('>') + 1
  const before = text.slice(0, styleStart)
  const styleOffset = before.split('\n').length - 1
  return [
    ...codeFindings(stripComments(before, true), 0),
    ...cssFindings(stripComments(style[1], false), styleOffset),
  ]
}

describe('design tokens', () => {
  it('writes colours only in tokens.css', () => {
    const offenders = sourceFiles('src')
      .map((path) => relative('.', path).split('\\').join('/'))
      .filter((file) => file !== TOKENS_FILE)
      .flatMap((file) => {
        const text = readFileSync(file, 'utf8')
        const lines = text.split('\n')
        return findingsFor(file, text)
          .filter(([line]) => !ALLOWED.some((a) => a.file === file && a.line.test(lines[line - 1] ?? '')))
          .map(([line, literal]) => `${file}:${line}  ${literal}`)
      })
    expect(offenders).toEqual([])
  })

  it('defines every token it uses', () => {
    const tokens = readFileSync(TOKENS_FILE, 'utf8')
    const defined = new Set([...tokens.matchAll(/(--[a-z][a-z0-9-]*)\s*:/g)].map((m) => m[1]))
    const families =
      /^--(color|tab|editor|seq|gray|blue|red|green|amber|teal|viz|wood|string|indigo|radius|space|text|font|shadow|duration|control|textarea)-/
    const undefinedUses = sourceFiles('src').flatMap((path) => {
      const text = readFileSync(path, 'utf8')
      return [...text.matchAll(/var\((--[a-z][a-z0-9-]*)/g)]
        .map((m) => m[1])
        .filter((name) => families.test(name) && !defined.has(name))
        .map((name) => `${relative('.', path)}: ${name}`)
    })
    expect([...new Set(undefinedUses)]).toEqual([])
  })
})
