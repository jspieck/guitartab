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
  noteDrawn?: SVGTextElement | null
  tieBegin: boolean
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
  tuplet?: number
  notes: (Note | null)[]
  textPresent: boolean
  text?: string
  chordPresent: boolean
  chord?: {
    name: string
  }
  dynamicPresent: boolean
  dynamic?: string
  effects?: BeatEffects
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
  instrument: string
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