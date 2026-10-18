import { computed } from 'vue'
import Settings from '../assets/js/settingManager'
import { songState } from '../stores/songState'
import {
  playbackTransportState,
  playbackTransportVersion,
  type PlaybackTransportState,
} from './playbackTransportState'

export interface PlaybackPosition {
  blockId: number
  beatId: number
  positionInBlock: number
}

export type { PlaybackTransportState }

async function getPlaybackEngine() {
  const module = await import('../assets/js/playBackLogicNew')
  return module.default
}

export function usePlaybackEngine() {
  const transport = computed(() => {
    void playbackTransportVersion.value
    return playbackTransportState
  })

  const isPlaying = computed(() => transport.value.isPlaying)
  const currentPosition = computed<PlaybackPosition>(() => ({
    blockId: transport.value.blockId,
    beatId: transport.value.beatId,
    positionInBlock: transport.value.positionInBlock,
  }))

  async function play(): Promise<void> {
    const playBackLogic = await getPlaybackEngine()
    playBackLogic.playSongB()
  }

  async function stop(): Promise<void> {
    const playBackLogic = await getPlaybackEngine()
    playBackLogic.stopSong()
  }

  async function togglePlay(): Promise<void> {
    await play()
  }

  async function stepBackward(): Promise<void> {
    const playBackLogic = await getPlaybackEngine()
    playBackLogic.moveOneBackward()
  }

  async function stepForward(): Promise<void> {
    const playBackLogic = await getPlaybackEngine()
    playBackLogic.moveOneForward()
  }

  async function seekTo(blockId: number, beatId = 0, positionInBlock = 0): Promise<void> {
    const playBackLogic = await getPlaybackEngine()
    playBackLogic.jumpToPosition(blockId, positionInBlock, beatId)
  }

  async function setPlayhead(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
  ): Promise<void> {
    const playBackLogic = await getPlaybackEngine()
    playBackLogic.setPlayPosition(trackId, blockId, voiceId, beatId)
  }

  /** Running playback continues from this beat; when stopped, playback will start there. */
  async function jumpToBeat(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
  ): Promise<void> {
    const playBackLogic = await getPlaybackEngine()
    playBackLogic.jumpToBeat(trackId, blockId, voiceId, beatId)
  }

  function getPlayingState(): boolean {
    return Settings.songPlaying
  }

  return {
    transport,
    isPlaying,
    currentPosition,
    currentTrackId: computed(() => songState.currentTrackId),
    currentVoiceId: computed(() => songState.currentVoiceId),
    play,
    stop,
    togglePlay,
    stepBackward,
    stepForward,
    seekTo,
    setPlayhead,
    jumpToBeat,
    getPlayingState,
  }
}
