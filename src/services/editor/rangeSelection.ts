import Song, { type Beat, type Interval, type Note } from '../../assets/js/songData'
import playBackLogic from '../../assets/js/playbackEngine'
import Settings from '../../stores/settingsState'
import { clearSequencerRange } from '../../stores/sequencerState'
import { syncPlaybackLoopFromInterval } from '../../stores/playbackLoopState'
import { selectionState, type RangeEndpoint } from '../../stores/selectionState'
import Duration from '../../utils/duration'
import { buildLoopIntervalFromOverlays } from '../playbackLoopController'

/**
 * The range selection (its two ends live in `selectionState`) and the loop
 * interval made from it: a finished range drag becomes the interval playback
 * loops over and that toolbar actions apply to.
 */

let loopInterval: Interval | null = null
/** The second end has been set (a drag happened), not just the start click. */
let rangeComplete = false

const WHOLE = Duration.getDurationOfType('wr')

/** Position of a beat's start (or end) as a share of a whole note. */
function endpoint(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  includeBeat: boolean,
): RangeEndpoint {
  let ticks = 0
  const last = includeBeat ? beatId : beatId - 1
  for (let i = 0; i <= last; i += 1)
    ticks += Duration.getDurationOfNote(Song.getBeat({ trackId, blockId, voiceId, beatId: i }), false)
  return { trackId, blockId, voiceId, beatId, abstractTimePos: ticks / WHOLE }
}

function setLoop(interval: Interval | null): Interval | null {
  const previous = loopInterval
  loopInterval = interval
  syncPlaybackLoopFromInterval(interval)
  return previous
}

/** Starts a new range at a beat; drops the loop interval. */
export function startRange(trackId: number, blockId: number, voiceId: number, beatId: number): void {
  clearSequencerRange()
  selectionState.rangeStart = endpoint(trackId, blockId, voiceId, beatId, false)
  selectionState.rangeEnd = null
  rangeComplete = false
  if (loopInterval != null) {
    const previous = setLoop(null)
    if (Settings.songPlaying) playBackLogic.adaptPlayBackToLoopIntervalChange(previous, null)
  }
}

/** Moves the range's other end to a beat (while dragging). */
export function extendRange(trackId: number, blockId: number, voiceId: number, beatId: number): void {
  rangeComplete = true
  selectionState.rangeEnd = endpoint(trackId, blockId, voiceId, beatId, true)
}

export function clearRange(): void {
  selectionState.rangeStart = null
  selectionState.rangeEnd = null
  rangeComplete = false
  setLoop(null)
  clearSequencerRange()
}

/** Makes the range the loop interval (at the end of a drag); jumps there when playing. */
export function applyRangeAsLoop(): void {
  const { rangeStart, rangeEnd } = selectionState
  if (rangeStart == null || rangeEnd == null) return
  const interval = buildLoopIntervalFromOverlays(
    rangeStart,
    rangeEnd,
    (trackId, blockId, voiceId, beatId) =>
      Duration.getDurationOfNote(Song.getBeat({ trackId, blockId, voiceId, beatId }), false),
    WHOLE,
  )
  const previous = setLoop(interval)
  if (Settings.songPlaying) {
    playBackLogic.adaptPlayBackToLoopIntervalChange(previous, interval)
    playBackLogic.jumpToPosition(interval.startBlock, interval.startRatio, interval.startBeat)
  }
}

/** The interval playback loops over, or null without a finished range. */
export function currentLoopInterval(): Interval | null {
  return rangeComplete ? loopInterval : null
}

/** The range with its start before its end, however it was dragged. */
export function orderedRange(): [RangeEndpoint, RangeEndpoint] | null {
  const { rangeStart: a, rangeEnd: b } = selectionState
  if (a == null || b == null) return null
  const aFirst = a.blockId < b.blockId || (a.blockId === b.blockId && a.beatId <= b.beatId)
  return aFirst ? [a, b] : [b, a]
}

export interface NoteInRange {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
  note: Note
}

export interface BeatInRange {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  beat: Beat
}

export interface RangeContent {
  notes: NoteInRange[]
  blocks: number[]
  /** Beats that have at least one note (all beats for the single-cursor case). */
  beats: BeatInRange[]
}

/**
 * What toolbar actions work on: every note in `interval` (default: the loop
 * interval) on the cursor's track and voice, or just the note under the
 * cursor when there is no interval on the current track.
 */
export function notesInRange(interval: Interval | null = currentLoopInterval()): RangeContent | null {
  const { trackId, voiceId, blockId } = selectionState.cursor
  if (Song.measures[trackId]?.[blockId]?.[voiceId] == null) return null
  return interval == null || interval.trackId !== Song.currentTrackId
    ? cursorContent()
    : intervalContent(interval)
}

function cursorContent(): RangeContent {
  const { trackId, voiceId, blockId, beatId, string } = selectionState.cursor
  const beat = Song.getBeat({ trackId, blockId, voiceId, beatId })
  const note = beat.notes?.[string]
  return {
    notes: note != null ? [{ trackId, blockId, voiceId, beatId, string, note }] : [],
    blocks: [blockId],
    beats: [{ trackId, blockId, voiceId, beatId, beat }],
  }
}

/** Notes of the cursor's track and voice inside `interval`. */
function intervalContent(interval: Interval): RangeContent {
  const { trackId, voiceId } = selectionState.cursor
  const content: RangeContent = { notes: [], blocks: [], beats: [] }
  for (let blockId = interval.startBlock; blockId <= interval.endBlock; blockId += 1) {
    const bar = Song.measures[trackId][blockId]?.[voiceId]
    if (bar == null) continue
    const first = blockId === interval.startBlock ? interval.startBeat : 0
    const last = blockId === interval.endBlock ? interval.endBeat : bar.length - 1
    for (let beatId = first; beatId <= last; beatId += 1) {
      const beat = bar[beatId]
      const before = content.notes.length
      beat?.notes?.forEach((note, string) => {
        if (note != null) content.notes.push({ trackId, blockId, voiceId, beatId, string, note })
      })
      if (content.notes.length > before) content.beats.push({ trackId, blockId, voiceId, beatId, beat })
    }
    content.blocks.push(blockId)
  }
  return content
}

/** Whether the range (however dragged) contains a note. */
export function rangeHasNotes(): boolean {
  const range = orderedRange()
  if (range == null) return false
  const [start, end] = range
  const content = notesInRange({
    trackId: start.trackId,
    startBlock: start.blockId,
    startBeat: start.beatId,
    startRatio: start.abstractTimePos,
    endBlock: end.blockId,
    endBeat: end.beatId,
    endRatio: end.abstractTimePos,
  })
  return content != null && content.notes.length > 0
}
