export type { BeatLocation } from './tab'
import type { BeatLocation } from './tab'

export interface PlaybackInterpolationInput {
  jumpToNewPos: boolean
  lastNextPos: number
  lastCurrentPos: number
  lastTime: number
  lastTransformTime: number
  currentTime: number
}

export interface PlaybackRowContext {
  rowId: number
  nextRowId: number
}

export interface PlaybackBeatTransition {
  current: BeatLocation
  next: BeatLocation
  rows: PlaybackRowContext
}
