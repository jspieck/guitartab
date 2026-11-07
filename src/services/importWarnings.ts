/**
 * What an import had to leave out or change. Readers call `warnImport` while they parse;
 * `importSongBytes` collects the counts around one import, and the user sees them in one
 * banner after loading (audit Big win 23: an import that drops something must say so).
 */

export type ImportWarningKind = 'unplacedNotes' | 'extraVoiceNotes' | 'overlappingNotes'

// [one, several]: the count goes in front.
const WARNING_TEXT: Record<ImportWarningKind, [string, string]> = {
  unplacedNotes: ['note that fits on no string', 'notes that fit on no string'],
  extraVoiceNotes: ['note in a third or fourth voice', 'notes in third or fourth voices'],
  overlappingNotes: ['note overlapping another in its voice', 'notes overlapping others in their voice'],
}

let current: Map<ImportWarningKind, number> | null = null

/** Counts something the importer running now left out; does nothing outside an import. */
export function warnImport(kind: ImportWarningKind, count = 1): void {
  if (current == null || count <= 0) return
  current.set(kind, (current.get(kind) ?? 0) + count)
}

/** Runs one import and returns what its readers warned about, as short phrases ("3 notes …"). */
export function collectImportWarnings(run: () => void): string[] {
  const outer = current
  const counts = new Map<ImportWarningKind, number>()
  current = counts
  try {
    run()
  } finally {
    current = outer
  }
  return [...counts].map(([kind, count]) => `${count} ${WARNING_TEXT[kind][count === 1 ? 0 : 1]}`)
}

/** The banner text for a finished import's warnings. */
export function describeImportWarnings(warnings: string[]): string {
  const list =
    warnings.length > 1
      ? `${warnings.slice(0, -1).join(', ')} and ${warnings[warnings.length - 1]}`
      : warnings[0]
  return `Opened, but left out ${list}.`
}
