import Song, { type Measure } from '../../assets/js/songData'
import Settings from '../../assets/js/settingManager'
import { revertHandler } from '../../assets/js/revertHandler'
import { sequencerHandler } from '../../assets/js/sequencerHandler'
import { classicalNotation } from './classicalNotationAdapter'

export function addNoteToBlock(
  trackId: number,
  blockId: number,
  voiceId: number,
  newBeatId: number,
  duration: string,
  isTuplet: boolean,
  beat: Measure,
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
  blockObj: { tuplet: number | null, duration: string }[],
): { lastIndex: number, onlyRests: boolean } {
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

export function deleteNote(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  calledDuringRestore: boolean,
): void {
  const beatObj = Song.measures[trackId][blockId][voiceId][beatId]
  if (beatObj == null || beatObj.notes.length === 0) {
    return
  }

  if (beatObj.notes[string] != null) {
    if (calledDuringRestore == null) {
      const clonedNote = JSON.parse(JSON.stringify(beatObj.notes[string]))
      const clonedEffect = JSON.parse(JSON.stringify(beatObj.effects))
      revertHandler.deleteNote(
        trackId, blockId, voiceId, beatId, string, clonedNote, clonedEffect,
      )
    }
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
    const note = Song.measures[trackId][currentBlockId][voiceId][currentBeatId].notes[string]
    if (note != null && note.tied) {
      deleteNote(trackId, currentBlockId, voiceId, currentBeatId, string, false)
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
    beatObj.duration = `${beatObj.duration.charAt(0)}r`
    beatObj.notes = []
  }

  if (Song.isBeatEmpty(trackId, blockId)) {
    sequencerHandler.redrawSequencerMain()
  }
  if (Settings.vexFlowIsActive && trackId === Song.currentTrackId && voiceId === Song.currentVoiceId) {
    classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId)
  }
}
