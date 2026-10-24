import fastdom from 'fastdom'
import { setTempoState } from './tempoState'
import { songState } from './songState'
import type { Beat, BeatEffects, BeatRef, Chord, MeasureMetaInfo, Note, NoteRef, Track } from '../types/song'
import type { BeatDuration } from '../types/tab'
import { isRestDuration } from '../utils/durationUtils'

/**
 * `Song`: the song data (`songState`, reactive) plus accessors and the default objects, as
 * one object. Reads and writes go straight through to `songState`, so legacy-style
 * `Song.measures[...] = ...` edits are reactive.
 */

function describeRef(ref: BeatRef): string {
  return `track ${ref.trackId}, block ${ref.blockId}, voice ${ref.voiceId}, beat ${ref.beatId}`
}

const songMethods = {
  /** The beat at `ref`, or undefined when that position doesn't exist. */
  findBeat(ref: BeatRef): Beat | undefined {
    return songState.measures[ref.trackId]?.[ref.blockId]?.[ref.voiceId]?.[ref.beatId]
  },

  /** The beat at `ref`; throws a descriptive error when the position doesn't exist. */
  getBeat(ref: BeatRef): Beat {
    const beat = songMethods.findBeat(ref)
    if (beat == null) {
      throw new RangeError(`No beat at ${describeRef(ref)}`)
    }
    return beat
  },

  /** The note on `ref.string`, or null when that string is empty. */
  getNote(ref: NoteRef): Note | null {
    return songMethods.getBeat(ref).notes[ref.string] ?? null
  },

  setTempo(bpm: number) {
    fastdom.mutate(() => {
      setTempoState(bpm)
    })
    songState.bpm = bpm
  },

  initEmptySong() {
    songState.numMeasures = 12
    songState.songDescription = {
      title: 'Untitled',
      author: 'Unknown',
      subtitle: '',
      artist: '',
      album: '',
      music: '',
      copyright: '',
      writer: '',
      instructions: '',
      comments: [],
      wordsAndMusic: '',
    }

    songState.allChannels = []
    for (let i = 0; i < 64; i += 1) {
      songState.allChannels[i] = {
        cInstrument: 24,
        volume: 127,
        balance: 63,
        chorus: 0,
        reverb: 0,
        phaser: 0,
        tremolo: 0,
      }
    }
    // create one basic track
    songState.tracks = [
      {
        numStrings: 6,
        capo: 0,
        strings: [40, 45, 50, 55, 59, 64],
        volume: 127,
        balance: 63,
        reverb: 0,
        name: 'Guitar',
        color: { red: 0, blue: 127, green: 0 },
        channel: { index: 0, effectChannel: 0 },
        program: 0,
        primaryChannel: 0,
        letItRing: false,
      },
    ]
    songState.measureMoveHelper = [[]]

    // Initialize measureMeta for all measures
    songState.measureMeta = []
    for (let i = 0; i < songState.numMeasures; i += 1) {
      songState.measureMeta[i] = {
        denominator: 4,
        numerator: 4,
        timeMeterPresent: i === 0, // Only first measure has time meter present
        ...(i === 0 ? { bpm: 90 } : {}), // and a tempo
        repeatOpen: false,
        keySignature: 0,
        automations: [],
      }
    }

    songState.measures = [[]]
    for (let i = 0; i < songState.numMeasures; i += 1) {
      for (let j = 0; j < songState.numVoices; j += 1) {
        songMethods.initEmptyMeasure(0, i, j)
      }
    }
    songState.chordsMap = [new Map<string, Chord>()]

    songMethods.setTempo(songState.measureMeta[0].bpm ?? 90)
  },

  initEmptyMeasure(trackId: number, blockId: number, voiceId: number) {
    if (songState.measures[trackId][blockId] == null) {
      songState.measures[trackId][blockId] = []
    }
    songState.measures[trackId][blockId][voiceId] = []

    if (songState.measureMeta[blockId] == null) {
      songState.measureMeta[blockId] = {
        denominator: 4,
        numerator: 4,
        timeMeterPresent: false,
        repeatOpen: false,
        keySignature: 0,
        automations: [],
      }
    }

    if (songState.measureMoveHelper[trackId][blockId] == null) {
      songState.measureMoveHelper[trackId][blockId] = []
    }
    songState.measureMoveHelper[trackId][blockId][voiceId] = []

    for (let p = 0; p < 8; p += 1) {
      songState.measures[trackId][blockId][voiceId][p] = songMethods.defaultMeasure()
    }
  },

  addChord(trackId: number, chord: Chord) {
    if (songState.chordsMap[trackId] == null) {
      songState.chordsMap[trackId] = new Map()
    }
    songState.chordsMap[trackId].set(chord.name, { ...chord, display: true })
  },

  setBeat(trackId: number, blockId: number, voiceId: number, beatId: number, duration: BeatDuration) {
    songState.measures[trackId][blockId][voiceId].splice(beatId, 0, {
      ...songMethods.defaultMeasure(),
      ...{
        duration,
      },
    })
  },

  isBeatEmpty(trackId: number, blockId: number): boolean {
    for (let voiceId = 0, n = songState.measures[trackId][blockId].length; voiceId < n; voiceId += 1) {
      for (
        let beatId = 0, m = songState.measures[trackId][blockId][voiceId].length;
        beatId < m;
        beatId += 1
      ) {
        const beat = songState.measures[trackId][blockId][voiceId][beatId]
        const hasNotes = Array.isArray(beat.notes) && beat.notes.some((note: Note | null) => note != null)
        const hasOtherNotes = Array.isArray(beat.otherNotes) && beat.otherNotes.length > 0

        if (hasNotes || hasOtherNotes || !isRestDuration(beat.duration)) {
          return false
        }
      }
    }
    return true
  },

  defaultMeasureMeta(): MeasureMetaInfo {
    return {
      denominator: 4,
      numerator: 4,
      timeMeterPresent: false,
      repeatOpen: false,
      keySignature: -1,
      automations: [],
    }
  },

  defaultMeasureEffects(): BeatEffects {
    return {
      vibrato: false,
      fadeIn: false,
      tap: false,
      slap: false,
      pop: false,
    }
  },

  defaultMeasure(): Beat {
    return {
      duration: 'er',
      notes: [],
      effects: songMethods.defaultMeasureEffects(),
      otherNotes: [],
      tuplet: null,
      tupletId: 0,
      dynamic: 'mf',
      dotted: false,
      doubleDotted: false,
      dynamicPresent: false,
      empty: false,
      keySignature: '',
      noteIds: [],
      rhythmId: 0,
    }
  },

  defaultNote(): Note {
    return {
      fret: 0,
      string: 0,
      height: 0,
      tied: false,
      ghost: false,
      dead: false,
      tieBegin: false,
      tiedTo: { blockId: -1, beatId: -1 },
      palmMute: false,
      stacatto: false,
      tap: false,
      fadeIn: false,
      pop: false,
      slap: false,
      accentuated: false,
      heavyAccentuated: false,
      vibrato: false,
      pullDown: false,
      letRing: false,
      tremoloPickingLength: 'e',
      tremoloPicking: false,
      slide: false,
      velocity: 0,
      element: 0,
      tone: 0,
      octave: 0,
    }
  },

  defaultChord(): Chord {
    return {
      name: '',
      capo: -1,
      frets: [],
      chordType: '',
      chordRoot: '',
      fingers: [],
      display: false,
    }
  },

  defaultTrack(): Track {
    return {
      numStrings: 0,
      capo: 0,
      strings: [],
      volume: 255,
      balance: 0,
      reverb: 0,
      name: '',
      color: { red: 255, blue: 0, green: 0 },
      channel: { index: 0, effectChannel: 0 },
      program: 0,
      primaryChannel: 0,
      letItRing: false,
    }
  },
}

type SongFacade = typeof songState & typeof songMethods

const Song = new Proxy(songState, {
  get(target, prop, receiver) {
    if (prop in songMethods) {
      const member = songMethods[prop as keyof typeof songMethods]
      return typeof member === 'function' ? member.bind(receiver) : member
    }
    return Reflect.get(target, prop, receiver)
  },
  set(target, prop, value, receiver) {
    return Reflect.set(target, prop, value, receiver)
  },
}) as SongFacade

export { Song }
export type {
  BeatRef,
  NoteRef,
  Beat,
  Note,
  PlayBackInstrument,
  SongDescription,
  Track,
  Interval,
  MeasureMetaInfo,
  Bend,
  TremoloBar,
  Chord,
  Marker,
  Stroke,
  Grace,
  BeatEffects,
  Channel,
} from '../types/song'
export default Song
