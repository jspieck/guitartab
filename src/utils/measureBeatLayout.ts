import Helper from '../assets/js/helper'
import Duration from '../assets/js/duration'
import { tab } from '../assets/js/tab'
import { getBlockRenderLayout } from '../composables/useTabRenderLayout'
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
    return Helper.getLeftOffset(blockId) + x
  }

  let x = 0
  for (let i = 0; i < beatIndex; i += 1) {
    x += getDisplayWidth(measureData[i]?.duration)
  }
  return Helper.getLeftOffset(blockId) + x
}
