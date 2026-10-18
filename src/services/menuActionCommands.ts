import AppManager from '../assets/js/appManager'
import { typedEventBus } from '../utils/typedEventBus'
import { tab } from '../assets/js/tab'
import type { NoteLengthCode } from '../types/tab'

export function applyNoteLengthSelection(noteLength: NoteLengthCode): boolean {
  if (AppManager.duringTrackCreation || tab.markedNoteObj == null) {
    return false
  }

  const { trackId, blockId, voiceId, beatId, string } = tab.markedNoteObj

  if (!tab.changeNoteDuration(trackId, blockId, voiceId, beatId, string, noteLength, false)) {
    return false
  }

  AppManager.typeOfNote = noteLength
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
  return true
}
