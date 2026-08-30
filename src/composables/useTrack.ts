import { computed } from 'vue'
import { useEditorScopeState } from './useEditorScopeState'
import { useSongData } from './useSongData'
import { trackAdapter } from '../services/editor/trackAdapter'
import type { TrackViewModel } from '../types/track'

export type {
  TrackColor,
  TrackInstrumentSettings as TrackInstrument,
  TrackUpdate,
  TrackViewModel,
} from '../types/track'

export function useTrack() {
  const { reactiveSongData } = useSongData()
  const { currentTrackId, currentVoiceId } = useEditorScopeState()

  const tracks = computed<TrackViewModel[]>(() => trackAdapter.listTrackViewModels(
    reactiveSongData.tracks,
    reactiveSongData.playBackInstrument,
  ))

  const currentTrack = computed<TrackViewModel | null>(() => {
    return tracks.value[currentTrackId.value] || null
  })

  /**
   * Track count
   */
  const trackCount = computed(() => tracks.value.length)

  /**
   * Check if any track is soloed
   */
  const hasSoloedTrack = computed(() => {
    return tracks.value.some(t => t.isSolo)
  })

  /**
   * Select a track
   */
  function selectTrack(trackId: number): void {
    if (trackId >= 0 && trackId < trackCount.value) {
      trackAdapter.selectTrack(trackId)
    }
  }

  /**
   * Select a voice
   */
  function selectVoice(voiceId: number): void {
    if (voiceId >= 0 && voiceId < 4) {
      trackAdapter.selectVoice(voiceId)
    }
  }

  /**
   * Go to next track
   */
  function nextTrack(): void {
    if (currentTrackId.value < trackCount.value - 1) {
      selectTrack(currentTrackId.value + 1)
    }
  }

  /**
   * Go to previous track
   */
  function previousTrack(): void {
    if (currentTrackId.value > 0) {
      selectTrack(currentTrackId.value - 1)
    }
  }

  /**
   * Set track name
   */
  function setTrackName(trackId: number, name: string): void {
    trackAdapter.setTrackName(trackId, name)
  }

  /**
   * Set track volume
   */
  function setTrackVolume(trackId: number, volume: number): void {
    trackAdapter.setTrackVolume(trackId, volume)
  }

  /**
   * Set track balance (pan)
   */
  function setTrackBalance(trackId: number, balance: number): void {
    trackAdapter.setTrackBalance(trackId, balance)
  }

  /**
   * Toggle track mute
   */
  function toggleMute(trackId: number): void {
    trackAdapter.toggleMute(trackId)
  }

  /**
   * Toggle track solo
   */
  function toggleSolo(trackId: number): void {
    trackAdapter.toggleSolo(trackId)
  }

  /**
   * Set track instrument
   */
  function setInstrument(trackId: number, program: number | string): void {
    trackAdapter.setInstrument(trackId, program)
  }

  /**
   * Set track capo
   */
  function setCapo(trackId: number, capo: number): void {
    trackAdapter.setCapo(trackId, capo)
  }

  /**
   * Set track tuning
   */
  function setTuning(trackId: number, tuning: number[]): void {
    trackAdapter.setTuning(trackId, tuning)
  }

  /**
   * Set track color
   */
  function setTrackColor(trackId: number, color: import('../types/track').TrackColor): void {
    trackAdapter.setTrackColor(trackId, color)
  }

  /**
   * Get track color as CSS string
   */
  function getTrackColorCSS(trackId: number): string {
    return trackAdapter.getTrackColorCSS(trackId, tracks.value)
  }

  /**
   * Get track instrument settings
   */
  function getInstrumentSettings(trackId: number) {
    return trackAdapter.getInstrumentSettings(trackId)
  }

  /**
   * Check if a track should be audible (considering solo/mute states)
   */
  function isTrackAudible(trackId: number): boolean {
    return trackAdapter.isTrackAudible(trackId, tracks.value)
  }

  return {
    // State
    currentTrackId,
    currentVoiceId,
    tracks,
    currentTrack,
    trackCount,
    hasSoloedTrack,
    
    // Navigation
    selectTrack,
    selectVoice,
    nextTrack,
    previousTrack,
    
    // Track properties
    setTrackName,
    setTrackVolume,
    setTrackBalance,
    toggleMute,
    toggleSolo,
    setInstrument,
    setCapo,
    setTuning,
    setTrackColor,
    
    // Utilities
    getTrackColorCSS,
    getInstrumentSettings,
    isTrackAudible
  }
}
