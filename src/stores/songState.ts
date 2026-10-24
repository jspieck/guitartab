import { reactive, ref } from 'vue'
import type { Chord, Beat, MeasureMetaInfo, PlayBackInstrument, SongDescription, Track } from '../types/song'

interface Channel {
  cInstrument: number
  volume: number
  balance: number
  chorus: number
  reverb: number
  phaser: number
  tremolo: number
}

export interface SongStateData {
  tracks: Track[]
  currentTrackId: number
  currentVoiceId: number
  measures: Beat[][][][]
  measureMeta: MeasureMetaInfo[]
  measureMoveHelper: number[][][][]
  songDescription: SongDescription
  bpm: number
  numVoices: number
  chordsMap: Map<string, Chord>[]
  playBackInstrument: PlayBackInstrument[]
  allChannels: Channel[]
  numMeasures: number
}

export const songState = reactive<SongStateData>({
  tracks: [],
  currentTrackId: 0,
  currentVoiceId: 0,
  measures: [],
  measureMeta: [],
  measureMoveHelper: [],
  songDescription: {} as SongDescription,
  bpm: 100,
  numVoices: 2,
  chordsMap: [],
  playBackInstrument: [{ instrument: 'guitar', solo: false, mute: false } as PlayBackInstrument],
  allChannels: [],
  numMeasures: 12,
})

export const songDataVersion = ref(0)

export function bumpSongDataVersion(): void {
  songDataVersion.value += 1
}
