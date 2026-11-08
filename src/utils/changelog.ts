/**
 * Reads CHANGELOG.md for the "What's new" dialog (Big win 34). The file is written for users:
 * `## <title>` starts an entry (newest first), `- ` lines are its points, other lines a short
 * intro. Only that subset of Markdown, plus `**bold**` and `` `code` `` inside a line.
 */
export interface ChangelogEntry {
  /** The heading text; also what "seen" remembers. */
  title: string
  intro: string[]
  items: string[]
}

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let current: ChangelogEntry | null = null
  // What the previous line added to, so a wrapped line continues it.
  let last: 'item' | 'intro' | null = null
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim()
    const heading = /^##\s+(.+)$/.exec(line)
    if (heading) {
      current = { title: heading[1].trim(), intro: [], items: [] }
      entries.push(current)
      last = null
    } else if (current == null || line === '' || line.startsWith('#') || line.startsWith('<!--')) {
      last = null
    } else if (/^[-*]\s+/.test(line)) {
      current.items.push(line.replace(/^[-*]\s+/, ''))
      last = 'item'
    } else if (last === 'item' && /^\s+/.test(raw)) {
      current.items[current.items.length - 1] += ` ${line}`
    } else if (last === 'intro') {
      current.intro[current.intro.length - 1] += ` ${line}`
    } else {
      current.intro.push(line)
      last = 'intro'
    }
  }
  return entries
}

export function latestChangelogTitle(markdown: string): string | null {
  return /^##\s+(.+?)\s*$/m.exec(markdown)?.[1] ?? null
}

export type InlinePart = { text: string; strong?: boolean; code?: boolean }

/** `Use **Shift+L** for `lyrics`` → plain, bold and code parts, for rendering without v-html. */
export function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = []
  const pattern = /\*\*(.+?)\*\*|`(.+?)`/g
  let last = 0
  for (let match = pattern.exec(text); match != null; match = pattern.exec(text)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) })
    if (match[1] != null) parts.push({ text: match[1], strong: true })
    else parts.push({ text: match[2], code: true })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}
