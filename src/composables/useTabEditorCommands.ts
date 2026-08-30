import { handleEditorShortcutKey } from './tabEditorCommandHelpers'
import type { Ref } from 'vue'
import { useSongData } from './useSongData'
import type { TabSelection } from './useTabSelection'
import editorCore from '../services/editor/editorCore'
import type {
  SelectedNoteState,
  TabClipboardData,
  TabNoteData,
} from '../types/tab'

interface UseTabEditorCommandsOptions {
  currentSelection: Ref<TabSelection | null>
  selectedNote: Ref<SelectedNoteState | null>
  clearSelection: () => void
  toggleToolbar: () => void
  copySelection: () => void
  pasteSelection: () => TabClipboardData | null
}

export function useTabEditorCommands(options: UseTabEditorCommandsOptions) {
  const { setNote } = useSongData()

  function refreshSelectionState(): void {
    options.selectedNote.value = editorCore.getSelectedNoteState(options.currentSelection.value)
  }

  function setNoteAtCurrentSelection(fretNumber: number): void {
    const selection = options.currentSelection.value
    if (!selection) {
      return
    }

    const { trackId, voiceId, blockId, beatIndex, stringIndex } = selection
    setNote(trackId, blockId, voiceId, beatIndex, stringIndex, fretNumber)
    refreshSelectionState()
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!options.currentSelection.value) {
      return
    }

    const handled = handleEditorShortcutKey(event, {
      onDigit: (digit) => setNoteAtCurrentSelection(digit),
      onDelete: () => setNoteAtCurrentSelection(-1),
      onToggleToolbar: () => options.toggleToolbar(),
      onClearSelection: () => options.clearSelection(),
      onCopy: () => options.copySelection(),
      onPaste: () => options.pasteSelection(),
    })

    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return {
    handleKeyDown,
  }
}
