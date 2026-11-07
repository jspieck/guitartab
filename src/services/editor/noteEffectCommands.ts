import Song from '../../stores/song'
import { toggleDialog } from '../dialogs/dialogs'
import { classicalNotation } from '../notation/classicalNotationAdapter'
import { resolveNoteEffectModalRequest, type NoteEffectSelection } from '../menuMutationRouting'
import { notesInRange } from './rangeSelection'
import { isEffectSet, toggleNoteEffect } from './effectToggles'
import { recordBarEdit } from './editCommands'
import { requestBlockRender } from './renderCommands'
import { processDynamicSelect } from './dynamicsCommands'

/**
 * Toolbar and note-menu effects on the selected notes (the range, or the note at the cursor).
 * Effects with settings open their dialog; the others toggle in one undo step.
 */
export function processEffectSelect(selection: NoteEffectSelection, id: string): void {
  // On only when every selected note has it already: a mixed selection gets it everywhere.
  const isVariableSet =
    selection.notes.length > 0 &&
    selection.notes.every(({ trackId, blockId, voiceId, beatId, string }) => {
      const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
      return isEffectSet(beat, beat.notes[string], id)
    })

  const modalRequest = resolveNoteEffectModalRequest(id, isVariableSet, false, selection)
  if (modalRequest != null) {
    void toggleDialog(modalRequest.modal, modalRequest.params)
    return
  }
  if (selection.notes.length === 0) return

  const { trackId, voiceId } = selection.notes[0]
  const blockIds = [...selection.blocks, ...selection.notes.map((note) => note.blockId)]
  recordBarEdit(effectLabel(id), { trackId, blockIds }, () => {
    toggleNoteEffect(selection.notes, id, isVariableSet)
  })
  if (id === 'grace') {
    classicalNotation.computeVexFlowDataStructures(trackId, voiceId)
  }
  for (const blockId of selection.blocks) {
    requestBlockRender(trackId, blockId, voiceId)
  }
}

export function noteEffectSelect(id: string): void {
  const selection = notesInRange()
  if (selection != null) processEffectSelect(selection, id)
}

export function dynamicSelect(id: string): void {
  const selection = notesInRange()
  if (selection != null) processDynamicSelect(selection, id, false)
}

/** "palmMute" -> "Palm mute", for the undo label. */
function effectLabel(id: string): string {
  const words = id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
