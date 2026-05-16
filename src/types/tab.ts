import type {
  Chord as SongChord,
  Measure as SongBeat,
  MeasureMetaInfo as SongMeasureMeta,
  Note as SongNote,
} from '../assets/js/songData'

export interface Note {
  fret: number
  tied: boolean
  dead: boolean
  ghost: boolean
  palmMute: boolean
  stacatto: boolean
  tap: boolean
  letRing: boolean
  fadeIn: boolean
  pop: boolean
  slap: boolean
  accentuated: boolean
  heavyAccentuated: boolean
  vibrato: boolean
  trillPresent: boolean
  artificialPresent: boolean
  artificialStyle?: string
  pullDown: boolean
  slide: boolean
  gracePresent: boolean
  graceObj?: Grace
  bendPresent: boolean
  bendObj?: Bend
  tremoloPicking: boolean
  tremoloPickingLength?: string
  noteDrawn?: SVGTextElement | SVGGElement | null
  tieBegin: boolean
  // Legacy properties
  string: number
  height: number
  tiedTo?: any
  velocity?: number
  element?: number
  octave?: number
  tone?: number
  trill?: { fret: number, period: number }
}

export interface Grace {
  fret: number
}

export interface Bend {
  length: number
  [index: number]: {
    bendValue: number
    bendPosition?: number
  }
}

export interface TremoloBar {
  length: number
  [index: number]: {
    value: number
    position: number
  }
}

export interface BeatEffects {
  strokePresent: boolean
  stroke?: {
    strokeType: string
  }
  tremoloBarPresent: boolean
  tremoloBar?: TremoloBar
}

export interface Measure {
  duration: string
  dotted: boolean
  doubleDotted: boolean
  tuplet?: number | null
  notes: (Note | null)[]
  textPresent: boolean
  text?: string
  chordPresent: boolean
  chord?: {
    name: string
  } | any
  dynamicPresent: boolean
  dynamic?: string
  effects?: BeatEffects | any
  // Legacy properties
  otherNotes?: Note[]
  tupletId?: number
  empty?: boolean
  keySignature?: string
  noteIds?: number[]
  rhythmId?: number
  gracePresent?: boolean
  graceObj?: any
}

export interface MeasureMeta {
  numerator: number
  denominator: number
  bpm: number
  bpmPresent: boolean
  timeMeterPresent: boolean
  repeatOpen: boolean
  repeatClosePresent: boolean
  repeatClose: number
  repeatAlternativePresent: boolean
  repeatAlternative?: number
  markerPresent: boolean
  marker?: {
    text: string
    color: {
      red: number
      green: number
      blue: number
    }
  }
}

export interface Track {
  name: string
  numStrings: number
  color: {
    red: number
    green: number
    blue: number
  }
  capo: number
  tuning: number[]
  strings?: number[] // Legacy alias for tuning
  instrument?: string | number
  // Legacy properties
  volume?: number
  balance?: number
  reverb?: number
  channel?: any
  program?: number
  primaryChannel?: number
  letItRing?: boolean
}

export interface SongDescription {
  title: string
  author: string
  album?: string
  year?: number
}

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

export interface TabRow {
  id: number
  measures: Measure[][]
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
  yOffset: number
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