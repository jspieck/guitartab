import { describe, expect, it, vi } from 'vitest'

// Columns: eighth at 0 (20 wide), half at 20 (80 wide); minOffset 20 per eighth.
vi.mock('../src/utils/beatPositionInRow', () => ({
  getBeatPositionInRow: (_track: number, _voice: number, _block: number, beat: number) => [0, 20][beat],
}))

vi.mock('../src/stores/tabRenderLayout', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/stores/tabRenderLayout')>()),
  getBlockRenderLayout: () => ({ minOffset: 20, beatPositions: [0, 20] }),
}))

vi.mock('../src/stores/song', async () => {
  const { createSongMock } = await import('./helpers/songMock')
  return {
    default: createSongMock({ measures: [[[[{ duration: 'e' }, { duration: 'h' }]]]] }),
  }
})

import renderBridge from '../src/services/editor/renderBridge'

describe('playhead position', () => {
  it('stands on the fret digits: centred in short beats, a quarter in for longer ones', () => {
    // (minus half the playhead's 2 px width); the half note's digits sit where a quarter's would
    // (20 px = half a quarter's 40 px column), not in the middle of its 80 px column
    expect(renderBridge.getPlayheadXInRow(0, 0, 0, 0)).toBe(10 - 1)
    expect(renderBridge.getPlayheadXInRow(0, 0, 0, 1)).toBe(20 + 20 - 1)
  })
})
