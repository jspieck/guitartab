import fastdom from 'fastdom';
import { setTempoState } from '../../stores/tempoState';
import { songState } from '../../stores/songState';
import type { BeatDuration } from '../../types/tab';
import { isRestDuration } from '../../utils/durationUtils';

interface Interval {
  trackId: number,
  startBlock: number,
  startBeat: number,
  startRatio: number,
  endBlock: number,
  endRatio: number,
  endBeat: number
}

interface SongDescription {
  title: string,
  author: string,
  subtitle: string,
  artist: string,
  album: string,
  music: string,
  copyright: string,
  writer: string,
  instructions: string,
  comments: string[],
  wordsAndMusic: string
}

interface PlayBackInstrument {
  instrument: string,
  solo: boolean,
  mute: boolean,
  volume: number,
  tremolo: number,
  reverb: number,
  chorus: number,
  phaser: number,
  balance: number
}

interface Channel {
  cInstrument: number,
  volume: number,
  balance: number,
  chorus: number,
  reverb: number,
  phaser: number,
  tremolo: number,
}

interface Track {
  numStrings: number,
  capo: number,
  strings: number[],
  volume: number,
  balance: number,
  reverb: number,
  name: string,
  color: { red: number, blue: number, green: number },
  channel: { index: number, effectChannel: number },
  program: number,
  primaryChannel: number,
  letItRing: boolean
}

interface BendPoint {
  bendPosition: number,
  bendValue: number,
  vibrato: number
}

interface Bend extends Array<BendPoint> {}

interface TremoloBarPoint {
  position: number,
  value: number,
  vibrato: number
}

interface TremoloBar extends Array<TremoloBarPoint> {}

interface Grace {
  duration: string,
  setOnBeat: string,
  dynamic: string
  transition: string,
  fret: number,
  string: number,
  height: number,
  dead: boolean
}

interface Note {
  string: number,
  fret: number,
  dead: boolean,
  height: number,
  tied: boolean,
  /** Grace note played before this note; absent when there is none. */
  graceObj?: Grace,
  /** Bend curve; absent when the note isn't bent. */
  bendObj?: Bend,
  tieBegin: boolean,
  tiedTo: { blockId: number, beatId: number },
  palmMute: boolean,
  stacatto: boolean,
  tap: boolean,
  fadeIn: boolean,
  pop: boolean,
  slap: boolean,
  ghost: boolean,
  accentuated: boolean,
  heavyAccentuated: boolean,
  vibrato: boolean,
  /** Harmonic type ('N.H.', 'A.H.', ...); absent for a plain note. */
  artificialStyle?: string,
  tremoloPickingLength: string,
  tremoloPicking: boolean,
  pullDown: boolean,
  letRing: boolean,
  slide: boolean,
  velocity: number,
  /** Trill partner fret and speed; absent when the note isn't trilled. */
  trill?: {fret: number, period: number},
  element: number,
  octave: number,
  tone: number,
}

interface Chord {
  name: string,
  capo: number,
  frets: number[]
  chordType: string,
  chordRoot: string,
  fingers: number[],
  display: boolean
}

interface Marker {
  text: string,
  color: {red: number, green: number, blue: number}
}

interface Stroke {
  strokeLength: number,
  strokeType: 'up' | 'down'
}

interface BeatEffects {
  /** Brush stroke; absent when the beat isn't strummed. */
  stroke?: Stroke,
  /** Whammy-bar curve; absent when the beat has none. */
  tremoloBar?: TremoloBar,
  vibrato: boolean,
  fadeIn: boolean,
  tap: boolean,
  slap: boolean,
  pop: boolean
}

interface Beat {
  duration: BeatDuration,
  notes: (Note | null)[],
  effects: BeatEffects,
  dynamic: string,
  otherNotes: Note[],
  tuplet: number | null,
  tupletId: number,
  dotted: boolean,
  doubleDotted: boolean,
  /** Beat text annotation; absent when the beat has none. */
  text?: string,
  dynamicPresent: boolean,
  /** Chord diagram/name above the beat; absent when the beat has none. */
  chord?: Chord,
  empty: boolean,
  keySignature: string,
  noteIds: number[],
  rhythmId: number,
}

interface Automation {
  blockId: number,
  type: string,
  value: number[],
  linear: boolean,
  position: number,
  visible: boolean,
}

interface MeasureMetaInfo {
  denominator: number,
  numerator: number,
  timeMeterPresent: boolean,
  /** Tempo change at this bar; absent when the tempo carries on. Bar 0 always has one. */
  bpm?: number,
  repeatOpen: boolean,
  /** Repeat sign at the end of the bar: how many times to repeat; absent when none. */
  repeatClose?: number,
  /** Alternative ending (volta) as a bitmask of the passes it plays on; absent when none. */
  repeatAlternative?: number,
  /** Rehearsal marker; absent when the bar has none. */
  marker?: Marker,
  keySignature: number,
  automations: Automation[]
}

/** Where a beat lives: track → block (bar) → voice → beat. */
interface BeatRef {
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
}

/** A string position on a beat. */
interface NoteRef extends BeatRef {
  string: number,
}

function describeRef(ref: BeatRef): string {
  return `track ${ref.trackId}, block ${ref.blockId}, voice ${ref.voiceId}, beat ${ref.beatId}`;
}

const songMethods = {
  /** The beat at `ref`, or undefined when that position doesn't exist. */
  findBeat(ref: BeatRef): Beat | undefined {
    return songState.measures[ref.trackId]?.[ref.blockId]?.[ref.voiceId]?.[ref.beatId];
  },

  /** The beat at `ref`; throws a descriptive error when the position doesn't exist. */
  getBeat(ref: BeatRef): Beat {
    const beat = songMethods.findBeat(ref);
    if (beat == null) {
      throw new RangeError(`No beat at ${describeRef(ref)}`);
    }
    return beat;
  },

  /** The note on `ref.string`, or null when that string is empty. */
  getNote(ref: NoteRef): Note | null {
    return songMethods.getBeat(ref).notes[ref.string] ?? null;
  },

  setTempo(bpm: number) {
    fastdom.mutate(() => {
      setTempoState(bpm);
    });
    songState.bpm = bpm;
  },

  initEmptySong() {
    songState.numMeasures = 12;
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
    };

    songState.allChannels = [];
    for (let i = 0; i < 64; i += 1) {
      songState.allChannels[i] = {
        cInstrument: 24,
        volume: 127,
        balance: 63,
        chorus: 0,
        reverb: 0,
        phaser: 0,
        tremolo: 0,
      };
    }
    // create one basic track
    songState.tracks = [{
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
    }];
    songState.measureMoveHelper = [[]];
    
    // Initialize measureMeta for all measures
    songState.measureMeta = [];
    for (let i = 0; i < songState.numMeasures; i += 1) {
      songState.measureMeta[i] = {
        denominator: 4,
        numerator: 4,
        timeMeterPresent: i === 0, // Only first measure has time meter present
        ...(i === 0 ? { bpm: 90 } : {}), // and a tempo
        repeatOpen: false,
        keySignature: 0,
        automations: [],
      };
    }
    
    songState.measures = [[]];
    for (let i = 0; i < songState.numMeasures; i += 1) {
      for (let j = 0; j < songState.numVoices; j += 1) {
        songMethods.initEmptyMeasure(0, i, j);
      }
    }
    songState.chordsMap = [
      new Map<string, Chord>(),
    ];

    songMethods.setTempo(songState.measureMeta[0].bpm ?? 90);
  },

  initEmptyMeasure(trackId: number, blockId: number, voiceId: number) {
    if (songState.measures[trackId][blockId] == null) {
      songState.measures[trackId][blockId] = [];
    }
    songState.measures[trackId][blockId][voiceId] = [];

    if (songState.measureMeta[blockId] == null) {
      songState.measureMeta[blockId] = {
        denominator: 4,
        numerator: 4,
        timeMeterPresent: false,
        repeatOpen: false,
        keySignature: 0,
        automations: [],
      };
    }

    if (songState.measureMoveHelper[trackId][blockId] == null) {
      songState.measureMoveHelper[trackId][blockId] = [];
    }
    songState.measureMoveHelper[trackId][blockId][voiceId] = [];

    for (let p = 0; p < 8; p += 1) {
      songState.measures[trackId][blockId][voiceId][p] = songMethods.defaultMeasure();
    }
  },

  addChord(trackId: number, chord: Chord) {
    if (songState.chordsMap[trackId] == null) {
      songState.chordsMap[trackId] = new Map();
    }
    songState.chordsMap[trackId].set(chord.name, { ...chord, display: true });
  },

  setBeat(trackId: number, blockId: number, voiceId: number, beatId: number, duration: BeatDuration) {
    songState.measures[trackId][blockId][voiceId].splice(
      beatId,
      0,
      {
        ...songMethods.defaultMeasure(),
        ...{
          duration,
        },
      },
    );
  },

  isBeatEmpty(trackId: number, blockId: number): boolean {
    for (let voiceId = 0, n = songState.measures[trackId][blockId].length; voiceId < n; voiceId += 1) {
      for (let beatId = 0, m = songState.measures[trackId][blockId][voiceId].length;
        beatId < m; beatId += 1) {
        const beat = songState.measures[trackId][blockId][voiceId][beatId];
        const hasNotes = Array.isArray(beat.notes) && beat.notes.some((note: Note | null) => note != null);
        const hasOtherNotes = Array.isArray(beat.otherNotes) && beat.otherNotes.length > 0;

        if (hasNotes || hasOtherNotes || !isRestDuration(beat.duration)) {
          return false;
        }
      }
    }
    return true;
  },

  defaultMeasureMeta(): MeasureMetaInfo {
    return {
      denominator: 4,
      numerator: 4,
      timeMeterPresent: false,
      repeatOpen: false,
      keySignature: -1,
      automations: [],
    };
  },

  defaultMeasureEffects(): BeatEffects {
    return {
      vibrato: false,
      fadeIn: false,
      tap: false,
      slap: false,
      pop: false,
    };
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
    };
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
    };
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
    };
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
    };
  },
};

type SongFacade = typeof songState & typeof songMethods;

const Song = new Proxy(songState, {
  get(target, prop, receiver) {
    if (prop in songMethods) {
      const member = songMethods[prop as keyof typeof songMethods];
      return typeof member === 'function'
        ? member.bind(receiver)
        : member;
    }
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    return Reflect.set(target, prop, value, receiver);
  },
}) as SongFacade;

export { Song };
export type {
  BeatRef, NoteRef, Beat, Note, PlayBackInstrument, SongDescription, Track, Interval,
  MeasureMetaInfo, Bend, TremoloBar, Chord, Marker, Stroke, Grace, BeatEffects,
};
export default Song;
