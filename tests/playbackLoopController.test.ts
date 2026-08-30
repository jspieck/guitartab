import { describe, expect, it } from 'vitest'
import {
  applyRepeatAlternativeSkip,
  buildLoopIntervalFromOverlays,
  didCrossLoopBoundary,
  getEffectiveBlockLengthForLoop,
  resolveNextBlockAfterCurrent,
  shouldTruncateNoteAtLoopEnd,
} from '../src/services/playbackLoopController'

describe('playbackLoopController', () => {
  it('builds a forward loop interval from overlay positions', () => {
    const interval = buildLoopIntervalFromOverlays(
      {
        trackId: 0,
        blockId: 2,
        voiceId: 0,
        beatId: 1,
        abstractTimePos: 0.25,
      },
      {
        trackId: 0,
        blockId: 4,
        voiceId: 0,
        beatId: 0,
        abstractTimePos: 0.5,
      },
      () => 16,
      64,
    )

    expect(interval).toEqual({
      trackId: 0,
      startBlock: 2,
      startBeat: 1,
      startRatio: 0.25,
      endBlock: 4,
      endBeat: 0,
      endRatio: 0.5,
    })
  })

  it('normalizes a reversed selection into start/end order', () => {
    const interval = buildLoopIntervalFromOverlays(
      {
        trackId: 0,
        blockId: 5,
        voiceId: 0,
        beatId: 2,
        abstractTimePos: 0.75,
      },
      {
        trackId: 0,
        blockId: 2,
        voiceId: 0,
        beatId: 0,
        abstractTimePos: 0.25,
      },
      () => 16,
      64,
    )

    expect(interval.startBlock).toBe(2)
    expect(interval.endBlock).toBe(5)
    expect(interval.startRatio).toBe(0)
    expect(interval.endRatio).toBe(1)
  })

  it('wraps from loop end block to loop start block', () => {
    const loopInterval = {
      trackId: 0,
      startBlock: 2,
      startBeat: 0,
      startRatio: 0,
      endBlock: 5,
      endBeat: 3,
      endRatio: 1,
    }

    const result = resolveNextBlockAfterCurrent(
      5,
      1,
      loopInterval,
      [],
      {},
    )

    expect(result.nextBlock).toBe(2)
    expect(result.playingIteration).toBe(1)
  })

  it('uses tab repeat jump when no loop is active', () => {
    const measureMeta = [{
      repeatClosePresent: true,
      repeatClose: 2,
    }, {}, {}]
    const result = resolveNextBlockAfterCurrent(
      0,
      1,
      null,
      measureMeta,
      { 0: 0 },
    )

    expect(result.nextBlock).toBe(0)
    expect(result.playingIteration).toBe(2)
  })

  it('skips repeat-alternative sections that do not match the iteration', () => {
    const measureMeta = [
      {},
      { repeatAlternative: 0b10 },
      { repeatAlternative: 0b01 },
    ]

    expect(applyRepeatAlternativeSkip(1, 1, measureMeta)).toBe(2)
  })

  it('truncates effective block length at the loop end', () => {
    const loopInterval = {
      trackId: 0,
      startBlock: 1,
      startBeat: 0,
      startRatio: 0,
      endBlock: 3,
      endBeat: 2,
      endRatio: 0.75,
    }

    expect(getEffectiveBlockLengthForLoop(3, loopInterval, 1)).toBe(0.75)
    expect(getEffectiveBlockLengthForLoop(2, loopInterval, 1)).toBe(1)
  })

  it('detects note truncation at loop end boundary', () => {
    const loopInterval = {
      trackId: 0,
      startBlock: 1,
      startBeat: 0,
      startRatio: 0,
      endBlock: 3,
      endBeat: 2,
      endRatio: 0.75,
    }

    expect(shouldTruncateNoteAtLoopEnd(3, 0.5, 0.3, loopInterval)).toBe(true)
    expect(shouldTruncateNoteAtLoopEnd(3, 0.5, 0.1, loopInterval)).toBe(false)
  })

  it('detects loop boundary crossings for playback bar jumps', () => {
    const loopInterval = {
      trackId: 0,
      startBlock: 2,
      startBeat: 0,
      startRatio: 0,
      endBlock: 5,
      endBeat: 0,
      endRatio: 1,
    }

    expect(didCrossLoopBoundary(5, 2, loopInterval)).toBe(true)
    expect(didCrossLoopBoundary(5, 6, loopInterval)).toBe(false)
    expect(didCrossLoopBoundary(4, 2, loopInterval)).toBe(false)
  })
})
