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
} from './song'

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
  /** Multi-bar rest: this bar stands for this many empty bars (`utils/multiRests.ts`). */
  multiRest?: number
  /** Inside a multi-bar rest after its first bar: takes no room and isn't drawn. */
  hidden?: boolean
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
  /** Score view: the track and voice this row belongs to (else the view's own). */
  trackId?: number
  voiceId?: number
  /** Score view: a staff below a system's top one (no bar numbers, tempo or markers). */
  lowerStaff?: boolean
  /** The row starts after the label gutter: TAB on the first row, drum line names on every row. */
  labelGutter?: boolean
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

/** A beat's stored length: the note value, with an `r` suffix for rests (`'e'`, `'er'`). */
export type BeatDuration = NoteLengthCode | `${NoteLengthCode}r`
