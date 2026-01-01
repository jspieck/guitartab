import { reactive, ref, watch } from 'vue'
import Song from '../assets/js/songData'
import EventBus from '../assets/js/eventBus'

// SINGLETON STATE
const songDataVersion = ref(0)
const reactiveSongData = reactive({
  measures: Song.measures,
  songDescription: Song.songDescription,
  tracks: Song.tracks,
  measureMeta: Song.measureMeta,
  playBackInstrument: Song.playBackInstrument,
  currentTrackId: Song.currentTrackId,
  currentVoiceId: Song.currentVoiceId
})

/**
 * Composable for managing reactive song data
 * Bridges the gap between Vue reactivity and the legacy Song object
 */
export function useSongData() {
  /**
   * Sync Song data to reactive proxy
   * Creates a deep copy to ensure Vue reactivity detects changes
   */
  function syncSongData() {
    reactiveSongData.measures = JSON.parse(JSON.stringify(Song.measures))
    reactiveSongData.songDescription = JSON.parse(JSON.stringify(Song.songDescription))
    reactiveSongData.tracks = JSON.parse(JSON.stringify(Song.tracks))
    reactiveSongData.measureMeta = JSON.parse(JSON.stringify(Song.measureMeta))
    reactiveSongData.playBackInstrument = JSON.parse(JSON.stringify(Song.playBackInstrument))
    reactiveSongData.currentTrackId = Song.currentTrackId
    reactiveSongData.currentVoiceId = Song.currentVoiceId
    songDataVersion.value++
  }

  /**
   * Get measures for a specific track and voice
   */
  function getMeasures(trackId: number, voiceId: number) {
    const measures = reactiveSongData.measures?.[trackId] || []
    return measures.map((block: any) => block?.[voiceId] || [])
  }
  
  /**
   * Get a specific beat from the song
   */
  function getBeat(trackId: number, blockId: number, voiceId: number, beatIndex: number) {
    return Song.measures?.[trackId]?.[blockId]?.[voiceId]?.[beatIndex]
  }
  
  /**
   * Get a specific note from the song
   */
  function getNote(trackId: number, blockId: number, voiceId: number, beatIndex: number, stringIndex: number) {
    const beat = getBeat(trackId, blockId, voiceId, beatIndex)
    return beat?.notes?.[stringIndex]
  }
  
  /**
   * Set a note at a specific position
   */
  function setNote(
    trackId: number, 
    blockId: number, 
    voiceId: number, 
    beatIndex: number, 
    stringIndex: number, 
    fretNumber: number
  ) {
    // Ensure the measure structure exists
    if (!Song.measures[trackId]) {
      Song.measures[trackId] = []
    }
    if (!Song.measures[trackId][blockId]) {
      Song.measures[trackId][blockId] = []
    }
    if (!Song.measures[trackId][blockId][voiceId]) {
      Song.measures[trackId][blockId][voiceId] = []
    }
    if (!Song.measures[trackId][blockId][voiceId][beatIndex]) {
      Song.measures[trackId][blockId][voiceId][beatIndex] = {
        ...Song.defaultMeasure(),
        duration: 'q'
      }
    }
    
    const beat = Song.measures[trackId][blockId][voiceId][beatIndex]
    
    // Ensure notes array exists
    if (!beat.notes) {
      beat.notes = new Array(6).fill(null)
    }
    
    if (fretNumber === -1) {
      // Remove note
      beat.notes[stringIndex] = null
    } else {
      // Set note
      beat.notes[stringIndex] = {
        ...Song.defaultNote(),
        fret: fretNumber,
        string: stringIndex
      }
    }
    
    // Sync and notify
    syncSongData()
    
    // Dispatch event for other components
    const event = new CustomEvent('songDataChanged', {
      detail: { trackId, blockId, voiceId, beatIndex, stringIndex, fretNumber }
    })
    window.dispatchEvent(event)
  }
  
  return {
    reactiveSongData,
    songDataVersion,
    syncSongData,
    getMeasures,
    getBeat,
    getNote,
    setNote
  }
}

// Initialize listener once for the singleton
EventBus.on('song-data-changed', () => {
  const { syncSongData } = useSongData()
  syncSongData()
})
