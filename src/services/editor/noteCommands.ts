import Song, { type Beat } from '../../assets/js/songData'
import Settings from '../../stores/settingsState'
import { recordBarEdit } from './editCommands'
import { classicalNotation } from './classicalNotationAdapter'
import type { BeatDuration } from '../../types/tab'
import { restOf } from '../../utils/durationUtils'

export function addNoteToBlock(
  trackId: number,
  blockId: number,
  voiceId: number,
  newBeatId: number,
  duration: BeatDuration,
  isTuplet: boolean,
  beat: Beat,
  dotted: boolean,
  doubleDotted: boolean,
): void {
  const blockObj = Song.measures[trackId][blockId][voiceId]
  Song.setBeat(trackId, blockId, voiceId, newBeatId, duration)
  blockObj[newBeatId].dotted = dotted
  blockObj[newBeatId].doubleDotted = doubleDotted
  if (isTuplet) {
    blockObj[newBeatId].tuplet = beat.tuplet
    blockObj[newBeatId].tupletId = beat.tupletId
  }
}

export function tupletOnlyRests(
  startBeatId: number,
  blockObj: { tuplet: number | null; duration: BeatDuration }[],
): { lastIndex: number; onlyRests: boolean } {
  let lastIndex = startBeatId
  let onlyRests = true
  for (let x = startBeatId; x < blockObj.length; x += 1) {
    if (blockObj[x].tuplet == null) {
      break
    }
    if (blockObj[x].duration.length === 1) {
      onlyRests = false
    }
    lastIndex += 1
  }
  return { lastIndex: lastIndex - 1, onlyRests }
}

/** Removes a note (and the notes tied to it); records an undo step unless `withoutUndo`. */
export function deleteNote(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  withoutUndo = false,
): void {
  const remove = () => {
    const beatObj = Song.findBeat({ trackId, blockId, voiceId, beatId })
    if (beatObj == null || beatObj.notes.length === 0) {
      return
    }

    if (beatObj.notes[string] != null) {
      beatObj.notes[string] = null
    }

    let currentBlockId = blockId
    let currentBeatId = beatId
    if (currentBeatId + 1 >= Song.measures[trackId][currentBlockId][voiceId].length) {
      currentBlockId += 1
      currentBeatId = 0
    } else {
      currentBeatId += 1
    }

    if (currentBlockId < Song.measures[trackId].length) {
      const note = Song.getBeat({ trackId, blockId: currentBlockId, voiceId, beatId: currentBeatId }).notes[
        string
      ]
      if (note != null && note.tied) {
        deleteNote(trackId, currentBlockId, voiceId, currentBeatId, string, withoutUndo)
      }
    }

    let noteSet = false
    for (let i = 0; i < Song.tracks[trackId].numStrings; i += 1) {
      if (beatObj.notes[i] != null) {
        noteSet = true
        break
      }
    }

    if (!noteSet) {
      beatObj.effects = Song.defaultMeasureEffects()
      beatObj.duration = restOf(beatObj.duration)
      beatObj.notes = []
    }

    if (Settings.vexFlowIsActive && trackId === Song.currentTrackId && voiceId === Song.currentVoiceId) {
      classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId)
    }
  }
  if (withoutUndo) {
    remove()
  } else {
    recordBarEdit('Delete note', { trackId, blockIds: [blockId] }, remove)
  }
}
