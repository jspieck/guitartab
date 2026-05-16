import { ref, computed } from 'vue'
import Song from '../assets/js/songData'
import { tab } from '../assets/js/tab'
import { typedEventBus, type SelectionChangeData } from '../utils/typedEventBus'
import { NAME_TO_CODE, DURATION_NAMES } from '../utils/musicUtils'
import type {
  SelectedNoteState,
  TabBeat,
  TabClipboardData,
  TabNoteData,
  TabSelectionData,
} from '../types/tab'

export type TabSelection = TabSelectionData

interface ContextMenuState {
  visible: boolean
  note: TabNoteData | null
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
      const { trackId, voiceId, blockId, beatIndex, stringIndex } = selection
      tab.markedNoteObj = { trackId, voiceId, blockId, beatId: beatIndex, string: stringIndex }
      tab.hasExplicitSelection = true
      const beat = Song.measures?.[trackId]?.[blockId]?.[voiceId]?.[beatIndex]
      const note = beat?.notes?.[stringIndex] as TabNoteData | null | undefined
      const rawDuration = beat?.duration || 'q'
      const cleanDuration = rawDuration.replace('r', '')
      const longDuration = DURATION_NAMES[cleanDuration as keyof typeof DURATION_NAMES] || 'quarter'
      selectedNote.value = { ...(note || {}), duration: longDuration, isEmpty: !note }
    } else {
      selectedNote.value = null
      contextMenuState.value.visible = false
    }
  }

  function showContextMenu(note: TabNoteData, x: number, y: number) {
    contextMenuState.value = { visible: true, note, x, y }
  }

  function hideContextMenu() {
    contextMenuState.value.visible = false
  }

  function clearSelection() {
    setSelection(null)
    toolbarVisible.value = false
    contextMenuState.value.visible = false
    tab.hasExplicitSelection = false
  }
  
  function toggleToolbar() { toolbarVisible.value = !toolbarVisible.value }
  function showToolbar() { toolbarVisible.value = true }
  function hideToolbar() { toolbarVisible.value = false }
  
  function copySelection() {
    if (!currentSelection.value) return
    const { trackId, voiceId, blockId, beatIndex } = currentSelection.value
    const beat = Song.measures?.[trackId]?.[blockId]?.[voiceId]?.[beatIndex] as TabBeat | undefined
    if (!beat) return

    clipboard.value = {
      beat: JSON.parse(JSON.stringify(beat)) as TabBeat,
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
  
  function handleNoteSelectionEvent(event: Event | CustomEvent<SelectionChangeData | null>) {
    const detail = (event as CustomEvent<SelectionChangeData | null>).detail
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
