import type { RowLanes } from '../utils/tabRowLanes'
import type {
  Bend as SongBend,
  Chord as SongChord,
  Grace as SongGrace,
  Beat as SongBeat,
  BeatEffects as SongBeatEffects,
  MeasureMetaInfo as SongMeasureMeta,
  Note as SongNote,
  SongDescription as SongDescriptionSource,
  Track as SongTrack,
  TremoloBar as SongTremoloBar,
} from '../assets/js/songData'

export type Note = SongNote
export type Chord = SongChord
export type Grace = SongGrace
export type Bend = SongBend
export type TremoloBar = SongTremoloBar
export type BeatEffects = SongBeatEffects
export type Beat = SongBeat
export type MeasureMeta = SongMeasureMeta
export type Track = SongTrack
export type SongDescription = SongDescriptionSource

export interface ChordDiagram {
  name: string
  frets: number[]
  capo: number
  display: boolean
  chordType?: string
  chordRoot?: string
  fingers?: number[]
}

export type ChordsMap = Map<string, ChordDiagram>

export interface TabPosition {
  trackId: number
  voiceId: number
  blockId: number
  beatId: number
  string: number
}

/** Track/voice/block/beat without string — shared by playback, layout, and overlays. */
export type BeatLocation = Pick<TabPosition, 'trackId' | 'voiceId' | 'blockId' | 'beatId'>

export interface TabRow {
  id: number
  measures: Beat[][]
  startBlockId: number
  endBlockId: number
  yOffset: number
}

export interface TabPage {
  rows: TabRow[]
} 

export type TabBeat = SongBeat
export type TabNoteData = SongNote
export type TabMeasureMetaData = SongMeasureMeta
export type TabChordData = SongChord

export interface RenderedMeasureData {
  data: TabBeat[]
  width: number
}

export interface RenderedTabRow {
  id: number
  measures: RenderedMeasureData[]
  startBlockId: number
  endBlockId: number
  /** Y of the row's top string line (row-local y = 0). */
  yOffset: number
  /** Y of the row's top edge, including the annotation lanes above the strings. */
  top?: number
  /** Full row height from `top`, including lower lanes and the classical staff. */
  height?: number
  /** Vertical lane layout of the row (see `utils/tabRowLanes`). */
  lanes?: RowLanes
}

export interface TabSelectionData {
  trackId: number
  voiceId: number
  blockId: number
  beatIndex: number
  stringIndex: number
}

export interface RendererSelectionPosition {
  stringIndex: number
  measureIndex: number
  beatIndex: number
  blockId: number
}

export interface TabClipboardData {
  beat: TabBeat
  position: TabSelectionData
}

export interface SelectedNoteState extends Partial<TabNoteData> {
  duration: string
  isEmpty: boolean
}

export type NoteLengthCode = 'w' | 'h' | 'q' | 'e' | 's' | 't' | 'z' | 'o'