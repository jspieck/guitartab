import { Gp4Reader } from './GP4Reader';
import { Gp5Reader } from './GP5Reader';
import { gProReader } from './GProReader';
import Song, {
  Note, Chord, MeasureEffects, Stroke, Bend, Grace, TremoloBar,
} from './songData';
import { modalHandler } from './modalHandler';

class Gp3Reader {
  static read() {
    Song.chordsMap = [];
    Gp5Reader.readVersion();
    Gp4Reader.readInfo();

    gProReader.readByte(); // triplet feel
    const tempoValue = gProReader.readInt();
    Song.setTempo(tempoValue);
    console.log(`Tempo: ${tempoValue}`);

    // 0: C 1: G, -1: F
    gProReader.readByte(); // key signature
    gProReader.skipBytes(3);

    Gp5Reader.readChannels();

    const numMeasures = gProReader.readInt();
    const numTracks = gProReader.readInt();
    // Initialize per track
    for (let t = 0; t < numTracks; t += 1) {
      Song.chordsMap.push(new Map());
    }
    console.log(`NM: ${numMeasures}, NT: ${numTracks}`);

    Song.numMeasures = numMeasures;
    Song.measureMeta.length = 0;
    for (let i = 0; i < numMeasures; i += 1) {
      Song.measureMeta[i] = Song.defaultMeasureMeta();
    }
    Song.measureMeta[0].bpmPresent = true;
    Song.measureMeta[0].bpm = tempoValue;

    Gp4Reader.readMeasureHeaders(numMeasures);
    Gp4Reader.readTracks(numTracks);

    // CORRECT up to here
    Gp3Reader.readMeasures(numMeasures, numTracks);
  }

  static readMeasures(numMeasures: number, numTracks: number) {
    Song.measures.length = 0;
    for (let j = 0; j < numTracks; j += 1) {
      Song.measures[j] = [];
    }
    // console.log(Song.measures);
    for (let i = 0; i < numMeasures; i += 1) {
      for (let j = 0; j < numTracks; j += 1) {
        Gp3Reader.readMeasure(j, i);
      }
    }
  }

  static readMeasure(trackId: number, blockId: number) {
    Song.measures[trackId][blockId] = [];
    // only one single voice
    for (let voiceId = 0; voiceId < 2; voiceId += 1) {
      Song.measures[trackId][blockId][voiceId] = [];
      if (voiceId === 0) {
        const beats = gProReader.readInt();
        for (let i = 0; i < beats; i += 1) {
          Gp3Reader.readBeat(trackId, blockId, voiceId, i);
        }
      } else {
        for (let p = 0; p < 8; p += 1) {
          Song.measures[trackId][blockId][voiceId][p] = Song.defaultMeasure();
        }
      }
    }
  }

  static readBeat(
    trackId: number, blockId: number, voiceId: number, beatId: number,
  ) {
    const flags = gProReader.readUnsignedByte();
    let empty = false;
    if ((flags & 0x40) !== 0) {
      const beatType = gProReader.readUnsignedByte();
      empty = (beatType & 0x02) === 0;
    }

    const durationObj = Gp5Reader.readDuration(flags);
    let chordPresent = false;
    let chord = null;
    if ((flags & 0x02) !== 0) {
      chordPresent = true;
      chord = Gp3Reader.readChord();
      Song.addChord(trackId, chord);
      modalHandler.fillChordsPresets(trackId);
    }
    let textPresent = false;
    let text = '';
    let effects: MeasureEffects = Song.defaultMeasureEffects();
    if ((flags & 0x04) !== 0) {
      textPresent = true;
      text = gProReader.readStringByteSizeOfInteger();
    }
    if ((flags & 0x08) !== 0) {
      effects = Gp3Reader.readBeatEffects();
    }
    if ((flags & 0x10) !== 0) {
      Gp3Reader.readMixChange(blockId);
    }
    const stringFlags = gProReader.readUnsignedByte();
    const notes = [];
    for (let string = 6; string >= 0; string -= 1) {
      if ((stringFlags & (1 << string)) !== 0) {
        // var note = readNoteGP3();
        notes[Song.tracks[trackId].numStrings + string - 7] = Gp3Reader.readNote();
        // notes[string] = note;
      }
    }
    let durString = Gp5Reader.durationToString(durationObj.value); // s, e, q, w, h
    if (notes.length === 0) {
      durString += 'r';
    }
    Song.measures[trackId][blockId][voiceId][beatId] = {
      ...Song.defaultMeasure(),
      ...{
        empty,
        chordPresent,
        chord,
        textPresent,
        text,
        duration: durString,
        dotted: durationObj.dotted,
        tuplet: durationObj.tuplet,
        notes,
        effects,
      },
    };
  }

  static readChord(): Chord {
    const flag = gProReader.readUnsignedByte();
    if ((flag & 0x01) === 0) {
      const name = gProReader.readStringByteSizeOfInteger();
      const capo = gProReader.readInt();
      const frets: number[] = [];
      if (capo !== 0) {
        for (let i = 0; i < 6; i += 1) {
          frets[i] = gProReader.readInt();
        }
      }
      return {
        name, capo, frets, chordType: '', chordRoot: '', fingers: [], display: true,
      };
    }
    gProReader.skipBytes(25);
    const name: string = gProReader.readStringByte(34);
    const capo: number = gProReader.readInt();
    const frets: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      frets[i] = gProReader.readInt();
    }
    gProReader.skipBytes(36);
    return {
      name, capo, frets, chordType: '', chordRoot: '', fingers: [], display: true,
    };
  }

  static readBeatEffects() {
    const flags = gProReader.readUnsignedByte();
    const fadeIn = ((flags & 0x10) !== 0 || ((flags & 0x02) !== 0));
    const vibrato = ((flags & 0x02) !== 0);
    let tremoloBarPresent = false;
    let tremoloBar: TremoloBar = [];
    let tap = false;
    let slap = false;
    let pop = false;
    if ((flags & 0x20) !== 0) {
      const type = gProReader.readUnsignedByte();
      if (type === 0) {
        // REALLY?
        tremoloBarPresent = true;
        tremoloBar = Gp5Reader.readTremoloBar();
      } else {
        tap = (type === 1);
        slap = (type === 2);
        pop = (type === 3);
        gProReader.readInt();
      }
    }
    let strokePresent = false;
    let stroke: Stroke = { strokeType: 'up', strokeLength: 0 };
    if ((flags & 0x40) !== 0) {
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
    let harmonics = '';
    if ((flags & 0x04) !== 0) {
      harmonics = 'natural';
    }
    let artificialPresent = false;
    let artificialStyle = '';
    if ((flags & 0x08) !== 0) {
      artificialPresent = true;
      artificialStyle = 'N.H.';
    }
    return {
      fadeIn,
      vibrato,
      tremoloBarPresent,
      tremoloBar,
      tap,
      slap,
      pop,
      strokePresent,
      stroke,
      harmonics,
      artificialPresent,
      artificialStyle,
    };
  }

  static readNote(): Note {
    const flags = gProReader.readUnsignedByte();
    const ghost = (flags & 0x04) !== 0;
    let tied = false;
    let dead = false;
    let velocity = 0;
    let fret = 0;
    if ((flags & 0x20) !== 0) {
      const noteType = gProReader.readUnsignedByte();
      tied = (noteType === 0x02);
      dead = (noteType === 0x03);
    }
    if ((flags & 0x01) !== 0) {
      gProReader.skipBytes(2);
    }
    if ((flags & 0x10) !== 0) {
      velocity = gProReader.readByte();
    }
    if ((flags & 0x20) !== 0) {
      fret = gProReader.readByte();
    }
    if ((flags & 0x80) !== 0) {
      gProReader.skipBytes(2);
    }

    let effects: {
      pullDown: boolean, slide: boolean, letRing: boolean, bendPresent: boolean,
      bendObj: Bend, gracePresent: boolean, graceObj: Grace
    } = {
      pullDown: false,
      slide: false,
      letRing: false,
      bendPresent: false,
      bendObj: [],
      gracePresent: false,
      graceObj: {
        duration: 'e',
        setOnBeat: '',
        dynamic: 'mf',
        transition: '',
        fret: 0,
        string: 0,
        height: 0,
        dead: false,
      },
    };
    if ((flags & 0x08) !== 0) {
      effects = Gp3Reader.readNoteEffects();
    }
    const note = {
      ghost,
      tied,
      dead,
      velocity,
      fret,
      ...effects,
    };
    return { ...Song.defaultNote(), ...note };
  }

  static readNoteEffects() {
    const flags = gProReader.readUnsignedByte();
    const pullDown = (flags & 0x02) !== 0;
    const slide = (flags & 0x04) !== 0;
    const letRing = (flags & 0x08) !== 0;

    let bendPresent = false;
    let bendObj: Bend = [];
    if ((flags & 0x01) !== 0) {
      bendPresent = true;
      bendObj = Gp5Reader.readBend();
    }
    let gracePresent = false;
    let graceObj: Grace = {
      duration: 'e',
      setOnBeat: '',
      dynamic: 'mf',
      transition: '',
      fret: 0,
      string: 0,
      height: 0,
      dead: false,
    };
    if ((flags & 0x10) !== 0) {
      gracePresent = true;
      graceObj = Gp4Reader.readGrace();
    }
    return {
      pullDown,
      slide,
      letRing,
      bendPresent,
      bendObj,
      gracePresent,
      graceObj,
    };
  }

  static readMixChange(blockId: number) {
    gProReader.readByte(); // instrument
    const volume = gProReader.readByte();
    const pan = gProReader.readByte();
    const chorus = gProReader.readByte();
    const reverb = gProReader.readByte();
    const phaser = gProReader.readByte();
    const tremolo = gProReader.readByte();
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
      Song.measureMeta[blockId].bpmPresent = true;
      Song.measureMeta[blockId].bpm = tempoValue;
      gProReader.readByte();
    }
  }
}

const gp3Reader = new Gp3Reader();
export { gp3Reader, Gp3Reader };
export default gp3Reader;
