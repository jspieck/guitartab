import { defineStore } from 'pinia'
import type {
  Track,
  SongDescription,
  ChordsMap,
  Beat,
  MeasureMeta,
  TabPosition,
  ChordDiagram,
  NoteLengthCode,
} from '../types/tab'

// Bridge to reactive song state
import { songState } from '../stores/songState'

export const useTabStore = defineStore('tab', {
  state: () => ({
    currentTrackId: 0,
    currentVoiceId: 0,
    currentBlockId: 0,
    currentBeatId: 0,
    currentString: 0,
    typeOfNote: 'e' as NoteLengthCode, // Default to 8th note
    currentSelection: [] as TabPosition[],
    selectionVersion: 0,
    songDataVersion: 0,
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    // Bridge to existing Song data
    tracks: (): Track[] => {
      return songState.tracks.map((t: any) => {
        // Alias strings to tuning
        if (!t.tuning && t.strings) {
          t.tuning = t.strings
        }
        // Alias program to instrument if instrument is missing
        if (t.instrument === undefined && t.program !== undefined) {
          t.instrument = t.program
        }
        return t
      })
    },
    songDescription: (): SongDescription => songState.songDescription,
    measureMeta: (): MeasureMeta[] => songState.measureMeta,

    getTrack:
      () =>
      (trackId: number): Track | undefined => {
        const t: any = songState.tracks[trackId]
        if (!t) return undefined

        // Alias strings to tuning
        if (!t.tuning && t.strings) {
          t.tuning = t.strings
        }
        // Alias program to instrument if instrument is missing
        if (t.instrument === undefined && t.program !== undefined) {
          t.instrument = t.program
        }
        return t
      },

    getMeasures:
      (state) =>
      (trackId: number, voiceId: number): Beat[][] => {
        // Dependency on songDataVersion to trigger updates
        const _ = state.songDataVersion
        if (!songState.measures[trackId]) return []
        return songState.measures[trackId].map((block) => block[voiceId])
      },

    getChordsMap:
      (state) =>
      (trackId: number): ChordsMap => {
        const _ = state.songDataVersion
        return songState.chordsMap[trackId] || new Map()
      },

    getCurrentPosition: (state): TabPosition => ({
      trackId: state.currentTrackId,
      voiceId: state.currentVoiceId,
      blockId: state.currentBlockId,
      beatId: state.currentBeatId,
      string: state.currentString,
    }),

    getMeasure:
      (state) =>
      (trackId: number, blockId: number, voiceId: number): Beat[] => {
        const _ = state.songDataVersion
        return songState.measures[trackId]?.[blockId]?.[voiceId] || []
      },

    getNote:
      (state) => (trackId: number, blockId: number, voiceId: number, beatId: number, string: number) => {
        const _ = state.songDataVersion
        return songState.measures[trackId]?.[blockId]?.[voiceId]?.[beatId]?.notes?.[string]
      },
  },

  actions: {
    setTypeOfNote(type: NoteLengthCode) {
      this.typeOfNote = type
    },

    setCurrentPosition(position: TabPosition) {
      this.currentTrackId = position.trackId
      this.currentVoiceId = position.voiceId
      this.currentBlockId = position.blockId
      this.currentBeatId = position.beatId
      this.currentString = position.string
    },

    setCurrentTrack(trackId: number) {
      this.currentTrackId = trackId
      songState.currentTrackId = trackId
    },

    setCurrentVoice(voiceId: number) {
      this.currentVoiceId = voiceId
      songState.currentVoiceId = voiceId
    },

    setSelection(selection: TabPosition[]) {
      this.currentSelection = selection
      this.selectionVersion++
    },

    incrementSelectionVersion() {
      this.selectionVersion++
    },

    clearSelection() {
      this.currentSelection = []
    },

    addToSelection(position: TabPosition) {
      this.currentSelection.push(position)
    },

    removeFromSelection(position: TabPosition) {
      const index = this.currentSelection.findIndex(
        (p) =>
          p.trackId === position.trackId &&
          p.voiceId === position.voiceId &&
          p.blockId === position.blockId &&
          p.beatId === position.beatId &&
          p.string === position.string,
      )
      if (index !== -1) {
        this.currentSelection.splice(index, 1)
      }
    },

    // Bridge methods to update Song data
    updateNote(
      trackId: number,
      blockId: number,
      voiceId: number,
      beatId: number,
      string: number,
      noteData: any,
    ) {
      if (songState.measures[trackId]?.[blockId]?.[voiceId]?.[beatId]?.notes) {
        songState.measures[trackId][blockId][voiceId][beatId].notes[string] = noteData
        this.songDataVersion++
      }
    },

    updateMeasure(trackId: number, blockId: number, voiceId: number, measureData: Beat[]) {
      if (songState.measures[trackId]?.[blockId]) {
        songState.measures[trackId][blockId][voiceId] = measureData
        this.songDataVersion++
      }
    },

    addChord(trackId: number, chordName: string, chord: ChordDiagram) {
      if (!songState.chordsMap[trackId]) {
        songState.chordsMap[trackId] = new Map()
      }
      const songChord: any = {
        ...chord,
        chordType: chord.chordType || '',
        chordRoot: chord.chordRoot || '',
        fingers: chord.fingers || [],
      }
      songState.chordsMap[trackId].set(chordName, songChord)
    },

    removeChord(trackId: number, chordName: string) {
      songState.chordsMap[trackId]?.delete(chordName)
    },

    setLoading(loading: boolean) {
      this.isLoading = loading
    },

    setError(error: string | null) {
      this.error = error
    },
  },
})
