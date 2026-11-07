import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * WCAG contrast of the semantic colour tokens (src/assets/css/tokens.css) in both themes:
 * 4.5:1 for text (AA, normal size), 3:1 for large text and graphics (WCAG 1.4.3 / 1.4.11).
 * Not checked, by choice: `--color-text-faint` (disabled controls and placeholders, which
 * WCAG exempts), field and card borders (decoration; fields are also told apart by their fill)
 * and the intentionally faint tab layers (`--tab-ghost`, the other voice behind).
 */

const css = readFileSync('src/assets/css/tokens.css', 'utf8')

function declarations(selector: RegExp): Map<string, string> {
  const result = new Map<string, string>()
  for (const block of css.matchAll(new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`, 'g'))) {
    for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
      result.set(name, value.trim())
  }
  return result
}

const light = declarations(/(?:^|\n):root/)
const dark = new Map([...light, ...declarations(/(?:^|\n)#darkMode/)])

function resolve(theme: Map<string, string>, token: string): string {
  const value = theme.get(token)
  if (value == null) throw new Error(`unknown token ${token}`)
  const reference = /^var\((--[\w-]+)\)$/.exec(value)
  if (reference) return resolve(theme, reference[1])
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${token} is not a plain colour: ${value}`)
  return value
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const UI_SURFACES = [
  '--color-bg',
  '--color-surface',
  '--color-surface-sunken',
  '--color-surface-raised',
  '--color-hover',
  '--color-field',
  '--color-chrome',
  '--color-chrome-raised',
]
const UI_TEXT = ['--color-text', '--color-text-secondary', '--color-text-muted']

const PAIRS: Array<{ fg: string; bg: string; min: number }> = [
  ...UI_TEXT.flatMap((fg) => UI_SURFACES.map((bg) => ({ fg, bg, min: 4.5 }))),
  ...['--color-chrome', '--color-chrome-raised', '--color-chrome-hover'].map((bg) => ({
    fg: '--color-chrome-text',
    bg,
    min: 4.5,
  })),
  { fg: '--color-accent', bg: '--color-surface', min: 4.5 },
  { fg: '--color-on-accent', bg: '--color-accent', min: 4.5 },
  { fg: '--color-on-accent-soft', bg: '--color-accent-soft', min: 4.5 },
  // The sequencer's bar numbers.
  { fg: '--color-text', bg: '--seq-header', min: 4.5 },
  { fg: '--color-danger', bg: '--color-surface', min: 4.5 },
  ...['--color-inverse-text', '--color-inverse-muted'].flatMap((fg) =>
    ['--color-inverse', '--color-inverse-raised'].map((bg) => ({ fg, bg, min: 4.5 })),
  ),
  { fg: '--color-inverse-accent', bg: '--color-inverse', min: 4.5 },
  // Fret numbers, labels and effect text on the sheet.
  ...['--tab-primary', '--tab-secondary', '--tab-tertiary', '--tab-muted', '--tab-voice2'].map((fg) => ({
    fg,
    bg: '--tab-bg',
    min: 4.5,
  })),
  // Lines and marks on the sheet (strings, staff, slides, let ring, the muted-string cross).
  ...['--tab-string', '--tab-staff', '--tab-slide', '--tab-subtle', '--tab-muted-string'].map((fg) => ({
    fg,
    bg: '--tab-bg',
    min: 3,
  })),
  { fg: '--editor-text', bg: '--editor-bg', min: 4.5 },
  { fg: '--editor-point', bg: '--editor-bg', min: 3 },
]

describe('token contrast', () => {
  for (const [themeName, theme] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`meets WCAG AA in the ${themeName} theme`, () => {
      const failures = PAIRS.flatMap(({ fg, bg, min }) => {
        const ratio = contrast(resolve(theme, fg), resolve(theme, bg))
        return ratio < min ? [`${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`] : []
      })
      expect(failures).toEqual([])
    })
  }

  it('computes the WCAG ratio', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
})
