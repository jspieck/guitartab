import { reactive, ref } from 'vue'

export interface PlaybackTransportState {
  isPlaying: boolean
  isRecordingActive: boolean
  showMenuBars: boolean
  trackId: number
  voiceId: number
  blockId: number
  beatId: number
  positionInBlock: number
}

export const playbackTransportState = reactive<PlaybackTransportState>({
  isPlaying: false,
  isRecordingActive: false,
  showMenuBars: true,
  trackId: 0,
  voiceId: 0,
  blockId: 0,
  beatId: 0,
  positionInBlock: 0,
})

export const playbackTransportVersion = ref(0)

export function bumpPlaybackTransportVersion(): void {
  playbackTransportVersion.value += 1
}
