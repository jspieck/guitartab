import Song, { type Beat } from '../../assets/js/songData'
import { tab } from '../../assets/js/tab'
import { EPSILON } from '../../stores/settingsState'
import type { RangeEndpoint } from '../../stores/selectionState'
import Duration from '../../utils/duration'
import { isRestDuration, restOf } from '../../utils/durationUtils'
import { cloneData, recordBarEdit } from './editCommands'
import { requestDurationRender } from './renderCommands'
import { orderedRange } from './rangeSelection'
import { showUserError } from '../userNotifications'

/**
 * Copy and paste of the range selection. Copying takes a snapshot, so later
 * edits to the source bars don't change what is pasted. Pasting overwrites
 * the selected range from its start, splitting beats over bar lines with ties
 * and filling what is left with rests.
 */

let copiedBeats: Beat[] = []

/** The beats on the clipboard (copies; read-only for callers). */
export function clipboardBeats(): readonly Beat[] {
  return copiedBeats
}

export function copyRange(): void {
  const range = orderedRange()
  if (range == null) return
  const [start, end] = range
  const { trackId, voiceId } = end
  const beats: Beat[] = []
  for (let blockId = start.blockId; blockId <= end.blockId; blockId += 1) {
    const bar = Song.measures[trackId][blockId][voiceId]
    const first = blockId === start.blockId ? start.beatId : 0
    const last = blockId === end.blockId ? end.beatId : bar.length - 1
    for (let beatId = first; beatId <= last; beatId += 1) beats.push(cloneData(bar[beatId]))
  }
  copiedBeats = beats
}

const ticksOf = (beat: Beat) => Duration.getDurationOfNote(beat, false)

/** Note values (largest first, dotted where they fit) that add up to `ticks`. */
export function splitIntoNoteValues(ticks: number): { noteSize: number; dotted: boolean }[] {
  const result = []
  let left = ticks
  // A 128th (0.5) is the shortest value; a smaller remainder (from tuplets) is dropped.
  while (left >= 0.5 - EPSILON) {
    const bestFit = Duration.greatestNoteValueIn(left)
    const dotted = bestFit * 1.5 <= left
    result.push({ noteSize: bestFit, dotted })
    left -= dotted ? bestFit * 1.5 : bestFit
  }
  return result
}

/**
 * Where the pasted beats end: walks from the range start until their length is
 * covered, the range ends or the track ends. Null when it would cut a tuplet.
 */
function pasteEnd(trackId: number, voiceId: number, start: RangeEndpoint, end: RangeEndpoint, ticks: number) {
  let blockId = start.blockId
  let beatId = start.beatId
  let left = ticks
  while (left > 0) {
    left -= ticksOf(Song.getBeat({ trackId, blockId, voiceId, beatId }))
    if (left <= EPSILON) break
    if (Song.measures[trackId][blockId][voiceId].length <= beatId + 1) {
      if (left - Math.floor(left) !== 0) {
        showUserError('Pasting into a bar with tuplets is not possible here.')
        return null
      }
      // Only part of the clipboard fits.
      if (Song.measures[trackId].length <= blockId || end.blockId <= blockId) break
      blockId += 1
      beatId = 0
    } else {
      if (blockId >= end.blockId && beatId >= end.beatId) break
      beatId += 1
    }
  }
  return { blockId, beatId }
}

/**
 * Inserts `beat` as notes that together last `ticks`; every piece after the
 * first is tied to the one before (the first too when `continues`).
 * Returns the next beat index.
 */
function insertTied(bar: Beat[], at: number, beat: Beat, ticks: number, continues: boolean): number {
  let beatId = at
  splitIntoNoteValues(ticks).forEach(({ noteSize, dotted }, i) => {
    const piece = cloneData(beat)
    piece.dotted = dotted
    piece.doubleDotted = false
    const code = Duration.typeToString(noteSize)
    piece.duration = isRestDuration(beat.duration) ? restOf(code) : code
    if (continues || i > 0) for (const note of piece.notes ?? []) if (note != null) note.tied = true
    bar.splice(beatId, 0, piece)
    beatId += 1
  })
  return beatId
}

function insertRests(bar: Beat[], at: number, ticks: number): void {
  splitIntoNoteValues(ticks).forEach(({ noteSize, dotted }, i) => {
    bar.splice(at + i, 0, {
      ...Song.defaultMeasure(),
      duration: restOf(Duration.typeToString(noteSize)),
      dotted,
      notes: [],
    })
  })
}

export function pasteRange(): void {
  const range = orderedRange()
  if (range == null || copiedBeats.length === 0) return
  const [start, end] = range
  const trackId = Song.currentTrackId
  const voiceId = Song.currentVoiceId
  const source = copiedBeats
  const last = pasteEnd(
    trackId,
    voiceId,
    start,
    end,
    source.reduce((sum, beat) => sum + ticksOf(beat), 0),
  )
  if (last == null) return

  const blockIds: number[] = []
  for (let blockId = start.blockId; blockId <= last.blockId; blockId += 1) blockIds.push(blockId)
  let next = 0
  // The part of a beat that did not fit in the previous bar.
  let carry: { beat: Beat; ticks: number } | null = null

  recordBarEdit('Paste', { trackId, blockIds }, () => {
    for (const blockId of blockIds) {
      const bar = Song.measures[trackId][blockId][voiceId]
      const first = blockId === start.blockId ? start.beatId : 0
      const lastBeat = blockId === last.blockId ? last.beatId : bar.length - 1
      let space = 0
      for (let beatId = first; beatId <= lastBeat; beatId += 1) space += ticksOf(bar[beatId])
      bar.splice(first, lastBeat - first + 1)

      let beatId = first
      if (carry != null) {
        beatId = insertTied(bar, beatId, carry.beat, carry.ticks, true)
        space -= carry.ticks
        carry = null
      }
      while (space > EPSILON) {
        if (next >= source.length) {
          insertRests(bar, beatId, space)
          break
        }
        const beat = cloneData(source[next])
        const ticks = ticksOf(beat)
        if (ticks <= space + EPSILON) {
          bar.splice(beatId, 0, beat)
          beatId += 1
          space -= ticks
        } else {
          // Doesn't fit: the rest goes into the next bar, tied.
          beatId = insertTied(bar, beatId, beat, space, false)
          carry = { beat, ticks: ticks - space }
          space = 0
        }
        next += 1
      }
      requestDurationRender(trackId, blockId, voiceId)
      tab.fillMeasure(trackId, blockId, voiceId)
    }
  })
  tab.drawTrack(trackId, voiceId, true, null)
}
