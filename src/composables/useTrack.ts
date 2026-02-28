import { ref, computed, readonly, watch } from 'vue'
import Song from '../assets/js/songData'
import EventBus from '../assets/js/eventBus'

export interface TrackColor {
  red: number
  green: number
  blue: number
}

export interface TrackViewModel {
  id: number
  name: string
  numStrings: number
  tuning: number[]
  capo: number
  color: TrackColor
  instrument: string
  volume: number
  balance: number
  reverb: number
  isMuted: boolean
  isSolo: boolean
}

export interface TrackInstrument {
  instrument: string
  solo: boolean
  mute: boolean
  volume: number
  tremolo: number
  reverb: number
  chorus: number
  phaser: number
  balance: number
}

const currentTrackId = ref(0)
const currentVoiceId = ref(0)

export function useTrack() {
  const tracks = computed<TrackViewModel[]>(() => {
    return (Song.tracks || []).map((track: any, index: number) => ({
      id: index,
      name: track.name || `Track ${index + 1}`,
      numStrings: track.numStrings || 6,
      tuning: track.strings || track.tuning || [],
      capo: track.capo || 0,
      color: track.color || { red: 255, green: 0, blue: 0 },
      instrument: Song.playBackInstrument?.[index]?.instrument || 'guitar',
      volume: Song.playBackInstrument?.[index]?.volume || 100,
      balance: Song.playBackInstrument?.[index]?.balance || 64,
      reverb: Song.playBackInstrument?.[index]?.reverb || 0,
      isMuted: Song.playBackInstrument?.[index]?.mute || false,
      isSolo: Song.playBackInstrument?.[index]?.solo || false
    }))
  })
  
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
      currentTrackId.value = trackId
      Song.currentTrackId = trackId
      EventBus.emit('ui.trackChanged', trackId)
    }
  }
  
  /**
   * Select a voice
   */
  function selectVoice(voiceId: number): void {
    if (voiceId >= 0 && voiceId < 4) { // Typically 4 voices max
      currentVoiceId.value = voiceId
      EventBus.emit('ui.voiceChanged', voiceId)
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
    if (Song.tracks?.[trackId]) {
      Song.tracks[trackId].name = name
      EventBus.emit('song-data-changed')
    }
  }
  
  /**
   * Set track volume
   */
  function setTrackVolume(trackId: number, volume: number): void {
    if (Song.playBackInstrument?.[trackId]) {
      Song.playBackInstrument[trackId].volume = Math.max(0, Math.min(127, volume))
    }
  }
  
  /**
   * Set track balance (pan)
   */
  function setTrackBalance(trackId: number, balance: number): void {
    if (Song.playBackInstrument?.[trackId]) {
      Song.playBackInstrument[trackId].balance = Math.max(0, Math.min(127, balance))
    }
  }
  
  /**
   * Toggle track mute
   */
  function toggleMute(trackId: number): void {
    if (Song.playBackInstrument?.[trackId]) {
      Song.playBackInstrument[trackId].mute = !Song.playBackInstrument[trackId].mute
    }
  }
  
  /**
   * Toggle track solo
   */
  function toggleSolo(trackId: number): void {
    if (Song.playBackInstrument?.[trackId]) {
      Song.playBackInstrument[trackId].solo = !Song.playBackInstrument[trackId].solo
    }
  }
  
  /**
   * Set track instrument
   */
  function setInstrument(trackId: number, instrument: string): void {
    if (Song.playBackInstrument?.[trackId]) {
      Song.playBackInstrument[trackId].instrument = instrument
    }
  }
  
  /**
   * Set track capo
   */
  function setCapo(trackId: number, capo: number): void {
    if (Song.tracks?.[trackId]) {
      Song.tracks[trackId].capo = Math.max(0, Math.min(24, capo))
      EventBus.emit('song-data-changed')
    }
  }
  
  /**
   * Set track tuning
   */
  function setTuning(trackId: number, tuning: number[]): void {
    if (Song.tracks?.[trackId]) {
      Song.tracks[trackId].strings = tuning
      EventBus.emit('song-data-changed')
    }
  }
  
  /**
   * Set track color
   */
  function setTrackColor(trackId: number, color: TrackColor): void {
    if (Song.tracks?.[trackId]) {
      Song.tracks[trackId].color = color
      EventBus.emit('song-data-changed')
    }
  }
  
  /**
   * Get track color as CSS string
   */
  function getTrackColorCSS(trackId: number): string {
    const track = tracks.value[trackId]
    if (!track) return 'rgb(255, 0, 0)'
    return `rgb(${track.color.red}, ${track.color.green}, ${track.color.blue})`
  }
  
  /**
   * Get track instrument settings
   */
  function getInstrumentSettings(trackId: number): TrackInstrument | null {
    const settings = Song.playBackInstrument?.[trackId]
    if (!settings) return null
    
    return {
      instrument: settings.instrument || 'guitar',
      solo: settings.solo || false,
      mute: settings.mute || false,
      volume: settings.volume || 100,
      tremolo: settings.tremolo || 0,
      reverb: settings.reverb || 0,
      chorus: settings.chorus || 0,
      phaser: settings.phaser || 0,
      balance: settings.balance || 64
    }
  }
  
  /**
   * Check if a track should be audible (considering solo/mute states)
   */
  function isTrackAudible(trackId: number): boolean {
    const track = tracks.value[trackId]
    if (!track) return false
    
    if (track.isMuted) return false
    if (hasSoloedTrack.value && !track.isSolo) return false
    
    return true
  }
  
  return {
    // State
    currentTrackId: readonly(currentTrackId),
    currentVoiceId: readonly(currentVoiceId),
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
