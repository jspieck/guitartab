import { defineStore } from 'pinia'
import type { 
  Track, 
  SongDescription, 
  ChordsMap, 
  Measure, 
  MeasureMeta, 
  TabPosition,
  ChordDiagram 
} from '../types/tab'

// Import existing Song data to bridge the transition
import Song from '../assets/js/songData'

export const useTabStore = defineStore('tab', {
  state: () => ({
    currentTrackId: 0,
    currentVoiceId: 0,
    currentBlockId: 0,
    currentBeatId: 0,
    currentString: 0,
    currentSelection: [] as TabPosition[],
    isLoading: false,
    error: null as string | null
  }),

  getters: {
    // Bridge to existing Song data
    tracks: (): Track[] => Song.tracks,
    songDescription: (): SongDescription => Song.songDescription,
    measureMeta: (): MeasureMeta[] => Song.measureMeta,
    
    getTrack: (state) => (trackId: number): Track | undefined => {
      return Song.tracks[trackId]
    },
    
    getMeasures: (state) => (trackId: number, voiceId: number): Measure[][] => {
      return Song.measures[trackId] || []
    },
    
    getChordsMap: (state) => (trackId: number): ChordsMap => {
      return Song.chordsMap[trackId] || new Map()
    },
    
    getCurrentPosition: (state): TabPosition => ({
      trackId: state.currentTrackId,
      voiceId: state.currentVoiceId,
      blockId: state.currentBlockId,
      beatId: state.currentBeatId,
      string: state.currentString
    }),
    
    getMeasure: (state) => (trackId: number, blockId: number, voiceId: number): Measure[] => {
      return Song.measures[trackId]?.[blockId]?.[voiceId] || []
    },
    
    getNote: (state) => (trackId: number, blockId: number, voiceId: number, beatId: number, string: number) => {
      return Song.measures[trackId]?.[blockId]?.[voiceId]?.[beatId]?.notes?.[string]
    }
  },

  actions: {
    setCurrentPosition(position: TabPosition) {
      this.currentTrackId = position.trackId
      this.currentVoiceId = position.voiceId
      this.currentBlockId = position.blockId
      this.currentBeatId = position.beatId
      this.currentString = position.string
    },
    
    setCurrentTrack(trackId: number) {
      this.currentTrackId = trackId
      // Also update Song.currentTrackId to maintain compatibility
      Song.currentTrackId = trackId
    },
    
    setCurrentVoice(voiceId: number) {
      this.currentVoiceId = voiceId
      // Also update Song.currentVoiceId to maintain compatibility
      Song.currentVoiceId = voiceId
    },
    
    setSelection(selection: TabPosition[]) {
      this.currentSelection = selection
    },
    
    clearSelection() {
      this.currentSelection = []
    },
    
    addToSelection(position: TabPosition) {
      this.currentSelection.push(position)
    },
    
    removeFromSelection(position: TabPosition) {
      const index = this.currentSelection.findIndex(p => 
        p.trackId === position.trackId &&
        p.voiceId === position.voiceId &&
        p.blockId === position.blockId &&
        p.beatId === position.beatId &&
        p.string === position.string
      )
      if (index !== -1) {
        this.currentSelection.splice(index, 1)
      }
    },
    
    // Bridge methods to update Song data
    updateNote(trackId: number, blockId: number, voiceId: number, beatId: number, string: number, noteData: any) {
      if (Song.measures[trackId]?.[blockId]?.[voiceId]?.[beatId]?.notes) {
        Song.measures[trackId][blockId][voiceId][beatId].notes[string] = noteData
      }
    },
    
    updateMeasure(trackId: number, blockId: number, voiceId: number, measureData: Measure[]) {
      if (Song.measures[trackId]?.[blockId]) {
        Song.measures[trackId][blockId][voiceId] = measureData
      }
    },
    
    addChord(trackId: number, chordName: string, chord: ChordDiagram) {
      if (!Song.chordsMap[trackId]) {
        Song.chordsMap[trackId] = new Map()
      }
      Song.chordsMap[trackId].set(chordName, chord)
    },
    
    removeChord(trackId: number, chordName: string) {
      Song.chordsMap[trackId]?.delete(chordName)
    },
    
    setLoading(loading: boolean) {
      this.isLoading = loading
    },
    
    setError(error: string | null) {
      this.error = error
    }
  }
}) 