import type { TabNoteData } from '../types/tab'
import { handleUndoRedoShortcut } from '../utils/undoRedoShortcuts'

type NoteEffectHandler = (note: TabNoteData) => void

function toggleBendEffect(note: TabNoteData): void {
  note.bendPresent = !note.bendPresent
  if (note.bendPresent && (!note.bendObj || note.bendObj.length === 0)) {
    note.bendObj = [
      { bendPosition: 0, bendValue: 0, vibrato: 0 },
      { bendPosition: 60, bendValue: 4, vibrato: 0 },
    ]
  }
}

function toggleTrillEffect(note: TabNoteData): void {
  note.trillPresent = !note.trillPresent
  if (note.trillPresent && !note.trill) {
    note.trill = { fret: note.fret + 1, period: 4 }
  }
}

function toggleBooleanEffect(note: TabNoteData, key: keyof TabNoteData): void {
  note[key] = !note[key] as never
}

export const NOTE_EFFECT_HANDLERS: Record<string, NoteEffectHandler> = {
  bend: toggleBendEffect,
  trill: toggleTrillEffect,
  ghost: (note) => toggleBooleanEffect(note, 'ghost'),
  dead: (note) => toggleBooleanEffect(note, 'dead'),
  vibrato: (note) => toggleBooleanEffect(note, 'vibrato'),
  slide: (note) => toggleBooleanEffect(note, 'slide'),
  pullDown: (note) => toggleBooleanEffect(note, 'pullDown'),
  palmMute: (note) => toggleBooleanEffect(note, 'palmMute'),
  stacatto: (note) => toggleBooleanEffect(note, 'stacatto'),
}

export function applyNoteEffectToggle(note: TabNoteData, effectId: string): boolean {
  const handler = NOTE_EFFECT_HANDLERS[effectId]
  if (!handler) {
    return false
  }

  handler(note)
  return true
}

export function handleEditorShortcutKey(
  event: KeyboardEvent,
  handlers: {
    onDigit: (digit: number) => void
    onDelete: () => void
    onToggleToolbar: () => void
    onClearSelection: () => void
    onCopy: () => void
    onPaste: () => void
  },
): boolean {
  if (handleUndoRedoShortcut(event)) {
    return true
  }

  if (event.key >= '0' && event.key <= '9') {
    handlers.onDigit(Number.parseInt(event.key, 10))
    return true
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    handlers.onDelete()
    return true
  }

  if (event.key === 't' || event.key === 'T') {
    handlers.onToggleToolbar()
    return true
  }

  if (event.key === 'Escape') {
    handlers.onClearSelection()
    return true
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
    handlers.onCopy()
    return true
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
    handlers.onPaste()
    return true
  }

  return false
}
