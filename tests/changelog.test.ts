import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { inlineParts, latestChangelogTitle, parseChangelog } from '../src/utils/changelog'

vi.mock('../src/services/dialogs/dialogs', () => ({
  DIALOGS: { WHATS_NEW: { id: 'whatsNewModal' } },
  openDialog: vi.fn(),
}))
const { shouldShowWhatsNew } = await import('../src/services/whatsNew')

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  }
}

describe("changelog (What's new, Big win 34)", () => {
  const sample = `# Changelog

Notes for writers, not shown.

## Version 2

A short intro that wraps
onto a second line.

- **Bold** point with \`code\`
- A point that wraps
  onto the next line

## Version 1
- First
`

  it('reads entries newest first, with joined intro lines and wrapped points', () => {
    expect(parseChangelog(sample)).toEqual([
      {
        title: 'Version 2',
        intro: ['A short intro that wraps onto a second line.'],
        items: ['**Bold** point with `code`', 'A point that wraps onto the next line'],
      },
      { title: 'Version 1', intro: [], items: ['First'] },
    ])
    expect(latestChangelogTitle(sample)).toBe('Version 2')
  })

  it('splits bold and code inside a line', () => {
    expect(inlineParts('**Bold** point with `code`.')).toEqual([
      { text: 'Bold', strong: true },
      { text: ' point with ' },
      { text: 'code', code: true },
      { text: '.' },
    ])
  })

  it('the real CHANGELOG.md has an entry with points', () => {
    const [latest] = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'))
    expect(latest.title.length).toBeGreaterThan(0)
    expect(latest.items.length).toBeGreaterThan(0)
  })

  it('shows the newest entry once to returning visitors, never on a first visit', () => {
    const storage = memoryStorage()
    expect(shouldShowWhatsNew(true, 'v1', storage)).toBe(false)
    expect(shouldShowWhatsNew(false, 'v1', storage)).toBe(false)
    expect(shouldShowWhatsNew(false, 'v2', storage)).toBe(true)
    expect(shouldShowWhatsNew(false, 'v2', storage)).toBe(false)
    // Someone who used the app before the dialog existed has no "seen" entry yet.
    expect(shouldShowWhatsNew(false, 'v2', memoryStorage())).toBe(true)
    expect(shouldShowWhatsNew(false, '', memoryStorage())).toBe(false)
  })
})
