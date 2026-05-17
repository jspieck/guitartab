import { ref, computed } from 'vue'
import { typedEventBus, type SelectionChangeData } from '../utils/typedEventBus'
import { hasRegisteredSelectionSurface } from './useSelectionSurfaceState'
import legacyEditorCore from '../services/legacy/editorCoreAdapter'
import { NAME_TO_CODE, DURATION_NAMES } from '../utils/musicUtils'
import type {
  SelectedNoteState,
  TabClipboardData,
  TabNoteData,
  TabSelectionData,
} from '../types/tab'

export type TabSelection = TabSelectionData

interface ContextMenuState {
  visible: boolean
  note: (TabNoteData & { duration?: string }) | null
  x: number
  y: number
}

const currentSelection = ref<TabSelection | null>(null)
const clipboard = ref<TabClipboardData | null>(null)
const toolbarVisible = ref(false)
const selectedNote = ref<SelectedNoteState | null>(null)

const contextMenuState = ref<ContextMenuState>({
  visible: false,
  note: null,
  x: 0,
  y: 0
})

typedEventBus.on('navigation.setClickedPos', (pos) => {
  const { setSelection } = useTabSelection()
  setSelection({
    trackId: pos.trackId,
    voiceId: pos.voiceId,
    blockId: pos.blockId,
    beatIndex: pos.beatId,
    stringIndex: pos.string
  })
})

/**
 * Composable for managing tab selection state
 */
export function useTabSelection() {
  const hasSelection = computed(() => currentSelection.value !== null)
  
  function setSelection(selection: TabSelection | null) {
    currentSelection.value = selection
    if (selection) {
      legacyEditorCore.syncSelection(selection)
      selectedNote.value = legacyEditorCore.getSelectedNoteState(selection)

      if (hasRegisteredSelectionSurface()) {
        legacyEditorCore.syncSelectionEffects(selection)
      }
    } else {
      legacyEditorCore.syncSelection(null)
      selectedNote.value = null
      contextMenuState.value.visible = false
    }
  }

  function showContextMenu(note: TabNoteData & { duration?: string }, x: number, y: number) {
    contextMenuState.value = { visible: true, note, x, y }
  }

  function hideContextMenu() {
    contextMenuState.value.visible = false
  }

  function clearSelection() {
    setSelection(null)
    toolbarVisible.value = false
    contextMenuState.value.visible = false
  }
  
  function toggleToolbar() { toolbarVisible.value = !toolbarVisible.value }
  function showToolbar() { toolbarVisible.value = true }
  function hideToolbar() { toolbarVisible.value = false }
  
  function copySelection() {
    if (!currentSelection.value) return
    const { trackId, voiceId, blockId, beatIndex } = currentSelection.value
    const beat = legacyEditorCore.copyBeat(trackId, blockId, voiceId, beatIndex)
    if (!beat) return

    clipboard.value = {
      beat,
      position: { ...currentSelection.value },
    }
  }

  function pasteSelection(): TabClipboardData | null {
    if (!clipboard.value || !currentSelection.value) return null
    return clipboard.value
  }

  function getSelection(): TabSelection | null {
    return currentSelection.value
  }
  
  function durationToCode(duration: string): string {
    return NAME_TO_CODE[duration as keyof typeof NAME_TO_CODE] ?? 'q'
  }

  function codeToDuration(code: string): string {
    return DURATION_NAMES[code as keyof typeof DURATION_NAMES] ?? 'quarter'
  }
  
  function handleNoteSelectionEvent(detail: SelectionChangeData | null) {
    if (detail) {
      setSelection({
        trackId: detail.trackId,
        voiceId: detail.voiceId,
        blockId: detail.blockId,
        beatIndex: detail.beatIndex,
        stringIndex: detail.stringIndex
      })
    } else {
      setSelection(null)
    }
  }
  
  return {
    currentSelection,
    selectedNote,
    clipboard,
    toolbarVisible,
    contextMenuState,
    hasSelection,
    setSelection,
    clearSelection,
    toggleToolbar,
    showToolbar,
    hideToolbar,
    showContextMenu,
    hideContextMenu,
    copySelection,
    pasteSelection,
    getSelection,
    durationToCode,
    codeToDuration,
    handleNoteSelectionEvent
  }
}
