import { changeNoteDuration } from './editor/durationCommands'
import { tabDurationHost } from './editor/durationEditing'
import { selectionState } from '../stores/selectionState'
import type { NoteLengthCode } from '../types/tab'
import { noteInputState } from '../stores/noteInputState'

export function applyNoteLengthSelection(noteLength: NoteLengthCode): boolean {
  const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor

  if (!changeNoteDuration(tabDurationHost, trackId, blockId, voiceId, beatId, string, noteLength)) {
    return false
  }

  noteInputState.noteLength = noteLength
  return true
}
