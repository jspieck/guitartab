import type { Ref } from 'vue'
import { useDurationHandler } from './useDurationHandler'
import { useSongData } from './useSongData'
import type { ContextMenuState, TabSelection } from './useTabSelection'
import legacyEditorCore from '../services/legacy/editorCoreAdapter'
import type {
  SelectedNoteState,
  TabClipboardData,
  TabBeat,
  TabNoteData,
} from '../types/tab'

interface UseTabEditorCommandsOptions {
  currentSelection: Ref<TabSelection | null>
  selectedNote: Ref<SelectedNoteState | null>
  contextMenuState: Ref<ContextMenuState>
  clearSelection: () => void
  toggleToolbar: () => void
  hideContextMenu: () => void
  copySelection: () => void
  pasteSelection: () => TabClipboardData | null
}

export function useTabEditorCommands(options: UseTabEditorCommandsOptions) {
  const { setNote } = useSongData()
  const { changeDuration } = useDurationHandler()

  function getCurrentSelectionNote(): TabNoteData | null {
    const selection = options.currentSelection.value
    if (!selection) {
      return null
    }

    const { trackId, voiceId, blockId, beatIndex, stringIndex } = selection
    return legacyEditorCore.getNote(trackId, blockId, voiceId, beatIndex, stringIndex) as TabNoteData | null | undefined ?? null
  }

  function refreshSelectionState(): void {
    options.selectedNote.value = legacyEditorCore.getSelectedNoteState(options.currentSelection.value)

    if (!options.contextMenuState.value.visible) {
      return
    }

    const selection = options.currentSelection.value
    if (!selection) {
      options.hideContextMenu()
      return
    }

    const note = getCurrentSelectionNote()
    const { trackId, voiceId, blockId, beatIndex } = selection
    const beat = legacyEditorCore.getBeat(trackId, blockId, voiceId, beatIndex) as TabBeat | undefined

    if (!note) {
      options.hideContextMenu()
      return
    }

    options.contextMenuState.value.note = {
      ...note,
      duration: beat?.duration || 'q',
    }
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
    if (event.key >= '0' && event.key <= '9' && options.currentSelection.value) {
      setNoteAtCurrentSelection(Number.parseInt(event.key, 10))
      event.preventDefault()
      event.stopPropagation()
      return
    }

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        if (options.currentSelection.value) {
          setNoteAtCurrentSelection(-1)
          event.preventDefault()
          event.stopPropagation()
        }
        break
      case 't':
      case 'T':
        options.toggleToolbar()
        event.preventDefault()
        break
      case 'Escape':
        options.clearSelection()
        break
    }
  }

  function handleToggleEffect(effectId: string): void {
    const note = getCurrentSelectionNote()
    if (!note) {
      return
    }

    if (effectId === 'bend') {
      note.bendPresent = !note.bendPresent
      if (note.bendPresent && (!note.bendObj || note.bendObj.length === 0)) {
        note.bendObj = [
          { bendPosition: 0, bendValue: 0, vibrato: 0 },
          { bendPosition: 60, bendValue: 4, vibrato: 0 },
        ]
      }
    } else if (effectId === 'trill') {
      note.trillPresent = !note.trillPresent
      if (note.trillPresent && !note.trill) {
        note.trill = { fret: note.fret + 1, period: 4 }
      }
    } else if (effectId === 'ghost') {
      note.ghost = !note.ghost
    } else if (effectId === 'dead') {
      note.dead = !note.dead
    } else if (effectId === 'vibrato') {
      note.vibrato = !note.vibrato
    } else if (effectId === 'slide') {
      note.slide = !note.slide
    } else if (effectId === 'pullDown') {
      note.pullDown = !note.pullDown
    } else if (effectId === 'palmMute') {
      note.palmMute = !note.palmMute
    } else if (effectId === 'stacatto') {
      note.stacatto = !note.stacatto
    }

    legacyEditorCore.notifySongDataChanged()
    refreshSelectionState()
  }

  function handleContextMenuSetDuration(durationId: string): void {
    const selection = options.currentSelection.value
    if (!selection) {
      return
    }

    const { trackId, voiceId, blockId, beatIndex, stringIndex } = selection
    if (changeDuration(trackId, blockId, voiceId, beatIndex, stringIndex, durationId)) {
      refreshSelectionState()
    }
  }

  function handleDeleteNote(): void {
    if (!options.currentSelection.value) {
      return
    }

    setNoteAtCurrentSelection(-1)
    options.hideContextMenu()
  }

  function handleCopyNote(): void {
    if (!options.contextMenuState.value.note) {
      return
    }

    options.copySelection()
    options.hideContextMenu()
  }

  function handlePasteNote(): void {
    const clipboardData = options.pasteSelection()
    const selection = options.currentSelection.value
    if (!clipboardData || !selection) {
      return
    }

    const sourceStringIndex = clipboardData.position.stringIndex
    const sourceNote = clipboardData.beat.notes.find(
      (note): note is TabNoteData => note?.string === sourceStringIndex,
    )

    if (sourceNote) {
      setNoteAtCurrentSelection(sourceNote.fret)
    }

    options.hideContextMenu()
  }

  function handleGlobalClick(event: MouseEvent): void {
    if (!options.contextMenuState.value.visible) {
      return
    }

    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.note-context-menu') || target?.closest('.string-click-area')) {
      return
    }

    options.hideContextMenu()
  }

  return {
    handleKeyDown,
    handleToggleEffect,
    handleContextMenuSetDuration,
    handleDeleteNote,
    handleCopyNote,
    handlePasteNote,
    handleGlobalClick,
  }
}