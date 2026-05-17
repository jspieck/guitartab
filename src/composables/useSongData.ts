import { reactive, ref } from 'vue'
import type { Measure as SongBeat, Note as SongNote } from '../types/tab'
import EventBus from '../assets/js/eventBus'
import legacyEditorCore, { type LegacySongSnapshot } from '../services/legacy/editorCoreAdapter'
import { typedEventBus } from '../utils/typedEventBus'

type ReactiveSongData = LegacySongSnapshot

const songDataVersion = ref(0)

function applySongSnapshot(snapshot: LegacySongSnapshot) {
  reactiveSongData.measures = snapshot.measures
  reactiveSongData.songDescription = snapshot.songDescription
  reactiveSongData.tracks = snapshot.tracks
  reactiveSongData.measureMeta = snapshot.measureMeta
  reactiveSongData.playBackInstrument = snapshot.playBackInstrument
  reactiveSongData.currentTrackId = snapshot.currentTrackId
  reactiveSongData.currentVoiceId = snapshot.currentVoiceId
}

const reactiveSongData = reactive<ReactiveSongData>(legacyEditorCore.getSongSnapshot())

function syncSongDataState() {
  applySongSnapshot(legacyEditorCore.getSongSnapshot())
  songDataVersion.value++
}

export function useSongData() {
  function syncSongData() {
    syncSongDataState()
  }

  function getMeasures(trackId: number, voiceId: number) {
    const measures = reactiveSongData.measures?.[trackId] || []
    return measures.map((block) => block?.[voiceId] || [])
  }
  
  function getBeat(trackId: number, blockId: number, voiceId: number, beatIndex: number): SongBeat | undefined {
    return legacyEditorCore.getBeat(trackId, blockId, voiceId, beatIndex)
  }
  
  function getNote(trackId: number, blockId: number, voiceId: number, beatIndex: number, stringIndex: number): SongNote | null | undefined {
    return legacyEditorCore.getNote(trackId, blockId, voiceId, beatIndex, stringIndex)
  }
  
  function setNote(
    trackId: number, 
    blockId: number, 
    voiceId: number, 
    beatIndex: number, 
    stringIndex: number, 
    fretNumber: number
  ): void {
    legacyEditorCore.setNoteAtPosition(trackId, blockId, voiceId, beatIndex, stringIndex, fretNumber)
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

EventBus.on('song-data-changed', syncSongDataState)

typedEventBus.on('ui.trackChanged', (trackId) => {
  reactiveSongData.currentTrackId = trackId
})

typedEventBus.on('ui.voiceChanged', (voiceId) => {
  reactiveSongData.currentVoiceId = voiceId
})
