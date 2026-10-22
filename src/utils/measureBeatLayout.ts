import Song from '../assets/js/songData'
import Duration from './duration'
import { tab } from '../assets/js/tab'
import { getBlockRenderLayout } from '../stores/tabRenderLayout'
import type { TabBeat } from '../types/tab'
import { getDisplayWidth } from './tabLayout'

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
    tab.measureOffset[trackId]?.[blockId]?.[voiceId]

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
  const minOffset = tab.measureOffset[trackId]?.[blockId]?.[voiceId]

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
export function barLeftOffset(blockId: number): number {
  const meta = Song.measureMeta[blockId]
  let left = BAR_LEFT_PADDING
  if (meta == null) return left
  if (meta.repeatOpen) left += 20
  if (blockId === 0 || meta.bpm != null) {
    left += 43
    if (`${meta.bpm}`.length > 2) left += 8
  } else if (meta.timeMeterPresent) {
    left += 10
  }
  return left
}
