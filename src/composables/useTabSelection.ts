import { ref, computed } from 'vue'
import { type SelectionChangeData } from '../utils/typedEventBus'
import { hasRegisteredSelectionSurface } from './useSelectionSurfaceState'
import { overlayHandler } from '../assets/js/overlayHandler'
import editorCore from '../services/editor/editorCore'
import { NAME_TO_CODE, DURATION_NAMES } from '../utils/musicUtils'
import type {
  SelectedNoteState,
  TabClipboardData,
  TabSelectionData,
} from '../types/tab'

export type TabSelection = TabSelectionData

const currentSelection = ref<TabSelection | null>(null)
const clipboard = ref<TabClipboardData | null>(null)
const toolbarVisible = ref(false)
const selectedNote = ref<SelectedNoteState | null>(null)

/**
 * Composable for managing tab selection state
 */
export function useTabSelection() {
  const hasSelection = computed(() => currentSelection.value !== null)
  
  function setSelection(selection: TabSelection | null) {
    currentSelection.value = selection
    if (selection) {
      editorCore.syncSelection(selection)
      selectedNote.value = editorCore.getSelectedNoteState(selection)

      if (hasRegisteredSelectionSurface()) {
        editorCore.syncSelectionEffects(selection)
      }
    } else {
      editorCore.syncSelection(null)
      selectedNote.value = null
    }
  }

  function clearSelection() {
    setSelection(null)
    toolbarVisible.value = false
  }
  
  function toggleToolbar() { toolbarVisible.value = !toolbarVisible.value }
  function showToolbar() { toolbarVisible.value = true }
  function hideToolbar() { toolbarVisible.value = false }
  
  function hasRangeSelection(): boolean {
    return overlayHandler.startPosOverlay != null && overlayHandler.endPosOverlay != null
  }

  function copySelection() {
    if (hasRangeSelection()) {
      overlayHandler.copyHandler()
      return
    }

    if (!currentSelection.value) return
    const { trackId, voiceId, blockId, beatIndex } = currentSelection.value
    const beat = editorCore.copyBeat(trackId, blockId, voiceId, beatIndex)
    if (!beat) return

    clipboard.value = {
      beat,
      position: { ...currentSelection.value },
    }
  }

  function pasteSelection(): TabClipboardData | null {
    if (hasRangeSelection()) {
      overlayHandler.pasteHandler()
      return clipboard.value
    }

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
    hasSelection,
    setSelection,
    clearSelection,
    toggleToolbar,
    showToolbar,
    hideToolbar,
    copySelection,
    pasteSelection,
    getSelection,
    durationToCode,
    codeToDuration,
    handleNoteSelectionEvent
  }
}
