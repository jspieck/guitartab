/**
 * Pure loop-interval and block-sequence logic extracted from overlay/playback code.
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

export interface MeasureMetaSlice {
  repeatClose?: number
  repeatAlternative?: number | null
  repeatOpen?: boolean
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

export function resolveNextBlockAfterCurrent(
  currentBlock: number,
  playingIteration: number,
  loopInterval: PlaybackLoopInterval | null,
  measureMeta: MeasureMetaSlice[],
  jumpBackPositions: Record<number, number | null | undefined>,
): { nextBlock: number; playingIteration: number } {
  let nextBlock: number
  let newPlayingIteration = playingIteration

  if (loopInterval != null && currentBlock === loopInterval.endBlock) {
    nextBlock = loopInterval.startBlock
  } else if (
    measureMeta[currentBlock]?.repeatClose != null &&
    measureMeta[currentBlock].repeatClose! >= playingIteration
  ) {
    nextBlock = jumpBackPositions[currentBlock] ?? 0
    newPlayingIteration = playingIteration + 1
  } else {
    nextBlock = currentBlock + 1
  }

  nextBlock = applyRepeatAlternativeSkip(nextBlock, newPlayingIteration, measureMeta)

  if (measureMeta[nextBlock]?.repeatOpen && currentBlock < nextBlock) {
    newPlayingIteration = 1
  }

  return { nextBlock, playingIteration: newPlayingIteration }
}

export function applyRepeatAlternativeSkip(
  nextBlock: number,
  playingIteration: number,
  measureMeta: MeasureMetaSlice[],
): number {
  if (measureMeta[nextBlock]?.repeatAlternative == null) {
    return nextBlock
  }

  const bitP = (measureMeta[nextBlock].repeatAlternative! >> (playingIteration - 1)) & 1
  if (bitP !== 0) {
    return nextBlock
  }

  for (let j = 1; j < 50; j += 1) {
    if (measureMeta[nextBlock + j] == null) {
      break
    }
    const alternative = measureMeta[nextBlock + j].repeatAlternative
    if (alternative != null && ((alternative >> (playingIteration - 1)) & 1) === 1) {
      return nextBlock + j
    }
  }

  return nextBlock
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
