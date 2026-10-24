import { tabLayout } from '../../stores/tabLayoutState'
import Duration from '../../utils/duration'
import Song from '../../stores/song'
import type { BeatLocation, PlaybackBeatTransition, PlaybackInterpolationInput } from '../../types/playback'
import renderBridge from './renderBridge'

export function resolveCurrentPlaybackPos(
  location: BeatLocation,
  interpolation: PlaybackInterpolationInput,
): { currentPos: number; jumpToNewPos: boolean } {
  const { jumpToNewPos, lastNextPos, lastCurrentPos, lastTime, lastTransformTime, currentTime } =
    interpolation
  const { trackId, voiceId, blockId, beatId } = location

  if (jumpToNewPos) {
    return {
      currentPos: renderBridge.getPositionInRow(trackId, voiceId, blockId, beatId),
      jumpToNewPos: false,
    }
  }

  if (!isFinite(lastTransformTime) || lastTransformTime <= 0) {
    return {
      currentPos: isFinite(lastNextPos)
        ? lastNextPos
        : renderBridge.getPositionInRow(trackId, voiceId, blockId, beatId),
      jumpToNewPos,
    }
  }

  return {
    currentPos:
      lastCurrentPos + (lastNextPos - lastCurrentPos) * ((currentTime - lastTime) / lastTransformTime),
    jumpToNewPos,
  }
}

function shouldJumpPlaybackWithinRow(transition: PlaybackBeatTransition): boolean {
  const { current, next, rows } = transition
  return (
    rows.rowId !== rows.nextRowId ||
    (current.blockId === next.blockId && next.beatId !== current.beatId + 1) ||
    (current.blockId !== next.blockId && (next.beatId !== 0 || current.blockId + 1 !== next.blockId))
  )
}

export function resolveNextPlaybackXPos(transition: PlaybackBeatTransition): {
  nextXPos: number
  jumpToNewPos: boolean
} {
  const { current, next } = transition
  const { trackId, voiceId } = current

  let nextXPos = 0
  if (next.blockId < Song.measures[trackId].length) {
    nextXPos = renderBridge.getPositionInRow(trackId, voiceId, next.blockId, next.beatId)
  }

  if (shouldJumpPlaybackWithinRow(transition)) {
    nextXPos = renderBridge.getPositionInRow(trackId, voiceId, current.blockId, current.beatId)
    nextXPos +=
      tabLayout.measureOffset[trackId][current.blockId][voiceId] *
      Duration.getDurationWidth(
        Song.getBeat({ trackId, blockId: current.blockId, voiceId, beatId: current.beatId }),
      )
    return { nextXPos, jumpToNewPos: true }
  }

  return { nextXPos, jumpToNewPos: false }
}
