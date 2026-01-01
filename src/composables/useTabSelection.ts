import { ref, computed, onMounted, onUnmounted } from 'vue'
import Song from '../assets/js/songData'
import { tab } from '../assets/js/tab'
import { typedEventBus } from '../utils/typedEventBus'

/**
 * Selection position in the tab
 */
export interface TabSelection {
  trackId: number
  voiceId: number
  blockId: number
  beatIndex: number
  stringIndex: number
}

/**
 * Duration name mapping (long names to short codes)
 */
const DURATION_TO_CODE: Record<string, string> = {
  'whole': 'w',
  'half': 'h',
  'quarter': 'q',
  'eighth': 'e',
  'sixteenth': 's',
  'thirty-second': 't'
}

/**
 * Duration code mapping (short codes to long names)
 */
const CODE_TO_DURATION: Record<string, string> = {
  'w': 'whole', 'wr': 'whole',
  'h': 'half', 'hr': 'half',
  'q': 'quarter', 'qr': 'quarter',
  'e': 'eighth', 'er': 'eighth',
  's': 'sixteenth', 'sr': 'sixteenth',
  't': 'thirty-second', 'tr': 'thirty-second'
}

// SINGLETON STATE - shared across all components using this composable
// This ensures all components see the same selection state
const currentSelection = ref<TabSelection | null>(null)
const clipboard = ref<any>(null)
const toolbarVisible = ref(false)
const selectedNote = ref<any>(null)

// Context Menu State
const contextMenuState = ref({
  visible: false,
  note: null as any,
  x: 0,
  y: 0
})

let isInitialized = false

/**
 * Composable for managing tab selection state
 * 
 * NOTE: This uses singleton state - all components share the same selection
 */
export function useTabSelection() {
  /**
   * Check if there's an active selection
   */
  const hasSelection = computed(() => currentSelection.value !== null)
  
  /**
   * Set the current selection
   */
  function setSelection(selection: TabSelection | null) {
    currentSelection.value = selection
    
    if (selection) {
      const { trackId, voiceId, blockId, beatIndex, stringIndex } = selection
      
      // CRITICAL: Sync with tab.markedNoteObj so menu operations work correctly
      tab.markedNoteObj = {
        trackId,
        voiceId,
        blockId,
        beatId: beatIndex,
        string: stringIndex
      }
      // Mark that user has explicitly clicked to select a position
      tab.hasExplicitSelection = true
      
      // Update selected note data for toolbar
      const beat = Song.measures?.[trackId]?.[blockId]?.[voiceId]?.[beatIndex]
      const note = beat?.notes?.[stringIndex]
      
      // Get duration in long format
      const rawDuration = beat?.duration || 'q'
      const cleanDuration = rawDuration.replace('r', '')
      const longDuration = CODE_TO_DURATION[cleanDuration] || 'quarter'
      
      selectedNote.value = {
        ...(note || {}),
        duration: longDuration,
        isEmpty: !note
      }
    } else {
      selectedNote.value = null
      // Also hide context menu when selection is cleared
      contextMenuState.value.visible = false
    }
  }

  /**
   * Show the note context menu
   */
  function showContextMenu(note: any, x: number, y: number) {
    contextMenuState.value = {
      visible: true,
      note,
      x,
      y
    }
  }

  /**
   * Hide the note context menu
   */
  function hideContextMenu() {
    contextMenuState.value.visible = false
  }

  // Initialize global event listeners once
  if (!isInitialized) {
    typedEventBus.on('navigation.setClickedPos', (pos) => {
      setSelection({
        trackId: pos.trackId,
        voiceId: pos.voiceId,
        blockId: pos.blockId,
        beatIndex: pos.beatId,
        stringIndex: pos.string
      })
    })
    isInitialized = true
  }
  
  /**
   * Clear the current selection
   */
  function clearSelection() {
    setSelection(null)
    toolbarVisible.value = false
    contextMenuState.value.visible = false
    // Clear explicit selection flag to prevent accidental note entry
    tab.hasExplicitSelection = false
  }
  
  /**
   * Toggle toolbar visibility
   */
  function toggleToolbar() {
    toolbarVisible.value = !toolbarVisible.value
  }
  
  /**
   * Show toolbar
   */
  function showToolbar() {
    toolbarVisible.value = true
  }
  
  /**
   * Hide toolbar
   */
  function hideToolbar() {
    toolbarVisible.value = false
  }
  
  /**
   * Copy current selection to clipboard
   */
  function copySelection() {
    if (!currentSelection.value) {
      return
    }
    
    const { trackId, voiceId, blockId, beatIndex, stringIndex } = currentSelection.value
    const beat = Song.measures?.[trackId]?.[blockId]?.[voiceId]?.[beatIndex]
    
    clipboard.value = {
      beat: JSON.parse(JSON.stringify(beat)),
      position: { ...currentSelection.value }
    }
  }

  /**
   * Paste from clipboard to current selection
   */
  function pasteSelection() {
    if (!clipboard.value || !currentSelection.value) {
      return null
    }
    return clipboard.value
  }
  
  /**
   * Get the current selection
   */
  function getSelection(): TabSelection | null {
    return currentSelection.value
  }
  
  /**
   * Convert duration name to code
   */
  function durationToCode(duration: string): string {
    return DURATION_TO_CODE[duration] || 'q'
  }
  
  /**
   * Convert duration code to name
   */
  function codeToDuration(code: string): string {
    return CODE_TO_DURATION[code] || 'quarter'
  }
  
  /**
   * Handle note selection event
   */
  function handleNoteSelectionEvent(event: Event) {
    const detail = (event as CustomEvent).detail
    
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
