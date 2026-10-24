import type { BeatDuration } from './tab'

/**
 * The song data model: `Song.measures[track][block][voice][beat]` holds `Beat`s; bar
 * metadata is `Song.measureMeta[block]`. Optional features are optional fields (old `.gt`
 * files are upgraded by `services/songMigrations.ts`).
 */

export interface Interval {
  trackId: number
  startBlock: number
  startBeat: number
  startRatio: number
  endBlock: number
  endRatio: number
  endBeat: number
}

export interface SongDescription {
  title: string
  author: string
  subtitle: string
  artist: string
  album: string
  music: string
  copyright: string
  writer: string
  instructions: string
  comments: string[]
  wordsAndMusic: string
}

export interface PlayBackInstrument {
  instrument: string
  solo: boolean
  mute: boolean
  volume: number
  tremolo: number
  reverb: number
  chorus: number
  phaser: number
  balance: number
}

export interface Channel {
  cInstrument: number
  volume: number
  balance: number
  chorus: number
  reverb: number
  phaser: number
  tremolo: number
}

export interface Track {
  numStrings: number
  capo: number
  strings: number[]
  volume: number
  balance: number
  reverb: number
  name: string
  color: { red: number; blue: number; green: number }
  channel: { index: number; effectChannel: number }
  program: number
  primaryChannel: number
  letItRing: boolean
}

export interface BendPoint {
  bendPosition: number
  bendValue: number
  vibrato: number
}

export type Bend = BendPoint[]

export interface TremoloBarPoint {
  position: number
  value: number
  vibrato: number
}

export type TremoloBar = TremoloBarPoint[]

export interface Grace {
  duration: string
  setOnBeat: string
  dynamic: string
  transition: string
  fret: number
  string: number
  height: number
  dead: boolean
}

export interface Note {
  string: number
  fret: number
  dead: boolean
  height: number
  tied: boolean
  /** Grace note played before this note; absent when there is none. */
  graceObj?: Grace
  /** Bend curve; absent when the note isn't bent. */
  bendObj?: Bend
  tieBegin: boolean
  tiedTo: { blockId: number; beatId: number }
  palmMute: boolean
  stacatto: boolean
  tap: boolean
  fadeIn: boolean
  pop: boolean
  slap: boolean
  ghost: boolean
  accentuated: boolean
  heavyAccentuated: boolean
  vibrato: boolean
  /** Harmonic type ('N.H.', 'A.H.', ...); absent for a plain note. */
  artificialStyle?: string
  tremoloPickingLength: string
  tremoloPicking: boolean
  pullDown: boolean
  letRing: boolean
  slide: boolean
  velocity: number
  /** Trill partner fret and speed; absent when the note isn't trilled. */
  trill?: { fret: number; period: number }
  element: number
  octave: number
  tone: number
}

export interface Chord {
  name: string
  capo: number
  frets: number[]
  chordType: string
  chordRoot: string
  fingers: number[]
  display: boolean
}

export interface Marker {
  text: string
  color: { red: number; green: number; blue: number }
}

export interface Stroke {
  strokeLength: number
  strokeType: 'up' | 'down'
}

export interface BeatEffects {
  /** Brush stroke; absent when the beat isn't strummed. */
  stroke?: Stroke
  /** Whammy-bar curve; absent when the beat has none. */
  tremoloBar?: TremoloBar
  vibrato: boolean
  fadeIn: boolean
  tap: boolean
  slap: boolean
  pop: boolean
}

export interface Beat {
  duration: BeatDuration
  notes: (Note | null)[]
  effects: BeatEffects
  dynamic: string
  otherNotes: Note[]
  tuplet: number | null
  tupletId: number
  dotted: boolean
  doubleDotted: boolean
  /** Beat text annotation; absent when the beat has none. */
  text?: string
  dynamicPresent: boolean
  /** Chord diagram/name above the beat; absent when the beat has none. */
  chord?: Chord
  empty: boolean
  keySignature: string
  noteIds: number[]
  rhythmId: number
}

export interface Automation {
  blockId: number
  type: string
  value: number[]
  linear: boolean
  position: number
  visible: boolean
}

export interface MeasureMetaInfo {
  denominator: number
  numerator: number
  timeMeterPresent: boolean
  /** Tempo change at this bar; absent when the tempo carries on. Bar 0 always has one. */
  bpm?: number
  repeatOpen: boolean
  /** Repeat sign at the end of the bar: how many times to repeat; absent when none. */
  repeatClose?: number
  /** Alternative ending (volta) as a bitmask of the passes it plays on; absent when none. */
  repeatAlternative?: number
  /** Rehearsal marker; absent when the bar has none. */
  marker?: Marker
  keySignature: number
  automations: Automation[]
}

/** Where a beat lives: track → block (bar) → voice → beat. */
export interface BeatRef {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
}

/** A string position on a beat. */
export interface NoteRef extends BeatRef {
  string: number
}
