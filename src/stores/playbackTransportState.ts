import { reactive, ref } from 'vue'
import Settings from './settingsState'
import { songState } from './songState'

export interface PlaybackTransportState {
  isPlaying: boolean
  isRecordingActive: boolean
  /** Record was pressed; recording starts with playback. */
  isRecordingArmed: boolean
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
  isRecordingArmed: false,
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

// What playback publishes for the transport bar, the playhead and the toolbar.
export function publishPlaybackTransport(update: Partial<typeof playbackTransportState>): void {
  Object.assign(playbackTransportState, update)
  bumpPlaybackTransportVersion()
}

export function publishPlaybackPosition(blockId: number, beatId: number, positionInBlock: number): void {
  publishPlaybackTransport({
    isPlaying: Settings.songPlaying,
    blockId,
    beatId,
    positionInBlock,
    trackId: songState.currentTrackId,
    voiceId: songState.currentVoiceId,
  })
}

export function publishPlaybackUiStarted(isRecording: boolean): void {
  publishPlaybackTransport({
    isPlaying: true,
    isRecordingActive: isRecording,
    showMenuBars: false,
    trackId: songState.currentTrackId,
    voiceId: songState.currentVoiceId,
  })
}

export function publishPlaybackUiStopped(): void {
  publishPlaybackTransport({
    isPlaying: false,
    isRecordingActive: false,
    showMenuBars: true,
    blockId: 0,
    beatId: 0,
    positionInBlock: 0,
    trackId: songState.currentTrackId,
    voiceId: songState.currentVoiceId,
  })
}

export function publishPlaybackStopped(): void {
  publishPlaybackUiStopped()
}
