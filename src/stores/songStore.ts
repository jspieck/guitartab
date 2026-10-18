import { defineStore } from 'pinia'
import type { Beat, MeasureMeta, Track } from '../types/tab'
import { syncEditorScope } from '../composables/useEditorScopeState'
import { bumpSongDataVersion, songDataVersion, songState, type SongStateData } from './songState'

export const useSongStore = defineStore('song', {
  getters: {
    dataVersion: () => songDataVersion.value,
    reactiveData: (): SongStateData => songState,
    tracks: (): Track[] => songState.tracks,
    measures: (): Beat[][][][] => songState.measures,
    measureMeta: (): MeasureMeta[] => songState.measureMeta,
    songDescription: () => songState.songDescription,
    currentTrackId: (): number => songState.currentTrackId,
    currentVoiceId: (): number => songState.currentVoiceId,
    playBackInstrument: () => songState.playBackInstrument,
    chordsMap: () => songState.chordsMap,
    bpm: (): number => songState.bpm,
  },

  actions: {
    notifyDataChanged(): void {
      bumpSongDataVersion()
    },

    syncEditorScopeFromState(): void {
      syncEditorScope(songState.currentTrackId, songState.currentVoiceId)
    },

    setCurrentTrack(trackId: number): void {
      songState.currentTrackId = trackId
    },

    setCurrentVoice(voiceId: number): void {
      songState.currentVoiceId = voiceId
    },
  },
})
