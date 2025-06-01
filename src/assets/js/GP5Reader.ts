import { gProReader } from './GProReader';
import Song, {
  TremoloBar, Bend, Chord, Track, Note, MeasureEffects, Stroke, Grace,
} from './songData';
import AppManager from './appManager';
import { ChordModalHandler } from './modals/chordModalHandler';
import { modalManager } from './modals/modalManager';
import { MODALS } from './modals/modalTypes';

class Gp5Reader {
  static read() {
    // var t0 = performance.now();
    Song.chordsMap = [];
    const version = Gp5Reader.readVersion();
    console.log(`Version ${version}`);

    const versionIndex = Gp5Reader.isSupportedVersion(version);
    if (versionIndex < 0) {
      alert('Version nicht unterstützt!');
      return;
    }
    Gp5Reader.readInfo();
    // lyric track
    gProReader.readInt();
    Gp5Reader.readLyrics();

    Gp5Reader.readPageSetup(versionIndex);

    const tempoValue = gProReader.readInt();
    console.log(`Tempo ${tempoValue}`);
    Song.setTempo(tempoValue);

    // skip one byte
    if (versionIndex > 0) gProReader.skipBytes(1);

    gProReader.readInt(); // key
    gProReader.readByte(); // octave

    Gp5Reader.readChannels();

    gProReader.skipBytes(42);

    const numMeasures = gProReader.readInt();
    const numTracks = gProReader.readInt();
    for (let t = 0; t < numTracks; t += 1) {
      Song.chordsMap.push(new Map());
    }
    console.log(`TRACKS: ${numTracks}`);
    // create data structure
    Song.numMeasures = numMeasures;
    Song.measureMeta.length = 0;
    for (let i = 0; i < numMeasures; i += 1) {
      Song.measureMeta[i] = Song.defaultMeasureMeta();
    }
    console.log(numMeasures);
    Song.measureMeta[0].bpmPresent = true;
    Song.measureMeta[0].bpm = tempoValue;

    Gp5Reader.readMeasureHeaders(numMeasures);
    Gp5Reader.readTracks(numTracks, versionIndex);

    // CORRECT BIS HIER ?
    Gp5Reader.readMeasures(numMeasures, numTracks, versionIndex);
    // console.log("GP5 Loadtime: " + (performance.now()-t0)+"ms");
  }

  static isSupportedVersion(version: string) {
    if (version === gProReader.versions[0]) {
      return 0;
    }
    if (version === gProReader.versions[1]) {
      return 1;
    }
    return -1;
  }

  static readVersion() {
    return gProReader.readStringByte(30);
  }

  static readInfo() {
    Song.songDescription.title = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.subtitle = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.artist = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.album = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.author = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.music = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.copyright = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.writer = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.instructions = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.comments = [];
    const comments = gProReader.readInt();
    for (let i = 0; i < comments; i += 1) {
      Song.songDescription.comments[i] = gProReader.readStringByteSizeOfInteger();
    }
    console.log(Song.songDescription);
    AppManager.setTrackInfo();
  }

  static readLyrics() {
    const from = gProReader.readInt();
    const lyr = gProReader.readStringInteger();
    // console.log(from + " " +lyr);
    for (let i = 0; i < 4; i += 1) {
      gProReader.readInt();
      gProReader.readStringInteger();
    }
    return { from, lyric: lyr };
  }

  static readPageSetup(versionIndex: number) {
    if (versionIndex > 0) {
      gProReader.skipBytes(49);
    } else {
      gProReader.skipBytes(30);
    }

    for (let i = 0; i < 11; i += 1) {
      gProReader.skipBytes(4);
      gProReader.readStringByte(0);
    }
  }

  static convertTo127(value: number) {
    return Math.max(value * 8 - 1, 0);
  }

  static readChannels() {
    Song.allChannels.length = 0;
    for (let i = 0; i < 64; i += 1) {
      const cInstrument = gProReader.readInt();
      const volume = Gp5Reader.convertTo127(gProReader.readByte());
      const balance = Gp5Reader.convertTo127(gProReader.readByte());
      const chorus = Gp5Reader.convertTo127(gProReader.readByte());
      const reverb = Gp5Reader.convertTo127(gProReader.readByte());
      const phaser = Gp5Reader.convertTo127(gProReader.readByte());
      const tremolo = Gp5Reader.convertTo127(gProReader.readByte());
      gProReader.skipBytes(2);
      const channelSetting = {
        cInstrument, volume, balance, chorus, reverb, phaser, tremolo,
      };
      Song.allChannels[i] = channelSetting;
    }
    return Song.allChannels;
  }

  static readMeasureHeaders(numMeasures: number) {
    for (let i = 0; i < numMeasures; i += 1) {
      if (i > 0) {
        gProReader.skipBytes(1);
      }
      Gp5Reader.readMeasureHeader(i);
    }
  }

  static readMeasureHeader(index: number) {
    const flags = gProReader.readUnsignedByte();

    Song.measureMeta[index].repeatOpen = (flags & 0x04) !== 0;
    if ((flags & 0x01) !== 0) {
      const numerator = gProReader.readByte();
      Song.measureMeta[index].numerator = numerator;
      Song.measureMeta[index].timeMeterPresent = true;
    }
    if ((flags & 0x02) !== 0) {
      const denominator = gProReader.readByte();
      Song.measureMeta[index].denominator = denominator;
      Song.measureMeta[index].timeMeterPresent = true;
    }
    if ((flags & 0x08) !== 0) {
      Song.measureMeta[index].repeatClosePresent = true;
      Song.measureMeta[index].repeatClose = (gProReader.readByte() & 0xff) - 1;
    }
    if ((flags & 0x20) !== 0) {
      Song.measureMeta[index].markerPresent = true;
      Song.measureMeta[index].marker = Gp5Reader.readMarker();
    }
    if ((flags & 0x10) !== 0) {
      Song.measureMeta[index].repeatAlternativePresent = true;
      Song.measureMeta[index].repeatAlternative = gProReader.readUnsignedByte();
    }
    if ((flags & 0x40) !== 0) {
      gProReader.readByte();
      gProReader.readByte();
    }
    if ((flags & 0x01) !== 0 || (flags & 0x02) !== 0) {
      gProReader.skipBytes(4);
    }
    if ((flags & 0x10) === 0) {
      gProReader.skipBytes(1);
    }
    // ignore triplet feel
    gProReader.readByte();
  }

  static readMarker() {
    const text = gProReader.readStringByteSizeOfInteger();
    const color = Gp5Reader.readColor();
    return { text, color };
  }

  static readColor() {
    const red = gProReader.readUnsignedByte();
    const green = gProReader.readUnsignedByte();
    const blue = gProReader.readUnsignedByte();
    gProReader.skipBytes(1);
    return { red, green, blue };
  }

  static readTracks(numTracks: number, versionIndex: number) {
    Song.tracks.length = 0;
    for (let i = 0; i < numTracks; i += 1) {
      Song.tracks[i] = Gp5Reader.readTrack(i + 1, versionIndex);
    }
    gProReader.skipBytes(versionIndex === 0 ? 2 : 1);
  }

  static readTrack(index: number, versionIndex: number): Track {
    gProReader.readUnsignedByte();
    if (index === 1 || versionIndex === 0) {
      gProReader.skipBytes(1);
    }
    const name = gProReader.readStringByte(40);
    console.log(name);

    const strings = [];
    const stringCount = gProReader.readInt();
    for (let i = 0; i < 7; i += 1) {
      const tuning = gProReader.readInt();
      if (stringCount > i) {
        strings[stringCount - 1 - i] = tuning;
      }
    }
    const numStrings = stringCount;
    const letItRing = false;
    // console.log(track);
    gProReader.readInt();
    const channel = Gp5Reader.readChannel();
    gProReader.readInt();

    const capo = gProReader.readInt();
    const color = Gp5Reader.readColor();
    gProReader.skipBytes(versionIndex > 0 ? 49 : 44);
    if (versionIndex > 0) {
      gProReader.readStringByteSizeOfInteger();
      gProReader.readStringByteSizeOfInteger();
    }
    return {
      name,
      strings,
      numStrings,
      letItRing,
      channel,
      capo,
      color,
      volume: 0,
      balance: 0,
      reverb: 0,
      program: -1,
      primaryChannel: -1,
    };
  }

  static readChannel() {
    const index = gProReader.readInt() - 1;
    const effectChannel = gProReader.readInt() - 1;
    return {
      index, effectChannel,
    };
  }

  static readMeasures(
    numMeasures: number, tracks: number, versionIndex: number,
  ) {
    Song.measures.length = 0;
    for (let j = 0; j < tracks; j += 1) {
      Song.measures[j] = [];
    }
    // console.log(measures);
    for (let i = 0; i < numMeasures; i += 1) {
      for (let j = 0; j < tracks; j += 1) {
        Gp5Reader.readMeasure(j, i, versionIndex);
        gProReader.skipBytes(1);
      }
    }
  }

  static readMeasure(trackId: number, blockId: number, versionIndex: number) {
    Song.measures[trackId][blockId] = [];
    for (let voiceId = 0; voiceId < 2; voiceId += 1) {
      Song.measures[trackId][blockId][voiceId] = [];
      const beats = gProReader.readInt();
      for (let i = 0; i < beats; i += 1) {
        Gp5Reader.readBeat(trackId, blockId, voiceId, i, versionIndex);
      }
    }
  }

  static readDuration(flags: number) {
    const value = gProReader.readByte();
    const dotted = (flags & 0x01) !== 0;
    let tuplet = 0;
    if ((flags & 0x20) !== 0) {
      tuplet = gProReader.readInt();
    }
    return {
      value, dotted, tuplet,
    };
  }

  static readBeat(
    trackId: number, blockId: number, voiceId: number, beatId: number, versionIndex: number,
  ) {
    let empty = false;
    let chordPresent = false;
    let chord = null;
    let textPresent = false;
    let text = '';
    let effects = Song.defaultMeasureEffects();
    const notes: Note[] = [];
    let duration = 'e';
    let dotted = false;
    let tuplet = 0;
    const flags = gProReader.readUnsignedByte();
    if ((flags & 0x40) !== 0) {
      const beatType = gProReader.readUnsignedByte();
      empty = (beatType & 0x02) === 0;
    }
    const durationValue = gProReader.readByte();
    duration = Gp5Reader.durationToString(durationValue); // s, e, q, w,
    dotted = (flags & 0x01) !== 0;
    if ((flags & 0x20) !== 0) {
      tuplet = gProReader.readInt();
    }
    chordPresent = (flags & 0x02) !== 0;
    if (chordPresent) {
      chord = Gp5Reader.readChord();
      Song.addChord(trackId, chord);
      (modalManager.getHandler(MODALS.ADD_CHORD.id) as ChordModalHandler).fillChordsPresets(trackId);
    }
    textPresent = (flags & 0x04) !== 0;
    if (textPresent) {
      text = gProReader.readStringByteSizeOfInteger();
    }
    if ((flags & 0x08) !== 0) {
      effects = Gp5Reader.readBeatEffects();
    }
    if ((flags & 0x10) !== 0) {
      Gp5Reader.readMixChange(blockId, versionIndex);
    }
    const stringFlags = gProReader.readUnsignedByte();
    for (let string = 6; string >= 0; string -= 1) {
      if ((stringFlags & (1 << string)) !== 0) {
        notes[Song.tracks[trackId].numStrings + string - 7] = Gp5Reader.readNote();
      }
    }
    if (notes.length === 0) {
      duration += 'r';
    }
    const measure = {
      empty,
      chordPresent,
      chord,
      textPresent,
      text,
      effects,
      notes,
      duration,
      dotted,
      tuplet,
    };
    Song.measures[trackId][blockId][voiceId][beatId] = { ...Song.defaultMeasure(), ...measure };

    gProReader.skipBytes(1);
    const read = gProReader.readByte();
    // if (read == 8 || read == 10 || read == 24 ) {
    if ((read & 0x08) !== 0) {
      gProReader.skipBytes(1);
    }
  }

  // -2:whole, -1:half, 0:quarter, 1:eighth, 2:sixteenth, ...
  static durationToString(duration: number): string {
    // only up to 256 = 2, o = 128, z=64
    const durationArray = ['w', 'h', 'q', 'e', 's', 't', 'z', 'o', '2'];
    if (duration + 2 > durationArray.length) {
      console.log('Such small note size is not permitted!');
      return '';
    }
    return durationArray[duration + 2];
  }

  static readChord(): Chord {
    gProReader.skipBytes(17);
    const name = gProReader.readStringByte(21);
    gProReader.skipBytes(4);
    const capo = gProReader.readInt();
    const frets = [];
    for (let i = 0; i < 7; i += 1) {
      frets[i] = gProReader.readInt();
    }
    gProReader.skipBytes(32);
    return {
      name, capo, frets, chordType: '', chordRoot: '', display: true, fingers: [],
    };
  }

  static readBeatEffects(): MeasureEffects {
    const flags1 = gProReader.readUnsignedByte();
    const flags2 = gProReader.readUnsignedByte();
    const fadeIn = (flags1 & 0x10) !== 0;
    const vibrato = (flags1 & 0x02) !== 0;
    let tap = false;
    let slap = false;
    let pop = false;
    if ((flags1 & 0x20) !== 0) {
      const tapEffect = gProReader.readUnsignedByte();
      tap = tapEffect === 1;
      slap = tapEffect === 2;
      pop = tapEffect === 3;
    }
    let tremoloBarPresent = false;
    let tremoloBar: TremoloBar = [];
    if ((flags2 & 0x04) !== 0) {
      tremoloBarPresent = true;
      tremoloBar = Gp5Reader.readTremoloBar();
    }
    let strokePresent = false;
    let stroke: Stroke = { strokeType: 'up', strokeLength: 0 };
    if ((flags1 & 0x40) !== 0) {
      // 0: none, 1: 128th, 2: 64th, 3: 32th, 4: 16th, 5: 8th, 6 4th
      const strokeUp = gProReader.readByte();
      const strokeDown = gProReader.readByte();
      strokePresent = true;
      if (strokeUp > 0) {
        stroke = {
          strokeType: 'up',
          strokeLength: gProReader.numToStrokeLength[strokeUp],
        };
      } else if (strokeDown > 0) {
        stroke = {
          strokeType: 'down',
          strokeLength: gProReader.numToStrokeLength[strokeDown],
        };
      }
    }
    if ((flags2 & 0x02) !== 0) {
      gProReader.readByte();
    }
    return {
      fadeIn, vibrato, tap, slap, pop, tremoloBarPresent, tremoloBar, strokePresent, stroke,
    };
  }

  static readTremoloBar() {
    const tremoloBar = [];
    gProReader.skipBytes(5);
    const numPoints = gProReader.readInt();
    for (let i = 0; i < numPoints; i += 1) {
      const position = gProReader.readInt();
      const value = gProReader.readInt();
      tremoloBar[i] = {
        position, value, vibrato: 0,
      };
      gProReader.readByte(); // vibrato
    }
    return tremoloBar;
  }

  static readMixChange(blockId: number, versionIndex: number) {
    gProReader.readByte(); // instrument
    gProReader.skipBytes(16);
    const volume = gProReader.readByte();
    const pan = gProReader.readByte();
    const chorus = gProReader.readByte();
    const reverb = gProReader.readByte();
    const phaser = gProReader.readByte();
    const tremolo = gProReader.readByte();
    gProReader.readStringByteSizeOfInteger(); // tempoName
    const tempoValue = gProReader.readInt();
    if (volume >= 0) {
      gProReader.readByte();
    }
    if (pan >= 0) {
      gProReader.readByte();
    }
    if (chorus >= 0) {
      gProReader.readByte();
    }
    if (reverb >= 0) {
      gProReader.readByte();
    }
    if (phaser >= 0) {
      gProReader.readByte();
    }
    if (tremolo >= 0) {
      gProReader.readByte();
    }
    if (tempoValue >= 0) {
      console.log(blockId, Song.measureMeta.length);
      Song.measureMeta[blockId].bpmPresent = true;
      Song.measureMeta[blockId].bpm = tempoValue;
      gProReader.skipBytes(1);
      if (versionIndex > 0) {
        gProReader.skipBytes(1);
      }
    }
    gProReader.readByte();
    gProReader.skipBytes(1);
    if (versionIndex > 0) {
      gProReader.readStringByteSizeOfInteger();
      gProReader.readStringByteSizeOfInteger();
    }
  }

  static readNote(): Note {
    const flags = gProReader.readUnsignedByte();
    const accentuated = (flags & 0x40) !== 0;
    const heavyAccentuated = (flags & 0x02) !== 0;
    const ghost = (flags & 0x04) !== 0;
    let tied = false;
    let dead = false;
    let dynamic = '';
    let fret = 0;
    if ((flags & 0x20) !== 0) {
      const noteType = gProReader.readUnsignedByte();
      if (noteType === 0x02) tied = true;
      if (noteType === 0x03) dead = true;
    }
    if ((flags & 0x10) !== 0) {
      const byteToDynamic = ['', 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'];
      dynamic = byteToDynamic[gProReader.readByte()];
    }
    if ((flags & 0x20) !== 0) {
      fret = gProReader.readByte();
    }
    if ((flags & 0x80) !== 0) {
      gProReader.skipBytes(2);
    }
    if ((flags & 0x01) !== 0) {
      gProReader.skipBytes(8);
    }
    gProReader.skipBytes(1);
    let noteEffects = {};
    if ((flags & 0x08) !== 0) {
      noteEffects = Gp5Reader.readNoteEffects();
    }
    const gp5Note = {
      fret, accentuated, heavyAccentuated, ghost, tied, dead, dynamic, ...noteEffects,
    };
    return { ...Song.defaultNote(), ...gp5Note };
  }

  static readNoteEffects() {
    const flags1 = gProReader.readUnsignedByte();
    const flags2 = gProReader.readUnsignedByte();
    let bendPresent = false;
    let bendObj: Bend = [];
    let gracePresent = false;
    let graceObj = {};
    let tremoloPicking = false;
    let tremoloPickingLength = '';
    let slide = false;
    let artificialPresent = false;
    let artificialStyle = '';
    let trillPresent = false;
    let trillObj = {};

    if ((flags1 & 0x01) !== 0) {
      bendPresent = true;
      bendObj = Gp5Reader.readBend();
    }
    if ((flags1 & 0x10) !== 0) {
      gracePresent = true;
      graceObj = Gp5Reader.readGrace();
    }
    if ((flags2 & 0x04) !== 0) {
      tremoloPicking = true;
      tremoloPickingLength = Gp5Reader.readTremoloPicking();
    }
    if ((flags2 & 0x08) !== 0) {
      slide = true;
      gProReader.readByte();
    }
    if ((flags2 & 0x10) !== 0) {
      artificialPresent = true;
      artificialStyle = Gp5Reader.readArtificialHarmonic();
    }
    if ((flags2 & 0x20) !== 0) {
      trillPresent = true;
      trillObj = Gp5Reader.readTrill();
    }
    const letRing = (flags1 & 0x08) !== 0;
    const pullDown = (flags1 & 0x02) !== 0;
    const vibrato = (flags2 & 0x40) !== 0;
    const palmMute = (flags2 & 0x02) !== 0;
    const stacatto = (flags2 & 0x01) !== 0;
    return {
      trillPresent,
      trillObj,
      gracePresent,
      graceObj,
      bendPresent,
      bendObj,
      tremoloPicking,
      tremoloPickingLength,
      slide,
      artificialPresent,
      artificialStyle,
      letRing,
      pullDown,
      vibrato,
      palmMute,
      stacatto,
    };
  }

  static readBend(): Bend {
    const bend = [];
    gProReader.skipBytes(5);
    const numPoints = gProReader.readInt();
    for (let i = 0; i < numPoints; i += 1) {
      const bendPosition = gProReader.readInt();
      const bendValue = gProReader.readInt();
      const vibrato = gProReader.readByte(); // vibrato
      bend[i] = {
        bendPosition, bendValue, vibrato,
      };
    }
    return bend;
  }

  static readGrace(): Grace {
    const fret = gProReader.readUnsignedByte();
    const dynamic = gProReader.readUnsignedByte();
    gProReader.readByte(); // const transition =
    const durationByte = gProReader.readUnsignedByte();
    let duration = '';
    if (durationByte === 1) {
      duration = 'o';
    } else if (durationByte === 2) {
      duration = 'z';
    } else {
      duration = 't';
    }
    const flags = gProReader.readUnsignedByte();
    const dead = (flags & 0x01) !== 0;
    const setOnBeat = (flags & 0x02) !== 0 ? 'before' : 'width';
    const byteToDynamic = ['', 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'];
    return {
      fret, dynamic: byteToDynamic[dynamic], transition: 'none', duration, dead, setOnBeat, string: 0, height: 0,
    };
  }

  static readTremoloPicking() {
    const value = gProReader.readUnsignedByte();
    if (value === 1) return 'e';
    if (value === 2) return 's';
    if (value === 3) return 't';
    return '';
  }

  static readArtificialHarmonic() {
    const type = gProReader.readByte();
    if (type === 1) {
      return 'N.H.'; // natural
    } if (type === 2) {
      gProReader.skipBytes(3);
      return 'A.H.'; // artificial
    } if (type === 3) {
      gProReader.skipBytes(1);
      return 'T.H.'; // tapped
    } if (type === 4) {
      return 'P.H.'; // pinch
    } if (type === 5) {
      return 'S.H.'; // semi
    }
    return '';
  }

  static readTrill() {
    const fret = gProReader.readByte();
    const period = gProReader.readByte(); // TODO: period: 1:s, 2:t, 3:64th
    return {
      fret, period,
    };
  }
}

const gp5Reader = new Gp5Reader();
export { gp5Reader, Gp5Reader };
