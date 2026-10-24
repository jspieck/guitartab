import Song from '../../stores/song'
import { instrumentIconSrc } from '../../data/instrumentData'
import { setTrackSignIcon } from '../../utils/editorUi'
import { tupletState } from '../../stores/tupletState'
import Duration from '../../utils/duration'
import { noteLengthOf, restOf } from '../../utils/durationUtils'
import { redrawTrack } from './layoutInvalidation'
import { createMeasures } from './measureStructureCommands'
import { fillTimeSignatures } from './trackLoading'

/** Bars after loading or structural edits: tuplet numbering, rests, a full track refresh. */

/** Gives a beat its effects object and numbers tuplet groups; returns the beat length in ticks. */
export function fillBeat(trackId: number, blockId: number, voiceId: number, beatId: number) {
  const beatObj = Song.getBeat({ trackId, blockId, voiceId, beatId })
  if (beatObj.effects == null) {
    beatObj.effects = Song.defaultMeasureEffects()
  }
  if (beatObj.tuplet != null) {
    if (tupletState.fillRemaining <= 0) {
      tupletState.fillId += 1

      // add notes until the note is dividable by tuplet
      const startTuplet = beatObj.tuplet
      let durationSum = 0
      let numNotes = 0
      let breakPoint = 0
      let distanceBetweenNumNotesAndTupletLength = 999999

      for (let j = beatId, n = Song.measures[trackId][blockId][voiceId].length; j < n; j += 1) {
        const note = Song.getBeat({ trackId, blockId, voiceId, beatId: j })
        if (note.tuplet !== startTuplet) break
        durationSum += Duration.getDurationOfNote(note, true)
        numNotes += 1
        if (durationSum % startTuplet === 0) {
          // is an option, look for better tuplets
          if (distanceBetweenNumNotesAndTupletLength > Math.abs(startTuplet - numNotes)) {
            distanceBetweenNumNotesAndTupletLength = Math.abs(startTuplet - numNotes)
            breakPoint = numNotes
          }
        }
      }

      tupletState.fillRemaining = breakPoint
      tupletState.groups[tupletState.fillId] = { originalDuration: '' }
      // TODO can this be 1.5 or so???
      const durationType = Math.round((durationSum / startTuplet) * 2)
      tupletState.groups[tupletState.fillId].originalDuration = Duration.typeToString(durationType)
    }
    beatObj.tupletId = tupletState.fillId
    tupletState.fillRemaining -= 1
  }
  return Duration.getDurationOfNote(Song.getBeat({ trackId, blockId, voiceId, beatId }), false)
}

export function fillMeasures(trackId: number, voiceId: number) {
  const numBlocks = Song.measures[trackId].length
  for (let blockId = 0; blockId < numBlocks; blockId += 1) {
    fillMeasure(trackId, blockId, voiceId)
  }
}

export function fillMeasure(trackId: number, blockId: number, voiceId: number) {
  const beatLength = Song.measures[trackId][blockId][voiceId].length
  for (let beatId = 0; beatId < beatLength; beatId += 1) {
    fillBeat(trackId, blockId, voiceId, beatId)
  }
}

/** Fills `ticks` of a bar from `startBeatId` with the fewest rests. */
export function fillAvailableSpaceWithRests(
  trackId: number,
  blockId: number,
  voiceId: number,
  startBeatId: number,
  durationLengthIn: number,
) {
  let durationLength = durationLengthIn
  for (let l = 0, n = durationLength; l < n; l += 1) {
    if (durationLength <= 0) break
    // fill with greatest 2potence and fill the rest with eighths
    const nearest2Potence = Duration.greatestNoteValueIn(durationLength)
    durationLength -= nearest2Potence
    Song.setBeat(trackId, blockId, voiceId, startBeatId + l, restOf(Duration.typeToString(nearest2Potence)))
  }
}

/** Marks beats without notes as rests, renumbers tuplets and redraws a track (after tuning or string changes). */
export function refreshTrack(trackId: number) {
  // Set to rest where no notes are available
  for (let blockId = 0; blockId < Song.measures[trackId].length; blockId += 1) {
    for (let voiceId = 0; voiceId < Song.measures[trackId][blockId].length; voiceId += 1) {
      for (let beatId = 0; beatId < Song.measures[trackId][blockId][voiceId].length; beatId += 1) {
        const { notes } = Song.getBeat({ trackId, blockId, voiceId, beatId })
        if (notes != null) {
          let isRest = true
          for (let i = 0; i < Song.tracks[trackId].numStrings; i += 1) {
            if (notes[i] != null) {
              isRest = false
              break
            }
          }
          const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
          if (isRest) {
            beat.duration = restOf(beat.duration)
          } else {
            beat.duration = noteLengthOf(beat.duration)
          }
        }
      }
    }
  }

  for (let j = 0; j < Song.numVoices; j += 1) {
    createMeasures(trackId, j)
    fillMeasures(trackId, j)
  }
  fillTimeSignatures()

  // Set default marking
  if (trackId === Song.currentTrackId) {
    redrawTrack(trackId, Song.currentVoiceId, null)

    setTrackSignIcon(instrumentIconSrc(Song.playBackInstrument[trackId].instrument))
  }
}
