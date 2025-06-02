import fastdom from 'fastdom';

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
  gracePresent: boolean,
  graceObj: Grace,
  bendPresent: boolean,
  bendObj: Bend,
  noteDrawn: SVGGElement | null,
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
  artificialPresent: boolean,
  artificialStyle: string,
  tremoloPickingLength: string,
  tremoloPicking: boolean,
  pullDown: boolean,
  letRing: boolean,
  slide: boolean,
  velocity: number,
  trillPresent: boolean,
  trill: {fret: number, period: number},
  element: number,
  octave: number,
  tone: number,
  [a: string]: any
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

interface MeasureEffects {
  strokePresent: boolean,
  stroke: Stroke,
  tremoloBarPresent: boolean,
  tremoloBar: TremoloBar,
  vibrato: boolean,
  fadeIn: boolean,
  tap: boolean,
  slap: boolean,
  pop: boolean
}

interface Measure {
  duration: string,
  notes: (Note | null)[],
  effects: MeasureEffects,
  dynamic: string,
  otherNotes: Note[],
  tuplet: number | null,
  tupletId: number,
  dotted: boolean,
  doubleDotted: boolean,
  textPresent: boolean,
  text: string,
  dynamicPresent: boolean,
  chordPresent: boolean,
  chord: Chord | null,
  empty: boolean,
  keySignature: string,
  noteIds: number[],
  rhythmId: number,
  // these are helpers to set to notes
  gracePresent: boolean,
  graceObj: string
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
  bpmPresent: boolean,
  bpm: number,
  repeatOpen: boolean,
  repeatClosePresent: boolean,
  repeatClose: number,
  repeatAlternativePresent: boolean,
  repeatAlternative: number,
  markerPresent: boolean,
  marker: Marker,
  keySignature: number,
  automations: Automation[]
}

const Song = {
  tracks: [] as Track[],
  currentTrackId: 0,
  currentVoiceId: 0,
  measures: [] as Measure[][][][],
  measureMeta: [] as MeasureMetaInfo[],
  measureMoveHelper: [] as number[][][][],
  songDescription: {} as SongDescription,
  bpm: 100,
  numVoices: 2,
  chordsMap: [] as Map<string, Chord>[],
  playBackInstrument: [
    { instrument: 'guitar', solo: false, mute: false },
  ] as PlayBackInstrument[],
  allChannels: [] as Channel[],
  numMeasures: 12,

  setTempo(bpm: number) {
    fastdom.mutate(() => {
      const tempoMeter = document.getElementById('tempoMeter');
      if (tempoMeter != null) {
        tempoMeter.textContent = bpm.toString();
      }
    });
    this.bpm = bpm;
  },

  initEmptySong() {
    this.numMeasures = 12;
    this.songDescription = {
      title: '[Title]',
      author: '[Author]',
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

    this.allChannels = [];
    for (let i = 0; i < 64; i += 1) {
      this.allChannels[i] = {
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
    this.tracks = [{
      numStrings: 6,
      capo: 0,
      strings: [40, 45, 50, 55, 59, 64],
      volume: 127,
      balance: 63,
      reverb: 0,
      name: 'Gitarre',
      color: { red: 0, blue: 127, green: 0 },
      channel: { index: 0, effectChannel: 0 },
      program: 0,
      primaryChannel: 0,
      letItRing: false,
    }];
    this.measureMoveHelper = [[]];
    
    // Initialize measureMeta for all measures
    this.measureMeta = [];
    for (let i = 0; i < this.numMeasures; i += 1) {
      this.measureMeta[i] = {
        denominator: 4,
        numerator: 4,
        timeMeterPresent: i === 0, // Only first measure has time meter present
        bpmPresent: i === 0,       // Only first measure has BPM present
        bpm: 90,
        repeatOpen: false,
        repeatClosePresent: false,
        repeatClose: 0,
        repeatAlternativePresent: false,
        repeatAlternative: 0,
        markerPresent: false,
        marker: { text: '', color: { red: 255, green: 0, blue: 0 } },
        keySignature: 0,
        automations: [],
      };
    }
    
    this.measures = [[]];
    for (let i = 0; i < this.numMeasures; i += 1) {
      for (let j = 0; j < this.numVoices; j += 1) {
        this.initEmptyMeasure(0, i, j);
      }
    }
    this.chordsMap = [
      new Map<string, Chord>(),
    ];
  },

  initEmptyMeasure(trackId: number, blockId: number, voiceId: number) {
    if (this.measures[trackId][blockId] == null) {
      this.measures[trackId][blockId] = [];
    }
    this.measures[trackId][blockId][voiceId] = [];

    if (this.measureMeta[blockId] == null) {
      this.measureMeta[blockId] = {
        denominator: 4,
        numerator: 4,
        timeMeterPresent: false,
        bpmPresent: false,
        bpm: 90,
        repeatClosePresent: false,
        repeatOpen: false,
        repeatClose: 0,
        repeatAlternativePresent: false,
        repeatAlternative: 0,
        markerPresent: false,
        marker: { text: '', color: { red: 255, green: 0, blue: 0 } },
        keySignature: 0,
        automations: [],
      };
    }

    if (this.measureMoveHelper[trackId][blockId] == null) {
      this.measureMoveHelper[trackId][blockId] = [];
    }
    this.measureMoveHelper[trackId][blockId][voiceId] = [];

    for (let p = 0; p < 8; p += 1) {
      this.measures[trackId][blockId][voiceId][p] = Song.defaultMeasure();
    }
  },

  addChord(trackId: number, chord: Chord) {
    if (this.chordsMap[trackId] == null) {
      this.chordsMap[trackId] = new Map();
    }
    this.chordsMap[trackId].set(chord.name, { ...chord, display: true });
  },

  setBeat(trackId: number, blockId: number, voiceId: number, beatId: number, duration: string) {
    this.measures[trackId][blockId][voiceId].splice(
      beatId,
      0,
      {
        ...Song.defaultMeasure(),
        ...{
          duration,
        },
      },
    );
  },

  isBeatEmpty(trackId: number, blockId: number): boolean {
    for (let voiceId = 0, n = this.measures[trackId][blockId].length; voiceId < n; voiceId += 1) {
      for (let beatId = 0, m = this.measures[trackId][blockId][voiceId].length;
        beatId < m; beatId += 1) {
        if (this.measures[trackId][blockId][voiceId][beatId].duration.length < 2) {
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
      bpmPresent: false,
      bpm: 120,
      repeatOpen: false,
      repeatClosePresent: false,
      repeatClose: 0,
      repeatAlternativePresent: false,
      repeatAlternative: 0,
      markerPresent: false,
      marker: { text: '', color: { red: 0, green: 0, blue: 0 } },
      keySignature: -1,
      automations: [],
    };
  },

  defaultMeasureEffects(): MeasureEffects {
    return {
      strokePresent: false,
      tremoloBarPresent: false,
      tremoloBar: [] as TremoloBar,
      vibrato: false,
      stroke: { strokeLength: 8, strokeType: 'down' },
      fadeIn: false,
      tap: false,
      slap: false,
      pop: false,
    };
  },

  defaultGrace(): Grace {
    return {
      duration: 'e',
      setOnBeat: 'before',
      dynamic: 'mf',
      transition: '',
      fret: 0,
      string: 0,
      height: 0,
      dead: false,
    };
  },

  defaultMeasure(): Measure {
    return {
      duration: 'er',
      notes: [],
      effects: this.defaultMeasureEffects(),
      otherNotes: [],
      tuplet: null,
      tupletId: 0,
      dynamic: 'mf',
      dotted: false,
      doubleDotted: false,
      dynamicPresent: false,
      textPresent: false,
      chordPresent: false,
      text: '',
      chord: null,
      empty: false,
      keySignature: '',
      noteIds: [],
      rhythmId: 0,
      gracePresent: false,
      graceObj: '',
    };
  },

  defaultNote(): Note {
    return {
      fret: 0,
      string: 0,
      height: 0,
      tied: false,
      gracePresent: false,
      graceObj: Song.defaultGrace(),
      bendPresent: false,
      ghost: false,
      dead: false,
      noteDrawn: null,
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
      trillPresent: false,
      trill: { fret: 0, period: 0 },
      artificialPresent: false,
      pullDown: false,
      letRing: false,
      bendObj: [],
      artificialStyle: 'N.H.',
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

export { Song };
export type {
  Measure, Note, PlayBackInstrument, SongDescription, Track, Interval,
  MeasureMetaInfo, Bend, TremoloBar, Chord, Marker, Stroke, Grace, MeasureEffects,
};
export default Song;
