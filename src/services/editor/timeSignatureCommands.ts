import { deleteNote } from './noteCommands'
import { selectionState } from '../../stores/selectionState'
import Song from '../../stores/song'
import Duration from '../../utils/duration'
import { typedEventBus } from '../../utils/typedEventBus'
import { restOf } from '../../utils/durationUtils'
import { showNotification } from '../../stores/notificationState'

/** Calls `visit` for every voice of every bar from `startBlockId` up to the next time signature change. */
function forEachBarUntilNextChange(
  startBlockId: number,
  visit: (trackId: number, voiceId: number, blockId: number) => void,
): void {
  for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
    for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
      for (let blockId = startBlockId; blockId < Song.measureMeta.length; blockId += 1) {
        if (blockId !== startBlockId && Song.measureMeta[blockId].timeMeterPresent) break
        visit(trackId, voiceId, blockId)
      }
    }
  }
}

/**
 * Fits the bars from `startBlockId` up to the next time signature change, on
 * every track, to the time signature of `startBlockId`: beats that no longer
 * fit are removed and gaps are filled with rests. Returns false (and changes
 * nothing) when a tuplet would be cut. Callers record the undo step
 * (`recordBarEdit` with `allTracks`).
 */
export function fitBarsToTimeSignature(startBlockId: number): boolean {
  const { numerator, denominator } = Song.measureMeta[startBlockId]
  const barLength = (64 / denominator) * numerator // in 64ths

  // A cut is only allowed at a whole 64th, i.e. not inside a tuplet.
  let cutsTuplet = false
  forEachBarUntilNextChange(startBlockId, (trackId, voiceId, blockId) => {
    let position = 0
    for (const beat of Song.measures[trackId][blockId][voiceId]) {
      const beatLength = Duration.getDurationOfNote(beat, false)
      if (position + beatLength > barLength && position - Math.floor(position) !== 0) {
        cutsTuplet = true
      }
      position += beatLength
    }
  })
  if (cutsTuplet) {
    showNotification('Remove the tuplet before changing the time signature.', 'error')
    return false
  }

  forEachBarUntilNextChange(startBlockId, (trackId, voiceId, blockId) => {
    const beats = Song.measures[trackId][blockId][voiceId]
    let position = 0
    for (let i = 0; i < beats.length; i += 1) {
      const beatLength = Duration.getDurationOfNote(beats[i], false)
      if (position + beatLength > barLength) {
        // Remove the notes first, so notes tied to them go too.
        for (let j = i; j < beats.length; j += 1) {
          beats[j].notes?.forEach((note, string) => {
            if (note != null) deleteNote(trackId, blockId, voiceId, j, string)
          })
        }
        beats.splice(i)
        break
      }
      position += beatLength
    }
    // Fill the rest of the bar with rests, longest first.
    let spaceToFill = barLength - position
    while (spaceToFill > 0) {
      const restLength = Duration.greatestNoteValueIn(spaceToFill)
      if (restLength <= 0) break
      spaceToFill -= restLength
      Song.setBeat(trackId, blockId, voiceId, beats.length, restOf(Duration.typeToString(restLength)))
    }
  })

  // Keep the cursor inside its (possibly shorter) bar.
  const cursor = selectionState.cursor
  const cursorBar = Song.measures[cursor.trackId]?.[cursor.blockId]?.[cursor.voiceId]
  if (cursorBar != null && cursor.beatId >= cursorBar.length) {
    typedEventBus.emit('navigation.setClickedPos', { ...cursor, beatId: 0 })
  }
  return true
}
