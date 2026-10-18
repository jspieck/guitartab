import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/editor/renderBridge', () => ({
  default: {
    getPositionInRow: () => 100,
  },
}))

vi.mock('../src/assets/js/tab', () => ({
  tab: {
    measureOffset: [[[[10]]]],
  },
}))

vi.mock('../src/assets/js/songData', async () => {
  const { createSongMock } = await import('./helpers/songMock')
  return {
    default: createSongMock({ measures: [[[[{ duration: 'e' }, { duration: 'e' }, { duration: 'e' }]]]] }),
  }
})

import {
  resolveCurrentPlaybackPos,
  resolveNextPlaybackXPos,
} from '../src/services/editor/playbackPositionResolver'

const scope = { trackId: 0, voiceId: 0 }

describe('playbackPositionResolver', () => {
  it('clears the jump flag after snapping to the current beat', () => {
    const result = resolveCurrentPlaybackPos(
      { ...scope, blockId: 2, beatId: 1 },
      {
        jumpToNewPos: true,
        lastNextPos: 120,
        lastCurrentPos: 80,
        lastTime: 0,
        lastTransformTime: 0,
        currentTime: 1,
      },
    )

    expect(result.jumpToNewPos).toBe(false)
    expect(result.currentPos).toBe(100)
  })

  it('flags a within-row jump when the next beat is not sequential', () => {
    const result = resolveNextPlaybackXPos({
      current: { ...scope, blockId: 0, beatId: 0 },
      next: { ...scope, blockId: 0, beatId: 2 },
      rows: { rowId: 0, nextRowId: 0 },
    })

    expect(result.jumpToNewPos).toBe(true)
    expect(result.nextXPos).toBeGreaterThan(100)
  })
})
