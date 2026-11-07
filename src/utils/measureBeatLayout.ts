import { tabLayout } from '../stores/tabLayoutState'
import Song from '../stores/song'
import Duration from './duration'
import { getBlockRenderLayout } from '../stores/tabRenderLayout'
import type { TabBeat } from '../types/tab'
import { getDisplayWidth } from './tabLayout'
import Settings from '../stores/settingsState'
import { keyChanges, keyFifths } from './keySignature'
import { keySignatureGlyphs } from './pitchSpelling'
import { clefChangesAt } from './clefs'
import { otherVoiceNotes, type OtherVoiceNote } from './otherVoiceNotes'

/** Width of one accidental in a key signature on the classical staff, and the room around it. */
const KEY_ACCIDENTAL_WIDTH = 9
const KEY_SIGNATURE_PADDING = 8

/** Whether the bar opens a row in the shown track's current layout. */
function isRowStart(blockId: number): boolean {
  return tabLayout.blockToRow[Song.currentTrackId]?.[Song.currentVoiceId]?.[blockId]?.numInRow === 0
}

/** Width of a clef change drawn inside a row (a small clef before the bar's notes). */
const CLEF_CHANGE_WIDTH = 24

/**
 * Room the classical staff needs at the start of the bar: a key signature at a row's start
 * and where the key changes (with the naturals cancelling the old key; none for C or drums),
 * and a clef change inside a row (a row's own clef sits in the gutter). Nothing without the
 * classical view.
 */
export function keySignatureRoom(blockId: number, rowStart: boolean): number {
  if (!Settings.vexFlowIsActive) return 0
  const trackId = Song.currentTrackId
  const isDrums = Song.playBackInstrument[trackId]?.instrument === 'drums'
  const track = Song.tracks[trackId]
  const clefRoom =
    !rowStart && track != null && clefChangesAt(track, blockId, isDrums) ? CLEF_CHANGE_WIDTH : 0
  if (isDrums) return 0
  const meta = Song.measureMeta[blockId]
  if (meta == null) return clefRoom
  const previous = Song.measureMeta[blockId - 1]
  const changes = blockId > 0 && keyChanges(meta, previous)
  if (!rowStart && !changes && blockId !== 0) return clefRoom
  const glyphs = keySignatureGlyphs(keyFifths(meta), changes ? keyFifths(previous) : null)
  return clefRoom + (glyphs > 0 ? glyphs * KEY_ACCIDENTAL_WIDTH + KEY_SIGNATURE_PADDING : 0)
}

/**
 * Block-local X for a beat (relative to the measure group origin).
 * Uses layout engine beat positions — never row-absolute coordinates.
 */
export function getMeasureBeatX(
  trackId: number,
  voiceId: number,
  blockId: number,
  beatIndex: number,
  measureData: TabBeat[],
): number {
  const blockLayout = getBlockRenderLayout(trackId, voiceId, blockId)
  const layoutBeatX = blockLayout?.beatPositions?.[beatIndex]

  if (layoutBeatX != null && Number.isFinite(layoutBeatX)) {
    return layoutBeatX
  }

  return getFallbackMeasureBeatX(trackId, voiceId, blockId, beatIndex, measureData)
}

/** Relative width of a quarter note (`Duration.getDurationWidth`). */
const QUARTER_WIDTH_UNITS = 2

/**
 * How far into its slot a beat's notes sit. Quarters and shorter are centred; longer notes stay
 * where a quarter's would be, near the start of the time they sound (a half note's slot is four
 * eighths wide: centred, its digits would sit a whole quarter late).
 */
export function beatNoteOffset(beat: TabBeat | null | undefined, width: number): number {
  const units = beat?.duration ? Duration.getDurationWidth(beat) : 0
  return units > QUARTER_WIDTH_UNITS ? (width * QUARTER_WIDTH_UNITS) / units / 2 : width / 2
}

/** Block-local x of a beat's notes (fret digits, stems, effects, note heads). */
export function getMeasureBeatNoteX(
  trackId: number,
  voiceId: number,
  blockId: number,
  beatIndex: number,
  measureData: TabBeat[],
): number {
  return (
    getMeasureBeatX(trackId, voiceId, blockId, beatIndex, measureData) +
    beatNoteOffset(
      measureData[beatIndex],
      getMeasureBeatWidth(trackId, voiceId, blockId, beatIndex, measureData),
    )
  )
}

/**
 * Block-local width for a beat slot from layout minOffset.
 */
export function getMeasureBeatWidth(
  trackId: number,
  voiceId: number,
  blockId: number,
  beatIndex: number,
  measureData: TabBeat[],
): number {
  const beat = measureData[beatIndex]
  // Prefer the reactive layout state so cached computeds re-run when the row is re-justified.
  const minOffset =
    getBlockRenderLayout(trackId, voiceId, blockId)?.minOffset ??
    tabLayout.measureOffset[trackId]?.[blockId]?.[voiceId]

  if (beat != null && minOffset != null && Number.isFinite(minOffset) && minOffset > 0) {
    return Duration.getDurationWidth(beat) * minOffset
  }

  return getDisplayWidth(beat?.duration)
}

function getFallbackMeasureBeatX(
  trackId: number,
  voiceId: number,
  blockId: number,
  beatIndex: number,
  measureData: TabBeat[],
): number {
  const minOffset = tabLayout.measureOffset[trackId]?.[blockId]?.[voiceId]

  if (minOffset != null && Number.isFinite(minOffset) && minOffset > 0) {
    let x = 0
    for (let i = 0; i < beatIndex; i += 1) {
      x += Duration.getDurationWidth(measureData[i]) * minOffset
    }
    return barLeftOffset(blockId) + x
  }

  let x = 0
  for (let i = 0; i < beatIndex; i += 1) {
    x += getDisplayWidth(measureData[i]?.duration)
  }
  return barLeftOffset(blockId) + x
}

/** Padding at the start of every bar, before its first beat. */
export const BAR_LEFT_PADDING = 10

/** Where the first beat of a bar starts: after a repeat sign, tempo or time signature. */
export function barLeftOffset(blockId: number, rowStart = isRowStart(blockId)): number {
  const meta = Song.measureMeta[blockId]
  let left = BAR_LEFT_PADDING
  if (meta == null) return left
  left += keySignatureRoom(blockId, rowStart)
  if (meta.repeatOpen) left += 20
  if (blockId === 0 || meta.bpm != null) {
    left += 43
    if (`${meta.bpm}`.length > 2) left += 8
  } else if (meta.timeMeterPresent) {
    left += 10
  }
  return left
}

/** The faintly drawn notes of the other voice in a bar, placed in the edited voice's beats. */
export function barOtherVoiceNotes(
  trackId: number,
  voiceId: number,
  blockId: number,
  beats: TabBeat[],
): OtherVoiceNote[] {
  const other = Song.measures[trackId]?.[blockId]?.[voiceId === 0 ? 1 : 0]
  const boxes = beats.map((beat, index) => {
    const left = getMeasureBeatX(trackId, voiceId, blockId, index, beats)
    const width = getMeasureBeatWidth(trackId, voiceId, blockId, index, beats)
    return { left, width, noteX: left + beatNoteOffset(beat, width) }
  })
  return otherVoiceNotes(beats, boxes, other)
}
