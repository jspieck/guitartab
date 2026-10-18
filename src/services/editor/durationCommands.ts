import { notifySongDataChanged } from '../appEvents'
import Settings from '../../assets/js/settingManager'
import Song from '../../assets/js/songData'
import Duration from '../../assets/js/duration'
import { overlayHandler } from '../../assets/js/overlayHandler'
import { menuHandler } from '../../assets/js/menuHandler'
import { revertHandler } from '../../assets/js/revertHandler'
import { classicalNotation } from './classicalNotationAdapter'

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
    noteLength: string,
  ): void
  trackRerenderNecessary(trackId: number, blockId: number, voiceId: number): boolean
  drawTrack(
    trackId: number,
    voiceId: number,
    forceScale: boolean,
    callback: (() => void) | null,
  ): void
}

export function changeNoteDuration(
  tabInstance: TabDurationHost,
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  noteLength: string,
  duringRevert: boolean,
): boolean {
  const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
  const previousDuration = Duration.getDurationOfNote(beat, true)
  const previousDur = beat.duration
  beat.duration = noteLength
  const newDuration = Duration.getDurationOfNote(beat, true)
  beat.duration = previousDur

  if (!tabInstance.isNotePlaceable(
    trackId, blockId, voiceId, beatId, string, newDuration, previousDuration,
  )) {
    return false
  }

  const measureBefore = JSON.parse(JSON.stringify(Song.measures[trackId][blockId][voiceId]))
  overlayHandler.initOverlay(trackId, blockId, voiceId, beatId)

  tabInstance.changeBeatDuration(
    trackId, blockId, voiceId, beatId, string, newDuration, previousDuration, noteLength,
  )
  menuHandler.showAvailableTupletSizes(newDuration)

  if (tabInstance.trackRerenderNecessary(trackId, blockId, voiceId)) {
    tabInstance.drawTrack(trackId, voiceId, true, null)
  } else {
    notifySongDataChanged()

    if (Settings.vexFlowIsActive) {
      classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId)
    }
  }

  if (duringRevert === false) {
    const measureAfter = JSON.parse(JSON.stringify(Song.measures[trackId][blockId][voiceId]))
    revertHandler.addNoteLengthChange(trackId, blockId, voiceId, measureBefore, measureAfter)
  }

  return true
}
