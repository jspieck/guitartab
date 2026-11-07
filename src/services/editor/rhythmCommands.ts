import Song, { type Beat } from '../../stores/song'
import Settings, { EPSILON } from '../../stores/settingsState'
import { selectionState } from '../../stores/selectionState'
import { noteInputState } from '../../stores/noteInputState'
import { showNotification } from '../../stores/notificationState'
import Duration from '../../utils/duration'
import { isRestDuration, restOf } from '../../utils/durationUtils'
import { classicalNotation } from '../notation/classicalNotationAdapter'
import { barTicks, padBarWithRests, voiceTicks } from './barFilling'
import { recordBarEdit } from './editCommands'
import { currentLoopInterval } from './rangeSelection'
import {
  handleTupletSpecialSelect,
  noteLengthSpecialSelect,
  tieTargetAtCursor,
} from './durationModifierCommands'
export { makeRestAtCursor } from './noteEntry'

/**
 * Rhythm entry from the keyboard: dot, tuplet, rest and tie at the cursor, and inserting or
 * deleting a beat. Inserting and deleting shift the rest of the bar; they never push notes out
 * of it (an insert takes its room from the rests at the bar's end, or is refused).
 */

const inTuplet = (beat: Beat | undefined) => beat?.tuplet != null && beat.tuplet > 0

function cursorBeat(): Beat | undefined {
  const { trackId, blockId, voiceId, beatId } = selectionState.cursor
  return Song.measures[trackId]?.[blockId]?.[voiceId]?.[beatId]
}

function refreshNotation(): void {
  const { trackId, blockId, voiceId } = selectionState.cursor
  if (Settings.vexFlowIsActive) classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId)
}

export function toggleDotAtCursor(): boolean {
  return noteLengthSpecialSelect('dotted', Number(noteInputState.tuplet), tieTargetAtCursor())
}

export function toggleTieAtCursor(): boolean {
  return noteLengthSpecialSelect('tied', Number(noteInputState.tuplet), tieTargetAtCursor())
}

/** Makes the cursor's beat a tuplet of `count`; the same count again removes it, another one replaces it. */
export function setTupletAtCursor(count: number): boolean {
  const { trackId, blockId, voiceId } = selectionState.cursor
  const beat = cursorBeat()
  if (beat == null) return false
  noteInputState.tuplet = String(count)
  const command = recordBarEdit('Tuplet', { trackId, blockIds: [blockId] }, () => {
    const current = inTuplet(beat) ? beat.tuplet : null
    if (current != null) {
      // setTuplet removes a tuplet whatever count it is given.
      if (!handleTupletSpecialSelect(trackId, blockId, voiceId, selectionState.cursor.beatId, current))
        return false
      if (current === count) return true
    }
    return handleTupletSpecialSelect(trackId, blockId, voiceId, selectionState.cursor.beatId, count)
  })
  refreshNotation()
  return command != null
}

/** Notes that name a tie partner by position: beats from `beatId` on in this bar moved by `delta`. */
function shiftTieTargets(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  delta: number,
): void {
  for (const bar of [Song.measures[trackId][blockId], Song.measures[trackId][blockId + 1]]) {
    for (const beat of bar?.[voiceId] ?? []) {
      for (const note of beat.notes ?? []) {
        if (note?.tiedTo?.blockId === blockId && note.tiedTo.beatId >= beatId) note.tiedTo.beatId += delta
      }
    }
  }
}

/** Ticks of the rests the bar ends with, from `from` on (the room an insert can take). */
function trailingRestTicks(bar: Beat[], from: number): number {
  let ticks = 0
  for (let i = bar.length - 1; i >= from; i -= 1) {
    if (!isRestDuration(bar[i].duration) || inTuplet(bar[i])) break
    ticks += Duration.getDurationOfNote(bar[i], false)
  }
  return ticks
}

/** Inserts a rest of the current note length at the cursor; the rest of the bar moves right. */
export function insertBeatAtCursor(): boolean {
  const { trackId, blockId, voiceId, beatId } = selectionState.cursor
  const bar = Song.measures[trackId]?.[blockId]?.[voiceId]
  if (bar == null) return false
  if (inTuplet(bar[beatId])) {
    showNotification('Beats can’t be inserted inside a tuplet.', 'error')
    return false
  }
  const code = noteInputState.noteLength
  const ticks = Duration.getDurationOfType(code)
  if (trailingRestTicks(bar, beatId) + EPSILON < ticks) {
    showNotification('No room in this bar: it ends with notes. Delete a beat or add a bar first.', 'error')
    return false
  }
  recordBarEdit('Insert beat', { trackId, blockIds: [blockId] }, () => {
    bar.splice(beatId, 0, { ...Song.defaultMeasure(), duration: restOf(code), notes: [] })
    shiftTieTargets(trackId, blockId, voiceId, beatId, 1)
    // Make room from the rests at the end, then fill what is left over.
    while (
      voiceTicks(trackId, blockId, voiceId) > barTicks(blockId) + EPSILON &&
      isRestDuration(bar[bar.length - 1].duration)
    ) {
      bar.pop()
    }
    padBarWithRests(trackId, blockId, voiceId)
  })
  refreshNotation()
  return true
}

/** Deletes the cursor's beat; the rest of the bar moves left and the bar ends in rests. */
export function deleteBeatAtCursor(): boolean {
  const { trackId, blockId, voiceId, beatId } = selectionState.cursor
  const bar = Song.measures[trackId]?.[blockId]?.[voiceId]
  const beat = bar?.[beatId]
  if (bar == null || beat == null) return false
  if (inTuplet(beat)) {
    showNotification('Remove the tuplet before deleting its beats.', 'error')
    return false
  }
  recordBarEdit(
    'Delete beat',
    { trackId, blockIds: [blockId, blockId + 1].filter((id) => id < Song.measures[trackId].length) },
    () => {
      // A note tied to a deleted one keeps sounding as a note of its own.
      const next = bar[beatId + 1] ?? Song.measures[trackId][blockId + 1]?.[voiceId]?.[0]
      beat.notes.forEach((note, string) => {
        const follower = next?.notes?.[string]
        if (note != null && follower?.tied) follower.tied = false
      })
      bar.splice(beatId, 1)
      shiftTieTargets(trackId, blockId, voiceId, beatId + 1, -1)
      padBarWithRests(trackId, blockId, voiceId)
      selectionState.cursor.beatId = Math.min(beatId, bar.length - 1)
    },
  )
  refreshNotation()
  return true
}

/** The beats of the range on the cursor's track and voice (rests too), or the cursor's beat. */
function beatsForBeatEdit(): Array<{ blockId: number; beat: Beat }> {
  const { trackId, voiceId, blockId, beatId } = selectionState.cursor
  const interval = currentLoopInterval()
  if (interval == null || interval.trackId !== trackId) {
    const beat = Song.measures[trackId]?.[blockId]?.[voiceId]?.[beatId]
    return beat != null ? [{ blockId, beat }] : []
  }
  const beats: Array<{ blockId: number; beat: Beat }> = []
  for (let block = interval.startBlock; block <= interval.endBlock; block += 1) {
    const bar = Song.measures[trackId]?.[block]?.[voiceId] ?? []
    const first = block === interval.startBlock ? interval.startBeat : 0
    const last = block === interval.endBlock ? interval.endBeat : bar.length - 1
    for (let id = first; id <= last && id < bar.length; id += 1) beats.push({ blockId: block, beat: bar[id] })
  }
  return beats
}

/**
 * Slash notation on or off for the range (or the cursor's beat): the beats show only their
 * rhythm, as a slash in the tab and a slash head on the staff. Their notes still sound.
 */
export function toggleSlashBeats(): boolean {
  const beats = beatsForBeatEdit()
  if (beats.length === 0) return false
  const { trackId, voiceId } = selectionState.cursor
  const slash = beats[0].beat.slash !== true
  const blockIds = [...new Set(beats.map((entry) => entry.blockId))]
  const command = recordBarEdit(
    slash ? 'Slash notation' : 'Remove slash notation',
    { trackId, blockIds },
    () => {
      for (const { beat } of beats) {
        if (slash) beat.slash = true
        else delete beat.slash
      }
    },
  )
  if (Settings.vexFlowIsActive) {
    for (const blockId of blockIds) classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId)
  }
  return command != null
}
