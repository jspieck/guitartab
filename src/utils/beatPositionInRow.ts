import {
  getBlockRenderLayout,
  getTrackRenderLayout,
} from '../composables/useTabRenderLayout'
import type { BeatLocation } from '../types/tab'

function normalizeBeatLocation(
  locationOrTrackId: BeatLocation | number,
  voiceId?: number,
  blockId?: number,
  beatId?: number,
): BeatLocation {
  if (typeof locationOrTrackId === 'object') {
    return locationOrTrackId
  }
  return {
    trackId: locationOrTrackId,
    voiceId: voiceId!,
    blockId: blockId!,
    beatId: beatId!,
  }
}

/**
 * Canonical X position of a beat within its row (SVG row coordinates).
 * Returns null when layout has not been computed yet — callers may fall back.
 */
export function getBeatPositionInRow(
  locationOrTrackId: BeatLocation | number,
  voiceId?: number,
  blockId?: number,
  beatId?: number,
): number | null {
  const { trackId, voiceId: voice, blockId: block, beatId: beat } = normalizeBeatLocation(
    locationOrTrackId,
    voiceId,
    blockId,
    beatId,
  )
  const blockLayout = getBlockRenderLayout(trackId, voice, block)
  const beatPos = blockLayout?.beatPositions?.[beat]

  if (blockLayout != null && beatPos != null && Number.isFinite(beatPos)) {
    return blockLayout.xOffset + beatPos
  }

  return null
}

/**
 * X position of the end edge of a measure within its row.
 */
export function getMeasureEndPositionInRow(
  trackId: number,
  voiceId: number,
  blockId: number,
): number | null {
  const block = getBlockRenderLayout(trackId, voiceId, blockId)
  if (block != null) {
    return block.xOffset + block.width
  }

  return null
}

/**
 * Total content width of a row from layout state.
 */
export function getRowContentWidthFromLayout(
  trackId: number,
  voiceId: number,
  rowId: number,
): number | null {
  const layout = getTrackRenderLayout(trackId, voiceId)
  if (!layout) {
    return null
  }

  const rowBlocks = layout.blockLayouts.filter((block) => block.rowId === rowId)
  if (rowBlocks.length === 0) {
    return null
  }

  const lastBlock = rowBlocks[rowBlocks.length - 1]
  return lastBlock.xOffset + lastBlock.width
}
