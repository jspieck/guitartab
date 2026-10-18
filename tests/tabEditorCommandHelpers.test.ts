import { describe, expect, it, vi } from 'vitest'
import { applyNoteEffectToggle, handleEditorShortcutKey } from '../src/composables/tabEditorCommandHelpers'
import type { TabNoteData } from '../src/types/tab'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)
vi.mock('../src/assets/js/playbackEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.playbackModule),
)
vi.mock('../src/assets/js/midiReceiver', () =>
  import('./helpers/legacyMocks').then((m) => m.midiReceiverModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

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

  it('clears the selection on Escape and leaves other keys to the shortcut table', () => {
    const calls: string[] = []
    const handlers = { onClearSelection: () => calls.push('clear') }

    expect(handleEditorShortcutKey({ key: 'Escape' } as KeyboardEvent, handlers)).toBe(true)
    expect(handleEditorShortcutKey({ key: '3' } as KeyboardEvent, handlers)).toBe(false)
    expect(calls).toEqual(['clear'])
  })
})
