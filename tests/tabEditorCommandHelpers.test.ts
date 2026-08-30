import { describe, expect, it } from 'vitest'
import { applyNoteEffectToggle, handleEditorShortcutKey } from '../src/composables/tabEditorCommandHelpers'
import type { TabNoteData } from '../src/types/tab'

function createNote(overrides: Partial<TabNoteData> = {}): TabNoteData {
  return {
    fret: 5,
    string: 0,
    slide: false,
    tied: false,
    ...overrides,
  } as TabNoteData
}

describe('tabEditorCommandHelpers', () => {
  it('toggles known note effects', () => {
    const note = createNote({ ghost: false })

    expect(applyNoteEffectToggle(note, 'ghost')).toBe(true)
    expect(note.ghost).toBe(true)
  })

  it('handles keyboard shortcuts for editor commands', () => {
    const calls: string[] = []

    const handled = handleEditorShortcutKey({
      key: '3',
      metaKey: false,
      ctrlKey: false,
    } as KeyboardEvent, {
      onDigit: () => calls.push('digit'),
      onDelete: () => calls.push('delete'),
      onToggleToolbar: () => calls.push('toolbar'),
      onClearSelection: () => calls.push('clear'),
      onCopy: () => calls.push('copy'),
      onPaste: () => calls.push('paste'),
    })

    expect(handled).toBe(true)
    expect(calls).toEqual(['digit'])
  })
})
