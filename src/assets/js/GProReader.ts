import LZString from 'lz-string';
import Duration from './duration';
import Song from './songData';
import menuHandler from './menuHandler';
import { gpxReader } from './GPXReader';
import { audioEngine } from './audioEngine';
import { sequencer } from './sequencer';
import AppManager from './appManager';
import { Tab } from './tab';
import { Gp5Reader } from './GP5Reader';
import { Gp4Reader } from './GP4Reader';
import { Gp3Reader } from './GP3Reader';
import midiReader from './MidiReader';

class GProReader {
  readerBuffer: Uint8Array | null;

  bytePosition: number;

  version: string;

  versionIndex: number;

  versions: string[];

  numToStrokeLength: number[];

  constructor() {
    this.readerBuffer = null;
    this.bytePosition = 0;
    this.version = '';
    this.versionIndex = -1;
    this.versions = ['FICHIER GUITAR PRO v5.00', 'FICHIER GUITAR PRO v5.10'];
    this.numToStrokeLength = [0, 128, 64, 32, 16, 8, 4];
  }

  readGt() {
    if (this.readerBuffer == null) {
      return;
    }
    const str = LZString.decompressFromUint8Array(this.readerBuffer);
    // console.log(str);
    if (str != null) {
      const arr = str.split('%%%');
      Song.songDescription = JSON.parse(arr[0]);
      Song.measures = JSON.parse(arr[1]);
      Song.measureMeta = JSON.parse(arr[2]);
      Song.numMeasures = Song.measureMeta.length;
      Song.tracks = JSON.parse(arr[3]);
      GProReader.writeNoteInfoToBeat();
      AppManager.createGuitarTab(0);
      Song.playBackInstrument = JSON.parse(arr[4]);
      sequencer.drawBeat();
      audioEngine.noteToDrum = JSON.parse(arr[5]);
      menuHandler.applyStyleMode();
    }
  }

  handleFileSelect(evt: Event) {
    if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
      alert('The File APIs are not fully supported in this browser.');
      return;
    }
    if (evt.target == null) {
      console.error('Evt Target is null');
      return;
    }
    const { files } = (<HTMLInputElement>evt.target); // FileList object
    if (files == null) {
      console.error('Files is null');
      return;
    }
    const f = files[0];
    // console.log(f);
    // Only process gp5-files
    const ending = f.name.substring(f.name.lastIndexOf('.') + 1);
    if (
      ending !== 'gp5'
      && ending !== 'gp4'
      && ending !== 'gp3'
      && ending !== 'mid'
    ) {
      console.log(f.name.substring(f.name.lastIndexOf('.') + 1));
      alert('Nur gt/gp3/gp4/gp5-Format unterstützt');
      return;
    }
    // reset values
    this.bytePosition = 0;
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target != null) {
        const bufferToConvert = e.target.result as ArrayBuffer;
        if (bufferToConvert != null) {
          this.readerBuffer = new Uint8Array(bufferToConvert);
          if (ending === 'gp5') {
            Gp5Reader.read();
          } else if (ending === 'gp4') {
            Gp4Reader.read();
          } else if (ending === 'gp3') {
            Gp3Reader.read();
          } else if (ending === 'mid') {
            midiReader.decodeSMF(bufferToConvert);
          } else if (ending === 'gt') {
            this.readGt();
          }
        } else {
          console.error('Buffer empty');
        }
      }
    };
    reader.readAsArrayBuffer(f);
  }

  static toArrayBuffer(buf: number[]) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; i += 1) {
      view[i] = buf[i];
    }
    return ab;
  }

  processFile(filePath: string, data: Uint8Array) {
    this.bytePosition = 0;
    this.readerBuffer = data;
    const ending = filePath.substring(filePath.lastIndexOf('.') + 1);
    // console.log(ending);
    if (
      ending !== 'gp5'
      && ending !== 'gp4'
      && ending !== 'gp3'
      && ending !== 'mid'
      && ending !== 'gpx'
      && ending !== 'gt'
    ) {
      alert('Nur gt/gp3/gp4/gp5/gpx-Format und midi-Format unterstützt');
      return;
    }
    if (ending === 'gp5') {
      Gp5Reader.read();
    } else if (ending === 'gp4') {
      Gp4Reader.read();
    } else if (ending === 'gp3') {
      Gp3Reader.read();
    } else if (ending === 'mid') {
      midiReader.decodeSMF(data.buffer);
    } else if (ending === 'gpx') {
      gpxReader.read(this.readerBuffer);
    }

    if (ending === 'gt') {
      this.readGt();
    } else {
      // write info to file
      AppManager.resetVariables();
      GProReader.writeNoteInfoToBeat();
      AppManager.createGuitarTab(0);
      menuHandler.applyStyleMode();
    }
  }

  readInt() {
    const bytes = [];
    for (let i = 0; i < 4; i += 1) {
      bytes[i] = this.readByte();
    }
    return (
      ((bytes[3] & 0xff) << 24)
      | ((bytes[2] & 0xff) << 16)
      | ((bytes[1] & 0xff) << 8)
      | (bytes[0] & 0xff)
    );
  }

  readByte() {
    if (this.readerBuffer == null) {
      console.error('GProReader Buffer is null!');
      return 0;
    }
    const byte = this.readerBuffer[this.bytePosition];
    this.bytePosition += 1;
    if (byte > 127) {
      return byte - 256;
    }
    return byte;
  }

  readUnsignedByte() {
    // e.g. convert -1 to 255
    if (this.readerBuffer == null) {
      console.error('Reader Buffer is null');
      return 0;
    }
    const res = this.readerBuffer[this.bytePosition] & 255;
    this.bytePosition += 1;
    return res;
  }

  static Utf8ArrayToStr(array: number[]) {
    let c;
    let char2;
    let char3;
    let out = '';
    const len = array.length;
    let i = 0;
    while (i < len) {
      c = array[i];
      i += 1;
      switch (c >> 4) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
          // 0xxxxxxx
          out += String.fromCharCode(c);
          break;
        case 12:
        case 13:
          // 110x xxxx   10xx xxxx
          char2 = array[i];
          i += 1;
          out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f));
          break;
        case 14:
          // 1110 xxxx  10xx xxxx  10xx xxxx
          char2 = array[i];
          char3 = array[i + 1];
          i += 2;
          out += String.fromCharCode(
            ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0),
          );
          break;
        default:
      }
    }
    return out;
  }

  readBytesToString(length: number) {
    const bytes = [];
    for (let i = 0; i < length; i += 1) {
      bytes[i] = this.readByte();
    }
    return GProReader.Utf8ArrayToStr(bytes);
  }

  readStringByteSizeOfInteger() {
    const length = this.readInt();
    this.readByte();
    return this.readBytesToString(length - 1);
  }

  readStringInteger() {
    const length = this.readInt();
    return this.readBytesToString(length);
  }

  readStringByte(length: number) {
    const realLength = this.readUnsignedByte();
    const str = this.readBytesToString(realLength);
    if (length > realLength) this.skipBytes(length - realLength);
    return str;
  }

  skipBytes(numBytesToSkip: number) {
    this.bytePosition += numBytesToSkip;
  }

  static writeNoteInfoToBeat() {
    // First Expand empty beats
    let currentNumerator = 4;
    let currentDenominator = 4;
    for (let i = 0, n = Song.measures.length; i < n; i += 1) {
      for (let j = 0, o = Song.measures[i].length; j < o; j += 1) {
        if (Song.measureMeta[j].numerator != null) {
          currentNumerator = Song.measureMeta[j].numerator;
        }
        if (Song.measureMeta[j].denominator != null) {
          currentDenominator = Song.measureMeta[j].denominator;
        }
        for (let k = 0, p = Song.measures[i][j].length; k < p; k += 1) {
          if (Song.measures[i][j][k][0].empty) {
            const durationLength = (Duration.getDurationOfType('wr') * currentNumerator) / currentDenominator;
            Song.measures[i][j][k] = [];
            Tab.fillAvailableSpaceWithRests(i, j, k, 0, durationLength);
          }
        }
      }
    }
    // Write dynamic to note, handle ties
    for (let i = 0, n = Song.measures.length; i < n; i += 1) {
      for (let j = 0, o = Song.measures[i].length; j < o; j += 1) {
        for (let k = 0, p = Song.measures[i][j].length; k < p; k += 1) {
          for (let l = 0, q = Song.measures[i][j][k].length; l < q; l += 1) {
            // write dynamic from notes to beat
            // const dynamic = '';
            for (let s = 0, r = Song.measures[i][j][k][l].notes.length; s < r; s += 1) {
              const beat = Song.measures[i][j][k][l];
              /* TODO is this code needed?
              if (beat.notes[s] != null && beat.notes[s].dynamic != null) {
                beat.dynamicPresent = true;
                beat.dynamic = beat.notes[s].dynamic;
              } */
              // look for note to tie to
              if (beat.notes[s] != null && beat.notes[s]!.tied) {
                let foundFret = null;
                let blockId = 0;
                let beatId = 0;
                for (blockId = j; blockId >= 0; blockId -= 1) {
                  const startBeatId = (blockId === j)
                    ? l - 1
                    : Song.measures[i][blockId][k].length - 1;
                  for (beatId = startBeatId; beatId >= 0; beatId -= 1) {
                    const { notes } = Song.measures[i][blockId][k][beatId];
                    if (notes[s] != null) {
                      if (!notes[s]!.tied) {
                        notes[s]!.tieBegin = true;
                      }
                      // works recursive, should be set by previous loop
                      foundFret = notes[s]!.fret;
                      break;
                    }
                  }
                  if (foundFret != null) {
                    break;
                  }
                }
                if (foundFret != null) {
                  for (let bId = blockId; bId <= j; bId += 1) {
                    // console.log(bId, blockId, beatId, foundFret, i, j);
                    const startBeatId = bId === blockId ? beatId + 1 : 0;
                    const endBeatId = bId === j ? l : Song.measures[i][bId][k].length - 1;
                    for (let beId = startBeatId; beId <= endBeatId; beId += 1) {
                      const { notes } = Song.measures[i][bId][k][beId];
                      if (notes[s] == null) {
                        notes[s] = Song.defaultNote();
                      }
                      notes[s]!.tied = true;
                      notes[s]!.fret = foundFret;
                      notes[s]!.tiedTo = { blockId, beatId };
                    }
                  }
                } else {
                  // Remove tie, because it is not connected to any note
                  beat.notes[s]!.tied = false;
                }
              }
            }
            // write tie begin and insert ties if necessary
          }
        }
      }
    }
  }
}

const gProReader = new GProReader();
export { gProReader, GProReader };
export default GProReader;
