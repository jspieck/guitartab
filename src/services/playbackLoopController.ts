/**
 * Pure loop-interval logic (the bar order itself is `playback/playOrder.ts`).
 */

export interface LoopOverlayPosition {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  abstractTimePos: number
}

export interface PlaybackLoopInterval {
  trackId: number
  startBlock: number
  startBeat: number
  startRatio: number
  endBlock: number
  endBeat: number
  endRatio: number
}

export function buildLoopIntervalFromOverlays(
  start: LoopOverlayPosition,
  end: LoopOverlayPosition,
  getBeatDuration: (trackId: number, blockId: number, voiceId: number, beatId: number) => number,
  wholeRestDuration: number,
): PlaybackLoopInterval {
  const { trackId, blockId: blockIdStart, voiceId: voiceIdStart, beatId: beatIdStart } = start
  const { blockId: blockEnd, voiceId: voiceEnd, beatId: beatEnd } = end

  if (blockIdStart > blockEnd || (blockIdStart === blockEnd && beatIdStart > beatEnd)) {
    const durEnd = getBeatDuration(trackId, blockEnd, voiceEnd, beatEnd)
    const startRatio = end.abstractTimePos - durEnd / wholeRestDuration
    const durStart = getBeatDuration(trackId, blockIdStart, voiceIdStart, beatIdStart)
    const endRatio = start.abstractTimePos + durStart / wholeRestDuration
    return {
      trackId,
      startBlock: blockEnd,
      startBeat: beatEnd,
      startRatio,
      endBlock: blockIdStart,
      endBeat: beatIdStart,
      endRatio,
    }
  }

  return {
    trackId,
    startBlock: start.blockId,
    startBeat: start.beatId,
    startRatio: start.abstractTimePos,
    endBlock: end.blockId,
    endBeat: end.beatId,
    endRatio: end.abstractTimePos,
  }
}

export function getEffectiveBlockLengthForLoop(
  blockId: number,
  loopInterval: PlaybackLoopInterval | null,
  measureLength: number,
): number {
  if (loopInterval != null && loopInterval.endBlock === blockId) {
    return loopInterval.endRatio
  }
  return measureLength
}

export function shouldTruncateNoteAtLoopEnd(
  blockId: number,
  currentRatio: number,
  noteDurationInRatio: number,
  loopInterval: PlaybackLoopInterval | null,
): boolean {
  if (loopInterval == null || loopInterval.endBlock !== blockId) {
    return false
  }
  return loopInterval.endRatio <= currentRatio + noteDurationInRatio
}

export function didCrossLoopBoundary(
  previousBlock: number,
  nextBlock: number,
  loopInterval: PlaybackLoopInterval | null,
): boolean {
  if (loopInterval == null) {
    return false
  }
  return previousBlock === loopInterval.endBlock && nextBlock === loopInterval.startBlock
}
