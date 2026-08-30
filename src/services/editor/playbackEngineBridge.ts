import Settings from '../../assets/js/settingManager'
import { songState } from '../../stores/songState'
import {
  bumpPlaybackTransportVersion,
  playbackTransportState,
} from '../../composables/playbackTransportState'

export function publishPlaybackTransport(update: Partial<typeof playbackTransportState>): void {
  Object.assign(playbackTransportState, update)
  bumpPlaybackTransportVersion()
}

export function publishPlaybackPosition(
  blockId: number,
  beatId: number,
  positionInBlock: number,
): void {
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
