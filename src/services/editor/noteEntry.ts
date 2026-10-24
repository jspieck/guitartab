import fastdom from 'fastdom'
import Song from '../../stores/song'
import { selectionState } from '../../stores/selectionState'
import { typedEventBus } from '../../utils/typedEventBus'
import { combineFretDigit, maxFretFor, type FretEntry } from '../../utils/keyboardShortcuts'
import { notifySongDataChanged } from '../appEvents'
import { audioGraph } from '../audio/audioGraph'
import { samplePlayer } from '../audio/samplePlayer'
import { editTransaction } from './editCommands'
import { deleteNote, setFret } from './noteCommands'
import { currentLoopInterval } from './rangeSelection'

/**
 * Note entry at the edit cursor: typing frets, placing a note (it sounds at once), deleting
 * the note at the cursor or every note in the loop range, and moving the cursor. Used by
 * the keyboard shortcuts, the phone's touch pad and the drum dialog.
 */

/** Last fret typed, so a quick second digit on the same note makes 10 and up. */
let lastFretEntry: FretEntry | null = null

/** The cursor is on a note position the user picked (not only the start-up default). */
export function hasExplicitNoteSelection(): boolean {
  const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
  return (
    selectionState.hasExplicitSelection &&
    trackId >= 0 &&
    blockId >= 0 &&
    voiceId >= 0 &&
    beatId >= 0 &&
    string >= 0 &&
    Song.findBeat({ trackId, blockId, voiceId, beatId }) != null
  )
}

/** Sets a fret on a string of a beat (a rest becomes a note; one undo step) and plays it. */
export function placeNote(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  string: number,
  fret: number,
): void {
  const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
  const note = beat.notes[string]
  setFret(trackId, blockId, voiceId, beatId, string, fret)
  notifySongDataChanged()
  const instrument = Song.playBackInstrument[trackId].instrument
  samplePlayer.playFret(
    trackId,
    voiceId,
    string,
    fret,
    0.5,
    audioGraph.getCurrentTime(),
    0.5,
    beat,
    note,
    instrument,
    fret,
  )
}

/** A typed digit: sets the fret at the cursor. False without a note selected. */
export function enterFretDigit(digit: number): boolean {
  if (!hasExplicitNoteSelection()) return false
  const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
  const position = `${trackId}:${blockId}:${voiceId}:${beatId}:${string}`
  const now = Date.now()
  const maxFret = maxFretFor(Song.playBackInstrument[trackId]?.instrument)
  const fret = combineFretDigit(lastFretEntry, digit, position, now, maxFret)
  lastFretEntry = { position, fret, at: now }
  fastdom.mutate(() => placeNote(trackId, blockId, voiceId, beatId, string, fret))
  return true
}

/** Deletes the note at the cursor, or every note of the loop range on this track (one undo step). */
export function deleteSelectedNotes(): void {
  const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
  const loop = currentLoopInterval()
  if (loop == null || loop.trackId !== Song.currentTrackId) {
    if (Song.findBeat({ trackId, blockId, voiceId, beatId }) == null) return
    deleteNote(trackId, blockId, voiceId, beatId, string)
    typedEventBus.emit('render.block', { trackId, blockId, voiceId })
    typedEventBus.emit('render.durations', { trackId, blockId, voiceId })
  } else {
    const blockIds: number[] = []
    editTransaction('Delete notes', () => {
      for (let block = loop.startBlock; block <= loop.endBlock; block += 1) {
        const first = block !== loop.startBlock ? 0 : loop.startBeat
        const last =
          block !== loop.endBlock ? Song.measures[trackId][block][voiceId].length - 1 : loop.endBeat
        for (let beat = first; beat <= last; beat += 1) {
          const { notes } = Song.getBeat({ trackId, blockId: block, voiceId, beatId: beat })
          notes.forEach((note, noteString) => {
            if (note != null) deleteNote(trackId, block, voiceId, beat, noteString)
          })
        }
        blockIds.push(block)
        typedEventBus.emit('render.durations', { trackId, blockId: block, voiceId })
      }
    })
    typedEventBus.emit('render.blocks', { trackId, blockIds, voiceId })
  }
  notifySongDataChanged()
}

/** Moves the cursor a beat left/right (across bars) or a string up/down; stays put at the edges. */
export function moveSelection(direction: 'left' | 'right' | 'up' | 'down'): void {
  const { trackId, voiceId } = selectionState.cursor
  let { blockId, beatId, string } = selectionState.cursor
  const voiceBeats = (block: number) => Song.measures[trackId][block][voiceId].length

  if (direction === 'left') {
    if (beatId > 0) {
      beatId -= 1
    } else if (blockId > 0) {
      blockId -= 1
      beatId = voiceBeats(blockId) - 1
    }
  } else if (direction === 'right') {
    if (beatId + 1 < voiceBeats(blockId)) {
      beatId += 1
    } else if (blockId + 1 < Song.measures[trackId].length) {
      blockId += 1
      beatId = 0
    }
  } else if (direction === 'down') {
    // String 0 is the lowest string, drawn on the bottom line.
    if (string > 0) string -= 1
  } else if (string + 1 < Song.tracks[trackId].numStrings) {
    string += 1
  }
  typedEventBus.emit('navigation.setClickedPos', { trackId, blockId, voiceId, beatId, string })
}
