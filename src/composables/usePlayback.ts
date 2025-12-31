/**
 * usePlayback Composable
 * 
 * Provides reactive playback state and controls for the guitar tab player.
 * Wraps the legacy playBackLogicNew.ts with a Vue 3 composition API interface.
 */

import { ref, computed, readonly } from 'vue'
import EventBus from '../assets/js/eventBus'

// =============================================================================
// Types
// =============================================================================

export interface PlaybackPosition {
  blockId: number
  beatId: number
  positionInBlock: number
}

export interface PlaybackState {
  isPlaying: boolean
  isPaused: boolean
  isLooping: boolean
  currentPosition: PlaybackPosition
  tempo: number
  volume: number
}

// =============================================================================
// Singleton State
// =============================================================================

const isPlaying = ref(false)
const isPaused = ref(false)
const isLooping = ref(false)
const currentBlockId = ref(0)
const currentBeatId = ref(0)
const tempo = ref(120)
const masterVolume = ref(0.8)
const metronomeEnabled = ref(false)
const countInEnabled = ref(false)

// =============================================================================
// Composable
// =============================================================================

export function usePlayback() {
  /**
   * Current playback position
   */
  const currentPosition = computed<PlaybackPosition>(() => ({
    blockId: currentBlockId.value,
    beatId: currentBeatId.value,
    positionInBlock: 0
  }))
  
  /**
   * Full playback state
   */
  const state = computed<PlaybackState>(() => ({
    isPlaying: isPlaying.value,
    isPaused: isPaused.value,
    isLooping: isLooping.value,
    currentPosition: currentPosition.value,
    tempo: tempo.value,
    volume: masterVolume.value
  }))
  
  /**
   * Start playback
   */
  async function play(): Promise<void> {
    if (isPlaying.value) return
    
    try {
      // Import dynamically to avoid circular dependencies
      const playBackLogicModule = await import('../assets/js/playBackLogicNew')
      const playBackLogic = playBackLogicModule.default
      playBackLogic.startPlayback()
      
      isPlaying.value = true
      isPaused.value = false
      
      EventBus.emit('playback.started')
    } catch (error) {
      console.error('Failed to start playback:', error)
    }
  }
  
  /**
   * Stop playback
   */
  async function stop(): Promise<void> {
    if (!isPlaying.value && !isPaused.value) return
    
    try {
      const playBackLogicModule = await import('../assets/js/playBackLogicNew')
      const playBackLogic = playBackLogicModule.default
      playBackLogic.stopSong()
      
      isPlaying.value = false
      isPaused.value = false
      currentBlockId.value = 0
      currentBeatId.value = 0
      
      EventBus.emit('playback.stopped')
    } catch (error) {
      console.error('Failed to stop playback:', error)
    }
  }
  
  /**
   * Pause playback
   */
  async function pause(): Promise<void> {
    if (!isPlaying.value || isPaused.value) return
    
    try {
      const playBackLogicModule = await import('../assets/js/playBackLogicNew')
      const playBackLogic = playBackLogicModule.default
      // Note: playBackLogic doesn't have a pause method, use stopSong instead
      playBackLogic.stopSong()
      
      isPlaying.value = false
      isPaused.value = true
      
      EventBus.emit('playback.paused')
    } catch (error) {
      console.error('Failed to pause playback:', error)
    }
  }
  
  /**
   * Resume from pause
   */
  async function resume(): Promise<void> {
    if (!isPaused.value) return
    await play()
  }
  
  /**
   * Toggle play/pause
   */
  async function togglePlayPause(): Promise<void> {
    if (isPlaying.value) {
      await pause()
    } else {
      await play()
    }
  }
  
  /**
   * Seek to a specific position
   */
  async function seekTo(blockId: number, beatId: number = 0): Promise<void> {
    try {
      const playBackLogicModule = await import('../assets/js/playBackLogicNew')
      const playBackLogic = playBackLogicModule.default
      // setPlayPosition(trackId, blockId, voiceId, beatId)
      playBackLogic.setPlayPosition(0, blockId, 0, beatId)
      
      currentBlockId.value = blockId
      currentBeatId.value = beatId
      
      EventBus.emit('playback.positionChanged', { blockId, beatId })
    } catch (error) {
      console.error('Failed to seek:', error)
    }
  }
  
  /**
   * Skip to next measure
   */
  async function nextMeasure(): Promise<void> {
    await seekTo(currentBlockId.value + 1, 0)
  }
  
  /**
   * Skip to previous measure
   */
  async function previousMeasure(): Promise<void> {
    if (currentBlockId.value > 0) {
      await seekTo(currentBlockId.value - 1, 0)
    }
  }
  
  /**
   * Set tempo
   */
  function setTempo(bpm: number): void {
    tempo.value = Math.max(20, Math.min(400, bpm))
  }
  
  /**
   * Set master volume
   */
  function setVolume(volume: number): void {
    masterVolume.value = Math.max(0, Math.min(1, volume))
  }
  
  /**
   * Toggle looping
   */
  function toggleLoop(): void {
    isLooping.value = !isLooping.value
  }
  
  /**
   * Toggle metronome
   */
  function toggleMetronome(): void {
    metronomeEnabled.value = !metronomeEnabled.value
  }
  
  /**
   * Toggle count-in
   */
  function toggleCountIn(): void {
    countInEnabled.value = !countInEnabled.value
  }
  
  /**
   * Update position (called from playback engine)
   */
  function updatePosition(blockId: number, beatId: number): void {
    currentBlockId.value = blockId
    currentBeatId.value = beatId
  }
  
  /**
   * Update playing state (called from playback engine)
   */
  function updatePlayingState(playing: boolean): void {
    isPlaying.value = playing
    if (!playing) {
      isPaused.value = false
    }
  }
  
  return {
    // State (readonly)
    isPlaying: readonly(isPlaying),
    isPaused: readonly(isPaused),
    isLooping: readonly(isLooping),
    currentPosition,
    state,
    tempo: readonly(tempo),
    masterVolume: readonly(masterVolume),
    metronomeEnabled: readonly(metronomeEnabled),
    countInEnabled: readonly(countInEnabled),
    
    // Actions
    play,
    stop,
    pause,
    resume,
    togglePlayPause,
    seekTo,
    nextMeasure,
    previousMeasure,
    setTempo,
    setVolume,
    toggleLoop,
    toggleMetronome,
    toggleCountIn,
    
    // Internal (for playback engine integration)
    updatePosition,
    updatePlayingState
  }
}
