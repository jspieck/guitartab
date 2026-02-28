import { reactive, ref } from 'vue'
import Song from '../assets/js/songData'
import EventBus from '../assets/js/eventBus'

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

export function useSongData() {
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

  function getMeasures(trackId: number, voiceId: number) {
    const measures = reactiveSongData.measures?.[trackId] || []
    return measures.map((block: any) => block?.[voiceId] || [])
  }
  
  function getBeat(trackId: number, blockId: number, voiceId: number, beatIndex: number) {
    return Song.measures?.[trackId]?.[blockId]?.[voiceId]?.[beatIndex]
  }
  
  function getNote(trackId: number, blockId: number, voiceId: number, beatIndex: number, stringIndex: number) {
    const beat = getBeat(trackId, blockId, voiceId, beatIndex)
    return beat?.notes?.[stringIndex]
  }
  
  function setNote(
    trackId: number, 
    blockId: number, 
    voiceId: number, 
    beatIndex: number, 
    stringIndex: number, 
    fretNumber: number
  ) {
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
    if (!beat.notes) {
      beat.notes = new Array(6).fill(null)
    }
    
    if (fretNumber === -1) {
      beat.notes[stringIndex] = null
    } else {
      beat.notes[stringIndex] = {
        ...Song.defaultNote(),
        fret: fretNumber,
        string: stringIndex
      }
    }
    
    syncSongData()
    EventBus.emit('song-data-changed')
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

EventBus.on('song-data-changed', () => {
  useSongData().syncSongData()
})
