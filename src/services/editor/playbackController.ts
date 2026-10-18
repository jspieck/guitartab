import Song from '../../assets/js/songData'
import Settings from '../../assets/js/settingManager'
import AppManager from '../../assets/js/appManager'
import Helper from '../../assets/js/helper'
import { audioEngine } from '../../assets/js/audioEngine'
import { tab } from '../../assets/js/tab'
import renderBridge from './renderBridge'
import {
  hasRegisteredPlaybackBar,
  hidePlaybackBar,
  isPlaybackBarVisible,
  setPlaybackBarPosition,
  showPlaybackBar,
} from '../../composables/usePlaybackBarState'
import { getPositionMarkerHeight } from './tabLayoutMetrics'
import {
  resolveCurrentPlaybackPos,
  resolveNextPlaybackXPos,
} from './playbackPositionResolver'

let lastPlayBackBarPageId = -1
let lastCurrentPos = 0
let lastNextPos = 0
let lastTime = 0
let lastTransformTime = 0
let jumpToNewPos = true

export function hidePlayBackBars(): void {
  if (hasRegisteredPlaybackBar()) {
    hidePlaybackBar()
  }
}

export function initPlayBackParameters(): void {
  jumpToNewPos = true
  lastCurrentPos = 0
  lastNextPos = 0
  lastTime = 0
  lastTransformTime = 0
  lastPlayBackBarPageId = -1
}

export function hasBeenJumped(): boolean {
  return jumpToNewPos
}

export function setJumped(): void {
  jumpToNewPos = true
}

function movePlayBackBarToXPos(
  trackId: number,
  blockId: number,
  voiceId: number,
  pageId: number,
  xPos: number,
  timing: number,
): void {
  if (AppManager.duringTrackCreation) {
    return
  }

  const useReactivePlaybackBar = hasRegisteredPlaybackBar()
  const rowId = tab.blockToRow[trackId]?.[voiceId]?.[blockId]?.rowId
  if (rowId == null) {
    return
  }

  if (Settings.songPlaying
    && (lastPlayBackBarPageId !== pageId
      || (useReactivePlaybackBar && !isPlaybackBarVisible()))) {
    hidePlayBackBars()

    if (useReactivePlaybackBar) {
      showPlaybackBar()
    }

    lastPlayBackBarPageId = pageId
  }

  const rowY = renderBridge.getRowY(trackId, voiceId, rowId)
  if (rowY === 0 && renderBridge.getRowIdForBlock(trackId, voiceId, blockId) == null) {
    return
  }

  // The bar spans the whole row (tab and, when shown, its classical staff).
  const yPos = rowY

  if (useReactivePlaybackBar) {
    setPlaybackBarPosition(xPos, yPos, timing)
  }
}

export function movePlayBackBarToPosInBlock(
  trackId: number,
  blockId: number,
  voiceId: number,
  posInBlock: number,
  timing: number,
): void {
  const blockLayout = renderBridge.getBlockLayout(trackId, voiceId, blockId)
  if (!blockLayout) {
    return
  }

  const pageId = blockLayout.pageId
  const leftOffset = Helper.getLeftOffset(blockId)
  let xPos = renderBridge.getBlockX(trackId, voiceId, blockId) + leftOffset + 5

  const timeQuotient = Song.measureMeta[blockId].numerator
    / Song.measureMeta[blockId].denominator
  const posPercentage = posInBlock / (64 * timeQuotient)
  const blockWidth = renderBridge.getBlockWidth(trackId, voiceId, blockId)

  xPos += (blockWidth - leftOffset) * posPercentage
  movePlayBackBarToXPos(trackId, blockId, voiceId, pageId, xPos, timing)
}

export function movePlayBackBarToBeat(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  timing: number,
): void {
  if (blockId >= Song.measures[trackId].length) {
    return
  }

  const pageId = renderBridge.getBlockLayout(trackId, voiceId, blockId)?.pageId ?? 0
  const xPos = renderBridge.getPositionInRow(trackId, voiceId, blockId, beatId) + 5
  movePlayBackBarToXPos(trackId, blockId, voiceId, pageId, xPos, timing)
}

export function movePlayBackBarToPosition(
  trackId: number,
  nextBlockId: number,
  voiceId: number,
  nextBeatId: number,
  timing: number,
  longerFactor: number,
  currentBlockId: number,
  currentBeatId: number,
): void {
  if (AppManager.duringTrackCreation) {
    return
  }

  const pageId = renderBridge.getBlockLayout(trackId, voiceId, currentBlockId)?.pageId
  if (pageId == null) {
    return
  }

  const currentTime = audioEngine.getCurrentTime()
  const resolvedCurrent = resolveCurrentPlaybackPos(
    { trackId, voiceId, blockId: currentBlockId, beatId: currentBeatId },
    {
      jumpToNewPos,
      lastNextPos,
      lastCurrentPos,
      lastTime,
      lastTransformTime,
      currentTime,
    },
  )
  jumpToNewPos = resolvedCurrent.jumpToNewPos
  const currentPos = resolvedCurrent.currentPos

  const useReactivePlaybackBar = hasRegisteredPlaybackBar()
  if (lastPlayBackBarPageId !== pageId) {
    hidePlayBackBars()

    if (useReactivePlaybackBar) {
      showPlaybackBar()
    }

    lastPlayBackBarPageId = pageId
  }

  const rowId = tab.blockToRow[trackId]?.[voiceId]?.[currentBlockId]?.rowId
  if (rowId == null) {
    return
  }

  let nextRowId = -1
  if (nextBlockId < Song.measures[trackId].length) {
    nextRowId = tab.blockToRow[trackId][voiceId][nextBlockId].rowId
  }

  const resolvedNext = resolveNextPlaybackXPos({
    current: { trackId, voiceId, blockId: currentBlockId, beatId: currentBeatId },
    next: { trackId, voiceId, blockId: nextBlockId, beatId: nextBeatId },
    rows: { rowId, nextRowId },
  })
  jumpToNewPos = resolvedNext.jumpToNewPos ? true : jumpToNewPos
  const nextXPos = resolvedNext.nextXPos

  const transformedNextXPos = currentPos + (nextXPos - currentPos) * longerFactor
  const transformedTiming = (timing * longerFactor) / 1000

  if (!isFinite(transformedNextXPos) || !isFinite(transformedTiming)) {
    jumpToNewPos = true
    return
  }

  movePlayBackBarToXPos(trackId, currentBlockId, voiceId, pageId, transformedNextXPos, transformedTiming)

  lastTime = currentTime
  lastCurrentPos = currentPos
  lastNextPos = transformedNextXPos
  lastTransformTime = transformedTiming
}

export function getPositionMarkerHeightForTrack(trackId: number): number {
  return getPositionMarkerHeight(trackId)
}
