import { selectionState } from '../stores/selectionState'
import AppManager from '../assets/js/appManager'
import { tab } from '../assets/js/tab'
import type { NoteLengthCode } from '../types/tab'
import { noteInputState } from '../stores/noteInputState'

export function applyNoteLengthSelection(noteLength: NoteLengthCode): boolean {
  if (AppManager.duringTrackCreation) {
    return false
  }

  const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor

  if (!tab.changeNoteDuration(trackId, blockId, voiceId, beatId, string, noteLength, false)) {
    return false
  }

  noteInputState.noteLength = noteLength
  return true
}
