import { reactive, ref } from 'vue'
import type { PlaybackLoopInterval } from '../services/playbackLoopController'

export interface PlaybackLoopState {
  active: boolean
  trackId: number
  startBlock: number
  startBeat: number
  startRatio: number
  endBlock: number
  endBeat: number
  endRatio: number
}

export const playbackLoopState = reactive<PlaybackLoopState>({
  active: false,
  trackId: 0,
  startBlock: 0,
  startBeat: 0,
  startRatio: 0,
  endBlock: 0,
  endBeat: 0,
  endRatio: 0,
})

export const playbackLoopVersion = ref(0)

export function bumpPlaybackLoopVersion(): void {
  playbackLoopVersion.value += 1
}

export function syncPlaybackLoopFromInterval(interval: PlaybackLoopInterval | null): void {
  if (interval == null) {
    playbackLoopState.active = false
  } else {
    Object.assign(playbackLoopState, { active: true, ...interval })
  }
  bumpPlaybackLoopVersion()
}
