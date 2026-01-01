import { reactive, ref, watch } from 'vue'
import Song from '../assets/js/songData'
import EventBus from '../assets/js/eventBus'

/**
 * Composable for managing reactive song data
 * Bridges the gap between Vue reactivity and the legacy Song object
 */
export function useSongData() {
  // Version tracker for forcing re-renders
  const songDataVersion = ref(0)
  
  // Create a reactive proxy of Song data for Vue components
  const reactiveSongData = reactive({
    measures: Song.measures,
    songDescription: Song.songDescription,
    tracks: Song.tracks,
    measureMeta: Song.measureMeta,
    playBackInstrument: Song.playBackInstrument
  })
  
  /**
   * Sync Song data to reactive proxy
   * Creates a deep copy to ensure Vue reactivity detects changes
   */
  function syncSongData() {
    reactiveSongData.measures = JSON.parse(JSON.stringify(Song.measures))
    reactiveSongData.songDescription = { ...Song.songDescription }
    reactiveSongData.tracks = [...Song.tracks]
    reactiveSongData.measureMeta = [...Song.measureMeta]
    reactiveSongData.playBackInstrument = [...Song.playBackInstrument]
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
  
  /**
   * Initialize song data event listeners
   */
  function initEventListeners() {
    EventBus.on('song-data-changed', syncSongData)
  }
  
  /**
   * Clean up event listeners
   */
  function cleanupEventListeners() {
    EventBus.off('song-data-changed', syncSongData)
  }
  
  // Note: We cannot use Vue watch on Song.measures because it's a plain object
  // outside of Vue's reactivity system. All changes to Song.measures must
  // explicitly call syncSongData() or emit 'song-data-changed' via EventBus.
  
  return {
    reactiveSongData,
    songDataVersion,
    syncSongData,
    getMeasures,
    getBeat,
    getNote,
    setNote,
    initEventListeners,
    cleanupEventListeners
  }
}
