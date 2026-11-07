import Song, { type Beat } from '../../stores/song'
import { selectionState } from '../../stores/selectionState'
import { typedEventBus } from '../../utils/typedEventBus'
import Duration from '../../utils/duration'
import { applyDrumMap, drumName, insertDrum } from '../../utils/drumMap'
import { readDrumGrid, writeDrumGrid } from '../../utils/drumGrid'
import { fillMeasure } from './barFilling'
import { requestDurationRender } from './renderCommands'
import { notifySongDataChanged } from '../appEvents'
import { audioGraph } from '../audio/audioGraph'
import { samplePlayer } from '../audio/samplePlayer'
import { isDrumTrack } from '../drumMixer'
import { editTransaction, recordBarEdit } from './editCommands'
import { redrawTrack } from './layoutInvalidation'
import { deleteNote, setFret } from './noteCommands'
import { recordTrackEdit } from './songSettingsCommands'

/**
 * Drum tracks in the editor: one tab line per drum (`track.drumMap`, `utils/drumMap.ts`).
 * Loading and new tracks put the notes on their lines; the drum map dialog reorders,
 * adds and removes lines; letter keys, the step grid and the phone's pads toggle hits.
 */

/** Puts a drum track's notes on its map's lines (on load and for new tracks; no undo). */
export function normalizeDrumTrack(trackId: number): boolean {
  const track = Song.tracks[trackId]
  if (track == null || !isDrumTrack(trackId)) return false
  return applyDrumMap(track, Song.measures[trackId])
}

/** The track's drum map, or null on other tracks. */
export function drumMapOf(trackId: number): readonly number[] | null {
  if (!isDrumTrack(trackId)) return null
  return Song.tracks[trackId]?.drumMap ?? null
}

/**
 * Gives a drum track a new map (order, added or removed drums) as one undo step; hits of
 * removed drums are deleted. False when it is not a drum track or the map is empty.
 */
export function setDrumMap(trackId: number, map: readonly number[], label = 'Drum map'): boolean {
  if (!isDrumTrack(trackId) || map.length === 0) return false
  const bars = Song.measures[trackId]
  const blockIds = bars.map((_, blockId) => blockId)
  const removed = (Song.tracks[trackId].drumMap ?? []).filter((midi) => !map.includes(midi))
  recordBarEdit(label, { trackId, blockIds, afterChange: () => relayoutDrumTrack(trackId) }, () => {
    if (removed.length > 0) deleteHits(trackId, removed)
    recordTrackEdit(label, trackId, () => applyDrumMap(Song.tracks[trackId], bars, map))
  })
  relayoutDrumTrack(trackId)
  return true
}

function relayoutDrumTrack(trackId: number): void {
  if (trackId === Song.currentTrackId) redrawTrack(trackId, Song.currentVoiceId)
  const cursor = selectionState.cursor
  const lines = Song.tracks[trackId]?.numStrings ?? 0
  if (cursor.trackId === trackId && cursor.string >= lines) cursor.string = Math.max(0, lines - 1)
}

function deleteHits(trackId: number, drums: readonly number[]): void {
  Song.measures[trackId].forEach((bar) =>
    bar.forEach((voice) =>
      voice.forEach((beat) => {
        beat.notes = (beat.notes ?? []).map((note) =>
          note != null && drums.includes(note.fret) ? null : note,
        )
        if (!beat.notes.some((note) => note != null) && !beat.duration.endsWith('r')) {
          beat.duration = `${beat.duration}r` as typeof beat.duration
          beat.notes = []
        }
      }),
    ),
  )
}

/** Number of hits of each drum in a track. */
export function drumHitCounts(trackId: number): Map<number, number> {
  const counts = new Map<number, number>()
  for (const bar of Song.measures[trackId] ?? []) {
    for (const voice of bar) {
      for (const beat of voice) {
        for (const note of beat.notes ?? []) {
          if (note != null) counts.set(note.fret, (counts.get(note.fret) ?? 0) + 1)
        }
      }
    }
  }
  return counts
}

/** The line of a drum on a drum track, adding it to the map (in tab order) when missing. */
function lineOf(trackId: number, midi: number): number {
  const map = Song.tracks[trackId].drumMap ?? []
  const line = map.indexOf(midi)
  if (line >= 0) return line
  const next = [...map]
  insertDrum(next, midi)
  setDrumMap(trackId, next, `Add ${drumName(midi)}`)
  return Song.tracks[trackId].drumMap!.indexOf(midi)
}

/**
 * Turns a drum hit on or off at a beat (one undo step) and plays it when it is turned on.
 * A drum the track's map lacks gets a line. Returns whether the hit is now there.
 */
export function toggleDrumHit(
  position: { trackId: number; blockId: number; voiceId: number; beatId: number },
  midi: number,
  on?: boolean,
): boolean {
  const { trackId, blockId, voiceId, beatId } = position
  if (!isDrumTrack(trackId) || Song.findBeat(position) == null) return false
  let present = false
  editTransaction(`Drum: ${drumName(midi)}`, () => {
    const line = lineOf(trackId, midi)
    const beat = Song.getBeat(position)
    present = beat.notes[line] != null
    if (present === (on ?? !present)) return
    if (present) {
      deleteNote(trackId, blockId, voiceId, beatId, line)
    } else {
      setFret(trackId, blockId, voiceId, beatId, line, midi)
      Song.getBeat(position).notes[line]!.string = line
    }
    present = !present
  })
  if (present) playDrum(trackId, voiceId, midi)
  notifySongDataChanged()
  return present
}

/**
 * A drum hit at the edit cursor (letter keys, phone pads, typed drum numbers: `on`); the
 * cursor goes to its line.
 */
export function toggleDrumAtCursor(midi: number, on?: boolean): boolean {
  const cursor = selectionState.cursor
  if (!isDrumTrack(cursor.trackId) || Song.findBeat(cursor) == null) return false
  toggleDrumHit(cursor, midi, on)
  const string = Song.tracks[cursor.trackId].drumMap?.indexOf(midi) ?? -1
  if (string >= 0) typedEventBus.emit('navigation.setClickedPos', { ...cursor, string })
  return true
}

/** A bar of a drum track in the step grid (`utils/drumGrid.ts`). */
export function drumGridOf(
  position: { trackId: number; blockId: number; voiceId: number },
  stepTicks: number,
) {
  const { trackId, blockId, voiceId } = position
  const beats = Song.measures[trackId]?.[blockId]?.[voiceId] ?? []
  return readDrumGrid(beats, Duration.getDurationOfBar(Song.measureMeta[blockId]), stepTicks)
}

/**
 * Sets one cell of the step grid: the bar is written again from its grid with that hit on
 * or off (one undo step); the cursor goes to the cell. False on other tracks.
 */
export function setDrumGridCell(
  position: { trackId: number; blockId: number; voiceId: number },
  stepTicks: number,
  step: number,
  midi: number,
  on: boolean,
): boolean {
  const { trackId, blockId, voiceId } = position
  if (!isDrumTrack(trackId) || Song.measures[trackId]?.[blockId]?.[voiceId] == null) return false
  let beatId = 0
  let line = 0
  const command = recordBarEdit(`Step grid: ${drumName(midi)}`, { trackId, blockIds: [blockId] }, () => {
    line = lineOf(trackId, midi)
    const grid = drumGridOf(position, stepTicks)
    if (grid.hits[step] == null) return false
    if (on) grid.hits[step].add(midi)
    else grid.hits[step].delete(midi)
    const map = Song.tracks[trackId].drumMap ?? []
    const bar = Song.measures[trackId][blockId][voiceId]
    const beats = writeDrumGrid(bar, grid.hits, stepTicks, (drum) => map.indexOf(drum), {
      beat: () => Song.defaultMeasure(),
      note: () => Song.defaultNote(),
    })
    bar.splice(0, bar.length, ...beats)
    fillMeasure(trackId, blockId, voiceId)
    requestDurationRender(trackId, blockId, voiceId)
    beatId = beatStartingAt(bar, step * stepTicks)
  })
  if (command == null) return false
  typedEventBus.emit('navigation.setClickedPos', { trackId, blockId, voiceId, beatId, string: line })
  if (on) playDrum(trackId, voiceId, midi)
  notifySongDataChanged()
  return true
}

function beatStartingAt(beats: readonly Beat[], ticks: number): number {
  let at = 0
  for (let beatId = 0; beatId < beats.length; beatId += 1) {
    if (at >= ticks - 1e-6) return beatId
    at += Duration.getDurationOfNote(beats[beatId], false)
  }
  return Math.max(0, beats.length - 1)
}

export function playDrum(trackId: number, voiceId: number, midi: number): void {
  const beat = Song.defaultMeasure()
  samplePlayer.playFret(
    trackId,
    voiceId,
    0,
    midi,
    0.5,
    audioGraph.getCurrentTime(),
    0.5,
    beat,
    null,
    'drums',
    midi,
  )
}
