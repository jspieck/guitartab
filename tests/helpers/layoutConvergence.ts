import { expect } from 'vitest'
import Song from '../../src/assets/js/songData'
import { tab } from '../../src/assets/js/tab'
import renderBridge from '../../src/services/editor/renderBridge'
import { getTrackRenderLayout } from '../../src/composables/useTabRenderLayout'
import { getBeatPositionInRow } from '../../src/utils/beatPositionInRow'

export function assertTabAndRenderLayoutMatch(trackId: number, voiceId: number): void {
  const layout = getTrackRenderLayout(trackId, voiceId)
  expect(layout).not.toBeNull()

  const tabBlockToRow = tab.blockToRow[trackId]?.[voiceId] ?? []
  const tabBlocksPerRow = tab.blocksPerRow[trackId]?.[voiceId] ?? []
  const tabBlockWidths = tab.finalBlockWidths[trackId]?.[voiceId] ?? []

  expect(layout!.rowLayouts.length).toBe(tabBlocksPerRow.length)
  expect(layout!.numRows).toBe(tabBlocksPerRow.length)

  for (let blockId = 0; blockId < tabBlockToRow.length; blockId += 1) {
    const tabBlock = tabBlockToRow[blockId]
    const modern = layout!.blockLayouts[blockId]
    expect(modern).toBeDefined()
    expect(tabBlock.rowId).toBe(modern!.rowId)
    expect(tabBlock.numInRow).toBe(modern!.numInRow)
    expect(tabBlockWidths[blockId]).toBe(modern!.width)
  }

  for (let rowId = 0; rowId < tabBlocksPerRow.length; rowId += 1) {
    const { start, end } = tabBlocksPerRow[rowId]
    for (let blockId = start; blockId < end; blockId += 1) {
      expect(layout!.blockLayouts[blockId]?.rowId).toBe(rowId)
    }
  }
}

export function assertBeatPositionsMatchLayout(trackId: number, voiceId: number): void {
  const layout = getTrackRenderLayout(trackId, voiceId)
  expect(layout).not.toBeNull()

  for (let blockId = 0; blockId < Song.measures[trackId].length; blockId += 1) {
    const beats = Song.measures[trackId][blockId][voiceId]
    const blockLayout = layout!.blockLayouts[blockId]
    expect(blockLayout).toBeDefined()

    for (let beatId = 0; beatId < beats.length; beatId += 1) {
      const storedBeatX = blockLayout!.beatPositions[beatId]
      expect(storedBeatX).toBeDefined()
      expect(Number.isFinite(storedBeatX)).toBe(true)

      const unified = getBeatPositionInRow({ trackId, voiceId, blockId, beatId })
      expect(unified).toBe(blockLayout!.xOffset + storedBeatX)

      const bridge = renderBridge.getPositionInRow(trackId, voiceId, blockId, beatId)
      expect(bridge).toBe(unified)
    }
  }
}
