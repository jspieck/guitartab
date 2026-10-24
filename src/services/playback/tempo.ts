import { getPlaybackRate } from '../../stores/practiceState'
import { secondsPerWhole, wholesPerSecond } from '../practiceTiming'

/** Seconds per whole note at the effective (practice-speed adjusted) tempo. */
export function spw(bpm: number): number {
  return secondsPerWhole(bpm, getPlaybackRate())
}

/** Whole notes per second at the effective (practice-speed adjusted) tempo. */
export function wps(bpm: number): number {
  return wholesPerSecond(bpm, getPlaybackRate())
}
