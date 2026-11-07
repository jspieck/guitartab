import Song from '../../stores/song'
import { selectionState } from '../../stores/selectionState'
import { showNotification } from '../../stores/notificationState'
import { typedEventBus } from '../../utils/typedEventBus'
import { maxFretFor } from '../../utils/keyboardShortcuts'
import { applyPlacement, placeTransposedBeat } from '../../utils/transpose'
import { recordBarEdit } from './editCommands'
import { moveSelection } from './noteEntry'
import { applyRangeAsLoop, extendRange, notesInRange, orderedRange, startRange } from './rangeSelection'

/**
 * Selecting with the keyboard and Shift+click (the range is also the loop, as when dragging),
 * selecting the bar or the track, and transposing what is selected.
 */

/** Keeps the range's anchor when the cursor is at its moving end; otherwise anchors at the cursor. */
function anchorAtCursor(): void {
  const { trackId, voiceId, blockId, beatId } = selectionState.cursor
  const { rangeStart, rangeEnd } = selectionState
  const atMovingEnd =
    rangeStart != null &&
    (rangeEnd == null ? rangeStart : rangeEnd).blockId === blockId &&
    (rangeEnd == null ? rangeStart : rangeEnd).beatId === beatId
  if (!atMovingEnd || rangeStart?.trackId !== trackId) startRange(trackId, blockId, voiceId, beatId)
}

function finishRange(): void {
  const { trackId, voiceId, blockId, beatId } = selectionState.cursor
  extendRange(trackId, blockId, voiceId, beatId)
  applyRangeAsLoop()
}

/** Shift+←/→: moves the cursor a beat and extends the range with it. */
export function extendSelection(direction: 'left' | 'right'): void {
  anchorAtCursor()
  moveSelection(direction)
  finishRange()
}

/** Shift+click: the range from the cursor (or the range's anchor) to the clicked beat. */
export function extendSelectionTo(blockId: number, beatId: number, string: number): void {
  anchorAtCursor()
  const { trackId, voiceId } = selectionState.cursor
  typedEventBus.emit('navigation.setClickedPos', { trackId, voiceId, blockId, beatId, string })
  finishRange()
}

function selectBars(trackId: number, voiceId: number, first: number, last: number): void {
  startRange(trackId, first, voiceId, 0)
  extendRange(trackId, last, voiceId, Song.measures[trackId][last][voiceId].length - 1)
  applyRangeAsLoop()
}

/** Ctrl+A: selects the cursor's bar; again (when that bar is selected) the whole track. */
export function selectBarOrTrack(): void {
  const { trackId, voiceId, blockId } = selectionState.cursor
  const range = orderedRange()
  const lastBeat = Song.measures[trackId][blockId][voiceId].length - 1
  const barSelected =
    range != null &&
    range[0].blockId === blockId &&
    range[0].beatId === 0 &&
    range[1].blockId === blockId &&
    range[1].beatId === lastBeat
  if (barSelected) selectBars(trackId, voiceId, 0, Song.measures[trackId].length - 1)
  else selectBars(trackId, voiceId, blockId, blockId)
}

/**
 * Transposes the selected beats (or the beat at the cursor) by `semitones`, moving notes to
 * other strings where the fret would leave the neck. Refused (nothing changes) when a beat
 * can't be played after it, and on drum tracks.
 */
export function transposeSelection(semitones: number): boolean {
  const content = notesInRange()
  const { trackId } = selectionState.cursor
  const track = Song.tracks[trackId]
  const instrument = Song.playBackInstrument[trackId]?.instrument
  if (content == null || content.notes.length === 0) return false
  if (instrument === 'drums') {
    showNotification('Drum tracks can’t be transposed.', 'error')
    return false
  }
  const maxFret = maxFretFor(instrument)
  // A tie continues on the string its first note moved to.
  const tieStrings = new Map<number, number>()
  const plans = content.beats.map(({ beat }) => {
    const notes = beat.notes.flatMap((note, string) => (note == null ? [] : [{ string, fret: note.fret }]))
    const fixed = new Map<number, number>()
    for (const { string } of notes) {
      const pinned = beat.notes[string]?.tied ? tieStrings.get(string) : undefined
      if (pinned != null) fixed.set(string, pinned)
    }
    const placement = placeTransposedBeat(notes, track.strings, semitones, maxFret, fixed)
    tieStrings.clear()
    placement?.forEach(({ from, string }) => tieStrings.set(from, string))
    return { beat, placement }
  })
  if (plans.some(({ placement }) => placement == null)) {
    showNotification('Not every note fits on the neck after transposing; nothing was changed.', 'error')
    return false
  }
  const label = Math.abs(semitones) === 12 ? 'Transpose an octave' : 'Transpose'
  recordBarEdit(label, { trackId, blockIds: content.blocks }, () => {
    for (const { beat, placement } of plans) applyPlacement(beat.notes, placement!)
  })
  return true
}
