import { reactive, ref, watch } from 'vue'
import type { Measure as SongBeat, Note as SongNote } from '../types/tab'
import legacyEditorCore from '../services/legacy/editorCoreAdapter'
import { ensureLegacySongDataEventBridge } from '../services/songDataEventBridge'
import { typedEventBus } from '../utils/typedEventBus'
import { editorScopeState } from './useEditorScopeState'
import {
  applySongSnapshotToState,
  getMeasuresForTrackVoice,
  type ReactiveSongData,
} from './songDataState'

const songDataVersion = ref(0)

const reactiveSongData = reactive<ReactiveSongData>(legacyEditorCore.getSongSnapshot())

function syncSongDataState() {
  applySongSnapshotToState(reactiveSongData, legacyEditorCore.getSongSnapshot())
  songDataVersion.value++
}

export function useSongData() {
  function syncSongData() {
    syncSongDataState()
  }

  function getMeasures(trackId: number, voiceId: number) {
    return getMeasuresForTrackVoice(reactiveSongData, trackId, voiceId)
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

ensureLegacySongDataEventBridge()
typedEventBus.on('song-data-changed', syncSongDataState)

watch(
  () => [editorScopeState.currentTrackId, editorScopeState.currentVoiceId] as const,
  ([trackId, voiceId]) => {
    reactiveSongData.currentTrackId = trackId
    reactiveSongData.currentVoiceId = voiceId
  },
  { immediate: true },
)
