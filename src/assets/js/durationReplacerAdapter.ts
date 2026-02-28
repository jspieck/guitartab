/**
 * DurationReplacerAdapter — Bridges DurationReplacer (pure logic) with the
 * existing Song/Measure data model in tab.ts.
 *
 * Converts between `Measure[]` (the Song's internal representation) and the
 * lightweight `Beat[]` interface that DurationReplacer operates on.
 */

import { Measure } from './songData'
import Song from './songData'
import { DurationReplacer, Beat } from '../../utils/durationReplacer'

export function measureToBeats(measures: Measure[], numStrings: number): Beat[] {
  return measures.map(m => ({
    duration: m.duration,
    dotted: m.dotted,
    doubleDotted: m.doubleDotted,
    tuplet: m.tuplet,
    tupletId: m.tupletId,
    hasNotes: hasAnyNote(m, numStrings),
  }))
}

function hasAnyNote(measure: Measure, numStrings: number): boolean {
  if (!measure.notes) return false
  for (let i = 0; i < numStrings; i++) {
    if (measure.notes[i] != null) return true
  }
  return false
}

/**
 * Apply a Beat[] result back onto the existing Measure[] in Song.measures.
 *
 * - Beats that existed before keep their full Measure data (effects, notes, etc.)
 * - New rest beats get Song.defaultMeasure() with the correct duration/dot/tuplet fields
 * - Removed beats are spliced out
 */
export function applyBeatsToMeasures(
  trackId: number,
  blockId: number,
  voiceId: number,
  originalMeasures: Measure[],
  newBeats: Beat[],
  changedBeatIndex: number,
  newDurationCode: string,
): void {
  const blockObj = Song.measures[trackId][blockId][voiceId]

  // 1. Update the changed beat's duration
  blockObj[changedBeatIndex].duration = newDurationCode
  blockObj[changedBeatIndex].dotted = newBeats[changedBeatIndex].dotted
  blockObj[changedBeatIndex].doubleDotted = newBeats[changedBeatIndex].doubleDotted

  // Ensure rest status
  if (!newBeats[changedBeatIndex].hasNotes && !DurationReplacer.isRest(blockObj[changedBeatIndex].duration)) {
    blockObj[changedBeatIndex].duration += 'r'
  }

  // 2. Figure out what changed after the target beat
  const oldAfter = originalMeasures.slice(changedBeatIndex + 1)
  const newAfter = newBeats.slice(changedBeatIndex + 1)

  // Remove everything after the changed beat
  blockObj.splice(changedBeatIndex + 1, oldAfter.length)

  // Re-insert: for each new beat, either reuse the original Measure or create a new rest
  let origIdx = 0
  for (const beat of newAfter) {
    // Try to match this beat to an original measure
    const matchedOriginal = findMatchingOriginal(oldAfter, origIdx, beat)

    if (matchedOriginal !== null) {
      blockObj.push(oldAfter[matchedOriginal])
      origIdx = matchedOriginal + 1
    } else {
      // New rest beat — create a fresh Measure
      const newMeasure = {
        ...Song.defaultMeasure(),
        duration: beat.duration,
        dotted: beat.dotted,
        doubleDotted: beat.doubleDotted,
        tuplet: beat.tuplet,
        tupletId: beat.tupletId,
        notes: [],
      }
      blockObj.push(newMeasure)
    }
  }
}

function findMatchingOriginal(
  originals: Measure[],
  startFrom: number,
  beat: Beat,
): number | null {
  for (let i = startFrom; i < originals.length; i++) {
    const m = originals[i]
    if (
      m.duration === beat.duration &&
      m.dotted === beat.dotted &&
      m.doubleDotted === beat.doubleDotted
    ) {
      return i
    }
  }
  return null
}

/**
 * High-level function that replaces `changeBeatDuration` logic for
 * non-tuplet beats.  Call this from tab.ts instead of the original
 * inline implementation.
 */
export function changeBeatDurationViaReplacer(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  numStrings: number,
  newDurationCode: string,
): { success: boolean; rescaleNeeded: boolean } {
  const blockObj = Song.measures[trackId][blockId][voiceId]
  const originalSnapshot = blockObj.map(m => ({ ...m }))
  const beats = measureToBeats(blockObj, numStrings)

  const result = DurationReplacer.changeDuration(beats, beatId, newDurationCode)

  if (!result.success) {
    return { success: false, rescaleNeeded: false }
  }

  applyBeatsToMeasures(
    trackId, blockId, voiceId,
    originalSnapshot,
    result.beats,
    beatId,
    newDurationCode,
  )

  return { success: true, rescaleNeeded: result.rescaleNeeded }
}
