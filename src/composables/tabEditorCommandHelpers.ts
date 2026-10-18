import type { TabNoteData } from '../types/tab'

type NoteEffectHandler = (note: TabNoteData) => void

function toggleBendEffect(note: TabNoteData): void {
  if (note.bendObj != null) {
    delete note.bendObj
  } else {
    note.bendObj = [
      { bendPosition: 0, bendValue: 0, vibrato: 0 },
      { bendPosition: 60, bendValue: 4, vibrato: 0 },
    ]
  }
}

function toggleTrillEffect(note: TabNoteData): void {
  if (note.trill != null) {
    delete note.trill
  } else {
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

/**
 * Keys the tab view handles itself. Every other shortcut is dispatched from the
 * shortcut table (`utils/keyboardShortcuts.ts`) by the document-level key handler.
 */
export function handleEditorShortcutKey(
  event: KeyboardEvent,
  handlers: {
    onClearSelection: () => void
  },
): boolean {
  if (event.key === 'Escape') {
    handlers.onClearSelection()
    return true
  }

  return false
}
