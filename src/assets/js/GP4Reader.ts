import { Gp5Reader } from './GP5Reader';
import { gProReader } from './GProReader';
import Song, {
  Grace, Note, Chord, Track,
} from './songData';
import { IMPORT_LIMITS, ImportError } from '../../services/importErrors';
import AppManager from './appManager';

class Gp4Reader {
  static read() {
    Song.chordsMap = [];
    const version = Gp5Reader.readVersion();
    if (!version.startsWith('FICHIER GUITAR PRO v4')) {
      throw new ImportError(`Unsupported Guitar Pro version "${version}". Open a Guitar Pro 4 file here.`, 'gp4');
    }
    Gp4Reader.readInfo();

    gProReader.readByte(); // triplet feel
    gProReader.readInt(); // lyric track
    Gp5Reader.readLyrics();

    const tempoValue = gProReader.readInt();
    Song.setTempo(tempoValue);

    gProReader.readInt(); // key
    gProReader.readByte(); // octave

    Gp5Reader.readChannels();

    const numMeasures = gProReader.readCount(IMPORT_LIMITS.measures, 'bars');
    const numTracks = gProReader.readCount(IMPORT_LIMITS.tracks, 'tracks');
    for (let t = 0; t < numTracks; t += 1) {
      Song.chordsMap.push(new Map());
    }
    // console.log("TRACKS: "+numTracks);
    Song.numMeasures = numMeasures;
    Song.measureMeta.length = 0;
    for (let i = 0; i < numMeasures; i += 1) {
      Song.measureMeta[i] = Song.defaultMeasureMeta();
    }
    Song.measureMeta[0].bpm = tempoValue;

    Gp4Reader.readMeasureHeaders(numMeasures);
    Gp4Reader.readTracks(numTracks);

    Gp4Reader.readMeasures(numMeasures, numTracks);
    return true;
  }

  static readInfo() {
    Song.songDescription.title = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.subtitle = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.artist = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.album = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.author = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.copyright = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.writer = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.instructions = gProReader.readStringByteSizeOfInteger();
    Song.songDescription.comments = [];
    const comments = gProReader.readCount(IMPORT_LIMITS.comments, 'comment lines');
    for (let i = 0; i < comments; i += 1) {
      Song.songDescription.comments[i] = gProReader.readStringByteSizeOfInteger();
    }
    AppManager.setTrackInfo();
  }

  static readMeasureHeaders(numMeasures: number) {
    for (let i = 0; i < numMeasures; i += 1) {
      Gp4Reader.readMeasureHeader(i);
    }
  }

  static readMeasureHeader(index: number) {
    const flags = gProReader.readUnsignedByte();
    // A bar only stores its time signature when it changes; otherwise it keeps the previous one.
    const previous = Song.measureMeta[index - 1];
    if (previous != null) {
      Song.measureMeta[index].numerator = previous.numerator;
      Song.measureMeta[index].denominator = previous.denominator;
    }
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
      Song.measureMeta[index].repeatClose = gProReader.readByte();
    }
    if ((flags & 0x10) !== 0) {
      Song.measureMeta[index].repeatAlternative = gProReader.readUnsignedByte();
    }
    if ((flags & 0x20) !== 0) {
      Song.measureMeta[index].marker = Gp5Reader.readMarker();
    }
    if ((flags & 0x40) !== 0) {
      Song.measureMeta[index].keySignature = gProReader.readByte();
      gProReader.readByte();
    }
  }

  static readTracks(numTracks: number) {
    Song.tracks.length = 0;
    for (let i = 1; i <= numTracks; i += 1) {
      Song.tracks[i - 1] = Gp4Reader.readTrack();
    }
  }

  static readTrack(): Track {
    const trackFlag = gProReader.readUnsignedByte();
    const name = gProReader.readStringByte(40, true);
    const strings = [];
    const stringCount = gProReader.readInt();
    console.log("SC", stringCount)
    for (let i = 0; i < 7; i += 1) {
      const tuning = gProReader.readInt();
      if (stringCount > i) {
        strings[stringCount - 1 - i] = tuning;
      }
    }
    const numStrings = stringCount;
    const letItRing = false;
    gProReader.readInt();
    const channel = Gp5Reader.readChannel();
    gProReader.readInt();

    const capo = gProReader.readInt();
    const color = Gp5Reader.readColor();
    const trackGp4 = {
      name, strings, numStrings, letItRing, channel, capo, color,
    };
    return { ...Song.defaultTrack(), ...trackGp4 };
  }

  static readMeasures(numMeasures: number, numTracks: number) {
    Song.measures.length = 0;
    for (let j = 0; j < numTracks; j += 1) {
      Song.measures[j] = [];
    }
    for (let i = 0; i < numMeasures; i += 1) {
      for (let j = 0; j < numTracks; j += 1) {
        Gp4Reader.readMeasure(j, i);
      }
    }
  }

  static readMeasure(trackId: number, blockId: number) {
    Song.measures[trackId][blockId] = [];
    // only one single voice
    for (let voiceId = 0; voiceId < 2; voiceId += 1) {
      Song.measures[trackId][blockId][voiceId] = [];
      if (voiceId === 0) {
        const beats = gProReader.readCount(IMPORT_LIMITS.beatsPerVoice, 'beats in a bar');
        for (let i = 0; i < beats; i += 1) {
          Gp4Reader.readBeat(trackId, blockId, voiceId, i);
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
    let chord: Chord | undefined;
    if ((flags & 0x02) !== 0) {
      chord = Gp4Reader.readChord();
      Song.addChord(trackId, chord);
    }
    let text: string | undefined;
    if ((flags & 0x04) !== 0) {
      text = gProReader.readStringByteSizeOfInteger();
    }
    let effects = Song.defaultMeasureEffects();
    if ((flags & 0x08) !== 0) {
      effects = Gp5Reader.readBeatEffects();
    }
    if ((flags & 0x10) !== 0) {
      Gp4Reader.readMixChange(blockId);
    }
    const stringFlags = gProReader.readUnsignedByte();
    const notes: Note[] = [];
    for (let string = 6; string >= 0; string -= 1) {
      if ((stringFlags & (1 << string)) !== 0) {
        notes[Song.tracks[trackId].numStrings + string - 7] = Gp4Reader.readNote();
      }
    }
    let durString = Gp5Reader.durationToString(durationObj.value); // s, e, q, w, h
    if (notes.length === 0) {
      durString += 'r';
    }
    const { dotted } = durationObj;
    const { tuplet } = durationObj;
    const beatMeta = {
      empty,
      duration: durString,
      dotted,
      tuplet,
      notes,
      text,
      chord,
      effects,
    };
    Song.measures[trackId][blockId][voiceId][beatId] = {
      ...Song.defaultMeasure(),
      ...beatMeta,
    };
  }

  static readChord(): Chord {
    const flag = gProReader.readUnsignedByte();
    let name = '';
    let capo = 0;
    const frets = [];
    if ((flag & 0x01) === 0) {
      name = gProReader.readStringByteSizeOfInteger();
      capo = gProReader.readInt();
      if (capo !== 0) {
        for (let i = 0; i < 6; i += 1) {
          frets[i] = gProReader.readInt();
        }
      }
    } else {
      gProReader.skipBytes(16);
      name = gProReader.readStringByte(21);
      gProReader.skipBytes(4);
      capo = gProReader.readInt();
      for (let i = 0; i < 7; i += 1) {
        frets[i] = gProReader.readInt();
      }
      gProReader.skipBytes(32);
    }
    const chord = {
      name, capo, frets, fingers: [], chordType: '', chordRoot: '', display: true,
    };
    return chord;
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
      Song.measureMeta[blockId].bpm = tempoValue;
      gProReader.readByte();
    }
    gProReader.readByte();
  }

  static readNote() {
    const flags = gProReader.readUnsignedByte();
    const ghost = (flags & 0x04) !== 0;
    let tied = false;
    let dead = false;
    let fret = 0;
    if ((flags & 0x20) !== 0) {
      const noteType = gProReader.readUnsignedByte();
      if (noteType === 0x02) {
        tied = true;
      }
      if (noteType === 0x03) {
        dead = true;
      }
    }
    if ((flags & 0x01) !== 0) {
      gProReader.skipBytes(2);
    }
    if ((flags & 0x10) !== 0) {
      gProReader.readByte(); // velocity
    }
    if ((flags & 0x20) !== 0) {
      fret = gProReader.readByte();
    }
    if ((flags & 0x80) !== 0) {
      gProReader.skipBytes(2);
    }
    const note = {
      ...Song.defaultNote(),
      ...{
        ghost, dead, fret, tied,
      },
    };
    if ((flags & 0x08) !== 0) {
      Gp4Reader.readNoteEffects(note);
    }
    return note;
  }

  static readNoteEffects(noteIn: Note) {
    const note = noteIn;
    const flags1 = gProReader.readUnsignedByte();
    const flags2 = gProReader.readUnsignedByte();
    if ((flags1 & 0x01) !== 0) {
      note.bendObj = Gp5Reader.readBend();
    }
    if ((flags1 & 0x10) !== 0) {
      note.graceObj = Gp4Reader.readGrace();
    }
    if ((flags2 & 0x04) !== 0) {
      note.tremoloPicking = true;
      note.tremoloPickingLength = Gp5Reader.readTremoloPicking();
    }
    if ((flags2 & 0x08) !== 0) {
      note.slide = true;
      gProReader.readByte();
    }
    if ((flags2 & 0x10) !== 0) {
      note.artificialStyle = Gp5Reader.readArtificialHarmonic();
    }
    if ((flags2 & 0x20) !== 0) {
      note.trill = Gp5Reader.readTrill();
    }
    note.letRing = ((flags1 & 0x08) !== 0);
    note.pullDown = ((flags1 & 0x02) !== 0);
    note.vibrato = ((flags2 & 0x40) !== 0);
    note.palmMute = ((flags2 & 0x02) !== 0);
    note.stacatto = ((flags2 & 0x01) !== 0);
  }

  static readGrace(): Grace {
    const setOnBeat = 'before';
    const fret = gProReader.readUnsignedByte();
    const dead = (fret === 255);
    const dynamic = gProReader.readUnsignedByte();
    gProReader.readUnsignedByte(); // const transition =
    const durationByte = gProReader.readUnsignedByte();
    const duration = Gp5Reader.graceDurationFromByte(durationByte);
    const byteToDynamic = ['', 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'];
    return {
      setOnBeat,
      fret,
      dead,
      dynamic: byteToDynamic[dynamic],
      transition: 'none',
      duration,
      string: 0,
      height: 0,
    };
  }
}

const gp4Reader = new Gp4Reader();
export { gp4Reader, Gp4Reader };
