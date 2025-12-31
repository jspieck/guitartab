import { ref, computed } from 'vue'
import Song from '../assets/js/songData'
import { tab } from '../assets/js/tab'

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

/**
 * Composable for managing tab selection state
 */
export function useTabSelection() {
  // Current selection
  const currentSelection = ref<TabSelection | null>(null)
  
  // Clipboard for copy/paste
  const clipboard = ref<any>(null)
  
  // Toolbar visibility
  const toolbarVisible = ref(false)
  
  // Selected note data (for toolbar display)
  const selectedNote = ref<any>(null)
  
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
    }
  }
  
  /**
   * Clear the current selection
   */
  function clearSelection() {
    setSelection(null)
    toolbarVisible.value = false
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
    hasSelection,
    setSelection,
    clearSelection,
    toggleToolbar,
    showToolbar,
    hideToolbar,
    copySelection,
    getSelection,
    durationToCode,
    codeToDuration,
    handleNoteSelectionEvent
  }
}
