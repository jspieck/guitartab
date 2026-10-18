import { watch } from 'vue'
import type { Beat as SongBeat, Note as SongNote } from '../types/tab'
import editorCore from '../services/editor/editorCore'
import { ensureSongDataEventBridge } from '../services/songDataEventBridge'
import { ensureRenderEventBridge } from '../services/editor/renderEventBridge'
import { bumpSongDataVersion, songDataVersion, songState } from '../stores/songState'
import { typedEventBus } from '../utils/typedEventBus'
import { editorScopeState, syncEditorScope } from './useEditorScopeState'
import { getMeasuresForTrackVoice } from './songDataState'

editorCore.ensureSongInitialized()

function syncSongDataState() {
  syncEditorScope(songState.currentTrackId, songState.currentVoiceId)
  bumpSongDataVersion()
}

export function useSongData() {
  function syncSongData() {
    syncSongDataState()
  }

  function getMeasures(trackId: number, voiceId: number) {
    return getMeasuresForTrackVoice(songState, trackId, voiceId)
  }
  
  function getBeat(trackId: number, blockId: number, voiceId: number, beatIndex: number): SongBeat | undefined {
    return editorCore.getBeat(trackId, blockId, voiceId, beatIndex)
  }
  
  function getNote(trackId: number, blockId: number, voiceId: number, beatIndex: number, stringIndex: number): SongNote | null | undefined {
    return editorCore.getNote(trackId, blockId, voiceId, beatIndex, stringIndex)
  }
  
  function setNote(
    trackId: number, 
    blockId: number, 
    voiceId: number, 
    beatIndex: number, 
    stringIndex: number, 
    fretNumber: number
  ): void {
    editorCore.setNoteAtPosition(trackId, blockId, voiceId, beatIndex, stringIndex, fretNumber)
  }
  
  return {
    reactiveSongData: songState,
    songDataVersion,
    syncSongData,
    getMeasures,
    getBeat,
    getNote,
    setNote
  }
}

ensureSongDataEventBridge()
ensureRenderEventBridge()
typedEventBus.on('song-data-changed', syncSongDataState)

watch(
  () => [editorScopeState.currentTrackId, editorScopeState.currentVoiceId] as const,
  ([trackId, voiceId]) => {
    songState.currentTrackId = trackId
    songState.currentVoiceId = voiceId
  },
  { immediate: true },
)
