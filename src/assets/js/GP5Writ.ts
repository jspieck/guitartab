import Song, {
  TremoloBar, Grace, Note, Bend, MeasureEffects, Chord,
} from './songData';
import { gProReader } from './GProReader';

const PAGE_SETUP_LINES = [
  '%TITLE%',
  '%SUBTITLE%',
  '%ARTIST%',
  '%ALBUM%',
  'Words by %WORDS%',
  'Music by %MUSIC%',
  'Words & Music by %WORDSMUSIC%',
  'Copyright %COPYRIGHT%',
  'All Rights Reserved - International Copyright Secured',
  'Page %N%/%P%',
  'Moderate',
];
const VERSION = 'FICHIER GUITAR PRO v5.00';

class GP5Writer {
    bytePosition: number;

    finishedFile: number[];

    constructor() {
      this.bytePosition = 0;
      this.finishedFile = [];
    }

    writeSong(promptDialog: boolean) {
      this.bytePosition = 0;
      // finishedFile = new Uint8Array(100000); //TODO
      this.finishedFile.length = 0;

      this.writeStringByte(VERSION, 30);
      // Format: integer (4byte, size of string+1 +data)
      // now write title/subtitle/artist/album/author/musicby/copyright/writer/...
      this.writeStringByteSizeOfInteger(Song.songDescription.title); // title
      this.writeStringByteSizeOfInteger(Song.songDescription.subtitle); // subtitle
      this.writeStringByteSizeOfInteger(Song.songDescription.artist); // artist
      this.writeStringByteSizeOfInteger(Song.songDescription.album); // album
      this.writeStringByteSizeOfInteger(Song.songDescription.author); // author
      this.writeStringByteSizeOfInteger(Song.songDescription.music); // ...
      this.writeStringByteSizeOfInteger(Song.songDescription.copyright); // copyright
      this.writeStringByteSizeOfInteger(Song.songDescription.writer); // writer
      this.writeStringByteSizeOfInteger(Song.songDescription.instructions); // ...
      // write comments
      this.writeComments(Song.songDescription.comments);
      // write lyrics
      this.writeLyrics(); // no lyrics at the moment

      // page setup
      this.writePageSetup();

      this.writeInteger(Song.bpm); // write tempo
      this.writeInteger(0); // no idea :)
      this.writeByte(0); // write key?   -1:F, 0:C, 1:G, 2:D
      this.writeChannels();
      for (let i = 0; i < 42; i += 1) {
        this.writeByte(255);
      }
      this.writeInteger(Song.numMeasures); // number of measures
      this.writeInteger(Song.tracks.length); // number of tracks

      this.writeMeasureHeaders();

      this.writeTracks();

      this.skipBytesWrite(2);
      this.writeMeasures();

      const byteArray = new Uint8Array(this.finishedFile.length);
      for (let i = 0, n = this.finishedFile.length; i < n; i += 1) {
        byteArray[i] = this.finishedFile[i];
      }
      GP5Writer.writeFile(byteArray, promptDialog);
    }

    skipBytesWrite(num: number) {
      for (let i = 0; i < num; i += 1) {
        this.writeByte(0);
      }
    }

    static writeFile(sampleBytes: BlobPart, promptDialog: boolean) {
      const saveByteArray = () => {
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        return (data: BlobPart[], name: string) => {
          const blob = new Blob(data, { type: 'octet/stream' });
          const url = window.URL.createObjectURL(blob);
          a.href = url;
          a.download = name;
          a.click();
          window.URL.revokeObjectURL(url);
        };
      };
      if (promptDialog) {
        saveByteArray()([sampleBytes], 'saveAs');
      } else {
        saveByteArray()([sampleBytes], 'guitarTab.gp5');
      }
    }

    writeInteger(size: number) {
      // 4bytes, first LSB left to MSB right
      this.writeByte(size & 255);
      this.writeByte((size >> 8) & 255);
      this.writeByte((size >> 16) & 255);
      this.writeByte((size >> 24) & 255);
    }

    writeByte(byte: number) {
      this.finishedFile[this.bytePosition] = byte;
      this.bytePosition += 1;
    }

    writeUnsignedByte(byte: number) {
      this.finishedFile[this.bytePosition] = byte & 255;
      this.bytePosition += 1;
    }

    static pack(bytes: number[]) {
      const chars = [];
      for (let i = 0, n = bytes.length; i < n; i += 2) {
        chars.push(((bytes[i] & 0xff) << 8) | (bytes[i + 1] & 0xff));
      }
      return String.fromCharCode.apply(null, chars);
    }

    // Problem: chars greater >65636
    static unpack(str: string) {
      const utf8 = unescape(encodeURIComponent(str));
      const arr = [];
      for (let i = 0; i < utf8.length; i += 1) {
        arr[i] = utf8.charCodeAt(i);
      }
      return arr;
    }

    writeString(bytes: number[], maximumLength: number) {
      const length = maximumLength === 0 || maximumLength > bytes.length
        ? bytes.length
        : maximumLength;
      for (let i = 0; i < length; i += 1) {
        this.writeByte(bytes[i]);
      }
    }

    writeBytes(bytes: number[]) {
      for (let i = 0, n = bytes.length; i < n; i += 1) {
        this.writeByte(bytes[i]);
      }
    }

    writeStringByte(str: string, size: number) {
      const bytes = GP5Writer.unpack(str);
      this.writeByte(size === 0 || size > bytes.length ? bytes.length : size);
      this.writeString(bytes, size);
      // console.log("SB: "+size+", "+bytes.length);
      this.skipBytesWrite(size - bytes.length);
    }

    writeStringByteSizeOfInteger(string: string) {
      const bytes = GP5Writer.unpack(string);
      this.writeInteger(bytes.length + 1);
      this.writeStringByte(string, bytes.length);
    }

    writeColor(color: {red: number, green: number, blue: number}) {
      this.writeUnsignedByte(color.red);
      this.writeUnsignedByte(color.green);
      this.writeUnsignedByte(color.blue);
      this.writeByte(0);
    }

    writeMarker(marker: {text: string, color: {red: number, green: number, blue: number}}) {
      this.writeStringByteSizeOfInteger(marker.text);
      this.writeColor(marker.color);
    }

    writeComments(comments: string[]) {
      this.writeInteger(comments.length);
      for (let i = 0; i < comments.length; i += 1) {
        this.writeStringByteSizeOfInteger(comments[i]);
      }
    }

    writeLyrics() {
      this.writeInteger(0); // no of track lyrics are associated
      this.writeInteger(0); // no of characters in the string

      this.writeInteger(0); // actually lyrics string, but 0 here
      // string itself without size in front of it
      for (let i = 0; i < 4; i += 1) {
        this.writeInteger(0); // length of lyrics
        this.writeInteger(0); // actually lyrics string but 0 here
      }
    }

    writePageSetup() {
      this.writeInteger(210); // Page width
      this.writeInteger(297); // Page height
      this.writeInteger(10); // Margin left
      this.writeInteger(10); // Margin right
      this.writeInteger(15); // Margin top
      this.writeInteger(10); // Margin bottom
      this.writeInteger(100); // Score size percent

      this.writeByte(255); // View flags
      this.writeByte(1); // View flags

      for (let i = 0, n = PAGE_SETUP_LINES.length; i < n; i += 1) {
        this.writeInteger(PAGE_SETUP_LINES[i].length + 1);
        this.writeStringByte(PAGE_SETUP_LINES[i], 0);
      }
    }

    static convertTo16(value: number) {
      return Math.round((value + 1) / 8);
    }

    writeChannels() {
      // first write back trackInfo to corresponding channel
      for (let i = 0; i < Song.tracks.length; i += 1) {
        const channelIndex = Song.tracks[i].channel.index;
        const { cInstrument } = Song.allChannels[channelIndex];
        Song.allChannels[channelIndex] = { cInstrument, ...Song.playBackInstrument[i] };
      }
      for (let i = 0; i < 64; i += 1) {
        const channel = Song.allChannels[i];
        this.writeInteger(channel.cInstrument); // instrument (int)
        this.writeByte(GP5Writer.convertTo16(channel.volume)); // volume (byte)
        this.writeByte(GP5Writer.convertTo16(channel.balance)); // balance (byte)
        this.writeByte(GP5Writer.convertTo16(channel.chorus)); // chorus (byte)
        this.writeByte(GP5Writer.convertTo16(channel.reverb)); // reverb (byte)
        this.writeByte(GP5Writer.convertTo16(channel.phaser)); // phaser (byte)
        this.writeByte(GP5Writer.convertTo16(channel.tremolo)); // tremolo (byte)
        this.writeByte(0); // backwards compatibility
        this.writeByte(0); // backwards compatibility
      }
    }

    writeMeasureHeaders() {
      for (let i = 0; i < Song.numMeasures; i += 1) {
        if (i > 0) {
          this.skipBytesWrite(1);
        }
        this.writeMeasureHeader(i);
      }
    }

    writeMeasureHeader(num: number) {
      const meta = Song.measureMeta[num];
      let flags = 0;
      if (
        (num === 0 && meta.numerator != null)
            || (num !== 0 && meta.numerator !== Song.measureMeta[num - 1].numerator)
            || meta.denominator !== Song.measureMeta[num - 1].denominator
      ) {
        flags |= 0x01; // is ZÄHLER of time signature present
        flags |= 0x02; // is NENNER of time signature present
      }
      if (meta.repeatOpen) {
        flags |= 0x04; // is repeatStart present
      }
      if (meta.repeatClose !== undefined) {
        flags |= 0x08; // is repeatEnd present
      }
      if (meta.repeatAlternative !== undefined) {
        flags |= 0x10; // numOfAlternativeEndings is present
      }
      if (meta.marker !== undefined) {
        flags |= 0x20; // is a marker present in this measure
      }
      if (num === 1) {
        // TODO
        flags |= 0x40; // new key signature in that measure
      }
      this.writeUnsignedByte(flags);

      // VierViertel-Takt
      if ((flags & 0x01) !== 0) this.writeByte(meta.numerator);
      if ((flags & 0x02) !== 0) this.writeByte(meta.denominator);
      if ((flags & 0x08) !== 0) this.writeByte(meta.repeatClose);
      if ((flags & 0x20) !== 0) this.writeMarker(meta.marker);
      if ((flags & 0x10) !== 0) this.writeByte(meta.repeatAlternative);
      if ((flags & 0x40) !== 0) this.skipBytesWrite(2);

      // do not know what is done here
      if ((flags & 0x01) !== 0) { this.writeBeamEighthNoteBytes(meta.numerator, meta.denominator); }

      if ((flags & 0x10) === 0) this.writeByte(0);

      // TODO no triplet feel
      this.writeByte(0);
    }

    writeBeamEighthNoteBytes(numerator: number, denominator: number) {
      const bytes = [0, 0, 0, 0];
      if (denominator <= 8) {
        const eighthsInDenominator = 8 / denominator;
        const total = eighthsInDenominator * numerator;
        const byteValue = total / 4;
        const missingValue = total - 4 * byteValue;
        for (let i = 0; i < bytes.length; i += 1) {
          bytes[i] = byteValue;
        }
        if (missingValue > 0) {
          bytes[0] += missingValue;
        }
      }
      for (let i = 0; i < bytes.length; i += 1) this.writeByte(bytes[i]);
    }

    writeTracks() {
      for (let i = 0; i < Song.tracks.length; i += 1) {
        this.writeTrack(i);
      }
    }

    writeTrack(trackId: number) {
      const track = Song.tracks[trackId];
      let flags = 0;
      if (Song.tracks[trackId].primaryChannel === 9) {
        flags |= 0x01;
      }
      this.writeUnsignedByte(flags);
      this.writeUnsignedByte(8 | flags);

      this.writeStringByte(track.name, 40); // Name of track (40 bytes long string)
      const numStrings = Math.min(track.strings.length, 7); // GP5 only allows up to 7 strings
      this.writeInteger(numStrings); // number of strings (integer)
      // tuning of strings (integer table), 7 integers
      for (let i = 0; i < 7; i += 1) {
        if (i < numStrings) this.writeInteger(track.strings[numStrings - 1 - i]);
        else this.writeInteger(0);
      }
      this.writeInteger(1); // midi port (integer)
      this.writeInteger(track.channel.index + 1); // midi channel (integer)
      this.writeInteger(track.channel.effectChannel + 1); // midi ChannelEffect (integer)
      this.writeInteger(24); // number of frets (integer)
      this.writeInteger(track.capo); // height of the capo (integer)
      this.writeColor(track.color);

      // do not know what that does???
      const bytes = [
        67, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7,
        8, 9, 10, -1, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      ];
      for (let i = 0; i < bytes.length; i += 1) {
        this.writeByte(bytes[i]);
      }
    }

    writeMeasures() {
      for (let i = 0; i < Song.measures[0].length; i += 1) {
        for (let j = 0; j < Song.measures.length; j += 1) {
          this.writeMeasure(j, i);
          this.skipBytesWrite(1);
        }
      }
    }

    writeMeasure(trackId: number, blockId: number) {
      // we have no second voice, so write empty
      for (let voiceId = 0; voiceId < 2; voiceId += 1) {
        // let numBeat = 8; //8 notes, eights
        const numBeats = Song.measures[trackId][blockId][voiceId].length;
        this.writeInteger(numBeats);
        for (let beatId = 0; beatId < numBeats; beatId += 1) {
          this.writeBeat(trackId, blockId, voiceId, beatId);
        }
      }
    }

    writeChord(chord: Chord) {
      this.writeBytes([1, 1, 0, 0, 0, 12, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0]);
      this.writeStringByte(chord.name, 21);
      this.skipBytesWrite(4);
      this.writeInteger(chord.capo);
      for (let i = 0; i < 7; i += 1) {
        this.writeInteger(i < chord.frets.length ? chord.frets[i] : -1);
      }
      this.skipBytesWrite(32);
    }

    static typeToNum(type: string) {
      if (type === 'w' || type === 'wr') return -2;
      if (type === 'h' || type === 'hr') return -1;
      if (type === 'q' || type === 'qr') return 0;
      if (type === 'e' || type === 'er') return 1;
      if (type === 's' || type === 'sr') return 2;
      if (type === 't' || type === 'tr') return 3;
      throw new Error('Duration type not supported');
    }

    writeBeat(trackId: number, blockId: number, voiceId: number, beatId: number) {
      // console.log(trackId+" "+blockId+" "+beatId);
      const beat = Song.measures[trackId][blockId][voiceId][beatId];
      // write beat header
      let flags = 0;
      if (beat.dotted || beat.doubleDotted) {
        flags |= 0x01;
      }
      if (beat.chordPresent) {
        flags |= 0x02;
      }
      if (beat.textPresent) {
        flags |= 0x04;
      }
      const eff = beat.effects;
      if (
        eff.fadeIn
        || eff.vibrato
        || eff.tap
        || eff.slap
        || eff.pop
        || eff.tremoloBarPresent
        || eff.strokePresent
      ) {
        flags |= 0x08;
      }
      if (Song.measureMeta[blockId].bpm != null) {
        // is a change event present
        flags |= 0x10;
      }
      if (beat.tuplet != null) {
        // is beat a n-tuplet
        flags |= 0x20;
      }
      if (beat.empty || beat.duration.length > 1) {
        flags |= 0x40;
      }

      // WRITE
      this.writeUnsignedByte(flags);
      if ((flags & 0x40) !== 0) {
        this.writeUnsignedByte(beat.empty ? 0x00 : 0x02);
      }
      this.writeByte(GP5Writer.typeToNum(beat.duration));
      if ((flags & 0x20) !== 0) {
        this.writeInteger(beat.tuplet!);
      }
      if ((flags & 0x02) !== 0) {
        this.writeChord(beat.chord!);
      }
      if ((flags & 0x04) !== 0) {
        this.writeStringByteSizeOfInteger(beat.text);
      }
      if ((flags & 0x08) !== 0) {
        this.writeBeatEffects(eff);
      }
      if ((flags & 0x10) !== 0) {
        this.writeMixChange(Song.measureMeta[blockId].bpm);
      }

      let stringFlags = 0;
      const numStrings = Math.min(Song.tracks[trackId].numStrings, 7);
      for (let k = 0; k < beat.notes.length; k += 1) {
        if (beat.notes[k] != null) {
          stringFlags |= 1 << (7 - numStrings + k);
        }
      }
      this.writeByte(stringFlags);
      for (let string = 6; string >= 0; string -= 1) {
        // assuming 7 string guitar, write all strings
        if ((stringFlags & (1 << string)) !== 0) {
          // each string marked in flag is written
          if (beat.notes[numStrings - 7 + string] != null) {
            this.writeNote(beat.notes[numStrings - 7 + string]!, beat.dynamic);
          }
        }
      }

      /* let stringFlags = readUnsignedByte();
        let notes = [];
        for (let string = 6; string >= 0; string -= 1) {
            if ((stringFlags & (1 << string)) != 0) {
                notes[Song.tracks[trackId].numStrings + string - 7] = readNote();
            }
        } */

      this.skipBytesWrite(2);
    }

    writeMixChange(bpm: number) {
      this.writeByte(0xff);
      for (let i = 0; i < 16; i += 1) {
        this.writeByte(0xff);
      }
      this.writeByte(0xff); // volume
      this.writeByte(0xff); // int pan
      this.writeByte(0xff); // int chorus
      this.writeByte(0xff); // int reverb
      this.writeByte(0xff); // int phaser
      this.writeByte(0xff); // int tremolo
      this.writeStringByteSizeOfInteger(''); // tempo name
      this.writeInteger(bpm); // tempo value
      gProReader.skipBytes(1);
      this.writeByte(1);
      this.writeByte(0xff);
    }

    writeNote(note: Note, dynamic: string) {
      let flags = 0x20;

      if (dynamic != null) {
        flags |= 0x10;
      }
      if (note.heavyAccentuated) {
        // is the note dotted
        flags |= 0x02;
      }
      if (note.ghost) {
        // is the note a ghost note
        flags |= 0x04;
      }
      if (
        note.vibrato
            || note.bendPresent
            || note.slide
            || note.pullDown
            || note.letRing
            || note.palmMute
            || note.stacatto
            || note.trillPresent
            || note.gracePresent
            || note.artificialPresent
            || note.tremoloPicking
      ) {
        flags |= 0x08;
      }
      if (note.accentuated) {
        // is note accentuated
        flags |= 0x40;
      }
      this.writeUnsignedByte(flags);

      if ((flags & 0x20) !== 0) {
        let typeHeader = 0x01; // normal note
        if (note.tied) {
          typeHeader = 0x02;
        } else if (note.dead) {
          typeHeader = 0x03;
        }
        this.writeByte(typeHeader);
      }

      if ((flags & 0x10) !== 0) {
        const dynamicToCode: {[a: string]: number} = {
          ppp: 1,
          pp: 2,
          p: 3,
          mp: 4,
          mf: 5,
          f: 6,
          ff: 7,
          fff: 8,
        };
        this.writeByte(dynamicToCode[dynamic]);
      }
      // let fretNumber = 2;
      if ((flags & 0x20) !== 0) {
        this.writeByte(note.fret);
      }
      gProReader.skipBytes(1);
      if ((flags & 0x08) !== 0) {
        this.writeNoteEffects(note);
      }
    }

    writeNoteEffects(effect: Note) {
      let flags1 = 0;
      let flags2 = 0;

      if (effect.bendPresent) {
        flags1 |= 0x01;
      }
      if (effect.pullDown) {
        flags1 |= 0x02;
      }
      if (effect.letRing) {
        flags1 |= 0x08;
      }
      if (effect.gracePresent) {
        flags1 |= 0x10;
      }
      if (effect.stacatto) {
        flags2 |= 0x01;
      }
      if (effect.palmMute) {
        flags2 |= 0x02;
      }
      if (effect.tremoloPicking) {
        flags2 |= 0x04;
      }
      if (effect.slide) {
        flags2 |= 0x08;
      }
      if (effect.artificialPresent) {
        flags2 |= 0x10;
      }
      if (effect.trillPresent) {
        flags2 |= 0x20;
      }
      if (effect.vibrato) {
        flags2 |= 0x40;
      }
      this.writeUnsignedByte(flags1);
      this.writeUnsignedByte(flags2);
      if ((flags1 & 0x01) !== 0) {
        this.writeBend(effect.bendObj);
      }

      if ((flags1 & 0x10) !== 0) {
        this.writeGrace(effect.graceObj);
      }

      if ((flags2 & 0x04) !== 0) {
        this.writeTremoloPicking(effect.tremoloPickingLength);
      }

      if ((flags2 & 0x08) !== 0) {
        this.writeByte(1);
      }

      if ((flags2 & 0x10) !== 0) {
        this.writeByte(1);
      }

      if ((flags2 & 0x20) !== 0) {
        this.writeTrill(effect);
      }
    }

    writeTrill(trill: {fret: number}) {
      this.writeByte(trill.fret);
      this.writeByte(1); // period: 1 = sixteenth
    }

    writeTremoloPicking(length: string) {
      if (length === 'e') this.writeByte(1);
      else if (length === 's') this.writeByte(2);
      else if (length === 't') this.writeByte(3);
    }

    writeBend(bendObj: Bend) {
      console.log('WRITE BEND');
      const points = bendObj.length;
      this.writeByte(1);
      this.writeInteger(0);
      this.writeInteger(points);
      for (let i = 0; i < points; i += 1) {
        this.writeInteger(bendObj[i].bendPosition);
        this.writeInteger(bendObj[i].bendValue);
        this.writeByte(0);
      }
    }

    writeGrace(grace: Grace) {
      this.writeUnsignedByte(grace.fret);
      this.writeUnsignedByte(0); // TODO grace.dynamic);
      this.writeUnsignedByte(0); // TODO grace.transition);
      let duration = 0;
      if (grace.duration === 'o') {
        duration = 1;
      } else if (grace.duration === 'z') {
        duration = 2;
      } else {
        // TODO no idea if that is correct; check it
        duration = 3;
      }
      this.writeUnsignedByte(duration);
      this.writeUnsignedByte((grace.dead ? 0x01 : 0) | (grace.setOnBeat ? 0x02 : 0));
    }

    writeBeatEffects(effect: MeasureEffects) {
      let flags1 = 0;
      let flags2 = 0;
      if (effect.fadeIn) {
        flags1 |= 0x10;
      }
      if (effect.tap || effect.slap || effect.pop) {
        flags1 |= 0x20;
      }
      if (effect.tremoloBar) {
        flags2 |= 0x04;
      }
      if (effect.strokePresent) {
        flags1 |= 0x40;
      }
      this.writeUnsignedByte(flags1);
      this.writeUnsignedByte(flags2);

      if ((flags1 & 0x20) !== 0) {
        if (effect.tap) {
          this.writeUnsignedByte(1);
        } else if (effect.slap) {
          this.writeUnsignedByte(2);
        } else if (effect.pop) {
          this.writeUnsignedByte(3);
        }
      }
      if ((flags2 & 0x04) !== 0) {
        this.writeTremoloBar(effect.tremoloBar);
      }

      if ((flags1 & 0x40) !== 0) {
        this.writeUnsignedByte(effect.stroke.strokeType === 'up' ? effect.stroke.strokeLength : 0);
        this.writeUnsignedByte(effect.stroke.strokeType === 'down' ? effect.stroke.strokeLength : 0);
      }
    }

    writeTremoloBar(tremoloBar: TremoloBar) {
      const numPoints = tremoloBar.length;
      this.writeByte(1);
      this.writeInteger(0);
      this.writeInteger(numPoints);
      for (let i = 0; i < numPoints; i += 1) {
        this.writeInteger(tremoloBar[i].position);
        this.writeInteger(tremoloBar[i].value);
        this.writeByte(0);
      }
    }
}

const gp5Writer = new GP5Writer();
export { gp5Writer, GP5Writer };
