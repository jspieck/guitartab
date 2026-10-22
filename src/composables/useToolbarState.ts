import { computed, watch, type Ref } from 'vue'
import { rangeHasNotes as rangeContainsNotes } from '../services/editor/rangeSelection'
import editorCore from '../services/editor/editorCore'
import { selectionState } from '../stores/selectionState'
import { songDataVersion } from '../stores/songState'
import { deriveMenuSelectionState, MENU_NOTE_EFFECT_BUTTON_IDS } from '../utils/menuUiState'
import { noteLengthOf } from '../utils/durationUtils'
import { noteInputState } from '../stores/noteInputState'

/**
 * Toolbar state (pressed/disabled buttons, tuplet choices, the note a tie
 * would connect to) derived from the cursor, the range selection and the song.
 * Replaces the `menu.activateEffects*` events that re-synced it by hand.
 */
export function useToolbarState(selectedTuplet: Ref<string>) {
  const derived = computed(() => {
    // Song data is reactive; the version covers the few legacy writes that bypass the proxy.
    void songDataVersion.value
    const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
    const beat = editorCore.getBeat(trackId, blockId, voiceId, beatId)
    const measureMeta = editorCore.getMeasureMeta(blockId)
    if (!beat || !measureMeta) {
      return null
    }
    const note = editorCore.getNote(trackId, blockId, voiceId, beatId, string) ?? null
    const noteTiedTo = note?.tied
      ? note.tiedTo
      : editorCore.findPreviousNoteOnString(trackId, blockId, voiceId, beatId, string)
    const hasRange = selectionState.rangeStart != null && selectionState.rangeEnd != null
    const rangeHasNotes = hasRange && rangeContainsNotes()
    const state = deriveMenuSelectionState(beat, note, measureMeta, {
      canTie: note?.tied === true || noteTiedTo != null,
      hasOverlaySelection: rangeHasNotes,
    })
    const disabled = new Set(state.disabledButtonIds)
    // A range without notes: note effects have nothing to act on.
    if (hasRange && !rangeHasNotes) {
      MENU_NOTE_EFFECT_BUTTON_IDS.forEach((id) => disabled.add(id))
    }
    return {
      pressed: new Set(state.pressedButtonIds),
      disabled,
      availableTuplets: state.availableTuplets,
      selectedTuplet: state.selectedTuplet,
      noteTiedTo,
      noteLength: noteLengthOf(beat.duration),
    }
  })

  // The tuplet select is user-editable; reset it when the beat under the cursor changes.
  watch(
    () => derived.value?.selectedTuplet,
    (tuplet) => {
      if (tuplet != null) selectedTuplet.value = tuplet
    },
    { immediate: true },
  )
  // Legacy note entry reads the length to use for new notes from here.
  watch(
    () => derived.value?.noteLength,
    (noteLength) => {
      if (noteLength != null) noteInputState.noteLength = noteLength
    },
    { immediate: true },
  )

  return {
    isPressed: (id: string) => derived.value?.pressed.has(id) ?? id === '8thNote',
    isDisabled: (id: string) => derived.value?.disabled.has(id) ?? false,
    availableTuplets: computed(() => derived.value?.availableTuplets ?? []),
    noteTiedTo: computed(() => derived.value?.noteTiedTo ?? null),
  }
}
