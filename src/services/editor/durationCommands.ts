import { notifySongDataChanged } from '../appEvents'
import Settings from '../../stores/settingsState'
import Song from '../../stores/song'
import type { BeatDuration } from '../../types/tab'
import Duration from '../../utils/duration'
import { startRange } from './rangeSelection'
import { recordBarEdit } from './editCommands'
import { classicalNotation } from '../notation/classicalNotationAdapter'

export interface TabDurationHost {
  isNotePlaceable(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
    string: number,
    newDuration: number,
    previousDuration: number,
  ): boolean
  changeBeatDuration(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
    string: number,
    newDuration: number,
    previousDuration: number,
    noteLength: BeatDuration,
  ): { applied: boolean; rescale: boolean }
  trackRerenderNecessary(trackId: number, blockId: number, voiceId: number): boolean
  drawTrack(trackId: number, voiceId: number, forceScale: boolean, callback: (() => void) | null): void
}

export function changeNoteDuration(
  tabInstance: TabDurationHost,
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  noteLength: BeatDuration,
  withoutUndo = false,
): boolean {
  const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
  const previousDuration = Duration.getDurationOfNote(beat, true)
  const previousDur = beat.duration
  beat.duration = noteLength
  const newDuration = Duration.getDurationOfNote(beat, true)
  beat.duration = previousDur

  if (
    !tabInstance.isNotePlaceable(trackId, blockId, voiceId, beatId, string, newDuration, previousDuration)
  ) {
    return false
  }

  startRange(trackId, blockId, voiceId, beatId)

  // Returning false makes recordBarEdit roll back: only when the length did not fit.
  const change = () =>
    tabInstance.changeBeatDuration(
      trackId,
      blockId,
      voiceId,
      beatId,
      string,
      newDuration,
      previousDuration,
      noteLength,
    ).applied
  if (withoutUndo) {
    change()
  } else {
    recordBarEdit('Note length', { trackId, blockIds: [blockId] }, change)
  }

  if (tabInstance.trackRerenderNecessary(trackId, blockId, voiceId)) {
    tabInstance.drawTrack(trackId, voiceId, true, null)
  } else {
    notifySongDataChanged()

    if (Settings.vexFlowIsActive) {
      classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId)
    }
  }

  return true
}
