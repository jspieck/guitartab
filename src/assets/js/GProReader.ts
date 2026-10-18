import LZString from 'lz-string';
import Duration from './duration';
import Song from './songData';
import { audioEngine } from './audioEngine';
import { sequencerHandler } from './sequencerHandler';
import AppManager from './appManager';
import { Tab } from './tab';
import { Gp5Reader } from './GP5Reader';
import { Gp4Reader } from './GP4Reader';
import { Gp3Reader } from './GP3Reader';
import midiReader from './MidiReader';
import { notifySongDataChanged } from '../../services/appEvents';
import { revertHandler } from './revertHandler';
import { markSongSaved } from '../../services/songAutosave';
import { setLoadingWheelVisible } from '../../utils/editorUi';
import { showUserError } from '../../services/userNotifications';
import { migrateMeasureMeta, migrateSongMeasures } from '../../services/songMigrations';
import {
  IMPORT_LIMITS, ImportError, importFormatOf, type ImportFormat,
} from '../../services/importErrors';
import { serializeSongContent } from '../../utils/gtSerialization';
import { applyImportedSong, buildSongFromMidi } from '../../services/midiImport';
import { extractGpifXml } from '../../services/gpContainers';
import { applyGpifSong, parseGpif, type GpifSong } from '../../services/gpifImport';

class GProReader {
  readerBuffer: Uint8Array | null;

  /** Format being read, for error messages. */
  currentFormat: string = 'gp5';

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
      throw new ImportError('No file data to read.', 'gt');
    }
    let str: string | null = null;
    try {
      str = LZString.decompressFromUint8Array(this.readerBuffer);
    } catch {
      str = null;
    }
    if (str == null || str.split('%%%').length < 6) {
      throw new ImportError('This is not a valid .gt file.', 'gt');
    }
    this.applyGtContent(str, { fromFile: true });
  }

  /** Loads .gt document text. `fromFile: false` (restoring) keeps undo history and the dirty state. */
  applyGtContent(str: string, { fromFile }: { fromFile: boolean }) {
    {
      const arr = str.split('%%%');
      Song.songDescription = JSON.parse(arr[0]);
      const measures = JSON.parse(arr[1]);
      migrateSongMeasures(measures);
      Song.measures = measures;
      const measureMeta = JSON.parse(arr[2]);
      migrateMeasureMeta(measureMeta);
      Song.measureMeta = measureMeta;
      Song.numMeasures = Song.measureMeta.length;
      Song.tracks = JSON.parse(arr[3]);
      GProReader.writeNoteInfoToBeat();
      AppManager.createGuitarTab(0);
      Song.playBackInstrument = JSON.parse(arr[4]);
      sequencerHandler.drawBeat();
      GProReader.applyDrumMap(JSON.parse(arr[5]));
      if (fromFile) {
        revertHandler.clearHistory();
        markSongSaved();
      }
      // menuHandler.applyStyleMode();
    }
  }

  loadGtFromBytes(bytes: Uint8Array) {
    this.importSongBytes('song.gt', bytes);
  }

  /**
   * Imports the first file of a FileList (drag-drop or file input).
   * Supports gp3, gp4, gp5, gpx, gp (Guitar Pro 7/8), mid and gt.
   */
  handleFiles(files: FileList) {
    if (files == null || files.length === 0) {
      showUserError('No file selected.');
      return;
    }
    const file = files[0];
    if (importFormatOf(file.name) == null) {
      showUserError(`Unsupported file type. Open a Guitar Pro (.gp, .gpx, .gp5, .gp4, .gp3), .mid or .gt file.`);
      return;
    }
    setLoadingWheelVisible(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.importSongBytes(file.name, new Uint8Array(reader.result as ArrayBuffer));
      } catch (error) {
        console.error('Import failed', error);
        showUserError(error instanceof ImportError
          ? `Could not open ${file.name}: ${error.message}`
          : `Could not open ${file.name}.`);
      } finally {
        setLoadingWheelVisible(false);
      }
    };
    reader.onerror = () => {
      setLoadingWheelVisible(false);
      showUserError(`Could not read ${file.name}.`);
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * Replaces the current song with the one in `bytes`. Throws an ImportError
   * (and puts the previous song back) when the file can't be read, so a bad
   * file never leaves a half-loaded song behind.
   */
  importSongBytes(fileName: string, bytes: Uint8Array) {
    const format = importFormatOf(fileName);
    if (format == null) {
      const ending = fileName.substring(fileName.lastIndexOf('.') + 1);
      throw new ImportError(`.${ending} files are not supported.`, ending);
    }
    if (bytes.length === 0) {
      throw new ImportError('The file is empty.', format);
    }
    const backup = {
      content: serializeSongContent(),
      chordsMap: Song.chordsMap,
      allChannels: Song.allChannels.map((channel) => ({ ...channel })),
      bpm: Song.bpm,
    };
    this.currentFormat = format;
    try {
      this.parseSong(format, bytes, fileName);
    } catch (error) {
      this.restoreAfterFailedImport(backup);
      if (error instanceof ImportError) {
        throw error;
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new ImportError(
        `This doesn't look like a valid .${format} file (${detail}).`,
        format,
        { offset: this.bytePosition, cause: error },
      );
    } finally {
      this.readerBuffer = null;
    }
  }

  private parseSong(format: ImportFormat, bytes: Uint8Array, fileName: string) {
    this.bytePosition = 0;
    this.readerBuffer = bytes;
    if (format === 'gt') {
      this.readGt();
      return;
    }
    if (format === 'gp5') {
      Gp5Reader.read();
    } else if (format === 'gp4') {
      Gp4Reader.read();
    } else if (format === 'gp3') {
      Gp3Reader.read();
    } else if (format === 'mid') {
      // DataView needs an ArrayBuffer that starts at the file's first byte.
      midiReader.decodeSMF(bytes.slice().buffer);
      applyImportedSong(buildSongFromMidi(midiReader.midiFile, fileName));
    } else if (format === 'gpx' || format === 'gp') {
      // Both hold the same GPIF XML; only the container differs.
      applyGpifSong(parseGpif(extractGpifXml(bytes, format), format));
    }
    if (!Array.isArray(Song.measures[0]) || Song.measures[0].length === 0) {
      throw new ImportError('The file contains no bars.', format);
    }
    GProReader.finishLoading();
  }

  /** Shows a song built in code (the demo song), set up exactly like an opened file. */
  loadBuiltSong(song: GpifSong) {
    applyGpifSong(song);
    GProReader.finishLoading();
  }

  /** Steps every newly loaded song needs: rests in empty voices, ties, tracks, audio, a clean undo history. */
  private static finishLoading() {
    AppManager.resetVariables();
    GProReader.writeNoteInfoToBeat();
    AppManager.createGuitarTab(0);
    revertHandler.clearHistory();
    markSongSaved();
    notifySongDataChanged();
  }

  private restoreAfterFailedImport(backup: {
    content: string, chordsMap: typeof Song.chordsMap, allChannels: typeof Song.allChannels, bpm: number,
  }) {
    try {
      this.applyGtContent(backup.content, { fromFile: false });
      Song.chordsMap = backup.chordsMap;
      Song.allChannels = backup.allChannels;
      Song.setTempo(backup.bpm);
    } catch (restoreError) {
      console.error('Could not restore the song after a failed import', restoreError);
    }
  }

  /** Electron "open file" path. */
  processFile(filePath: string, data: Uint8Array) {
    try {
      this.importSongBytes(filePath, data);
    } catch (error) {
      console.error('Import failed', error);
      showUserError(error instanceof ImportError ? `Could not open the file: ${error.message}` : 'Could not open the file.');
    }
  }

  static toArrayBuffer(buf: number[]) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; i += 1) {
      view[i] = buf[i];
    }
    return ab;
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

  /** Throws an ImportError unless `count` more bytes can be read. */
  private ensureAvailable(count: number) {
    if (this.readerBuffer == null) {
      throw new ImportError('No file data to read.', this.currentFormat);
    }
    if (!Number.isInteger(count) || count < 0 || this.bytePosition + count > this.readerBuffer.length) {
      throw new ImportError(
        `The file ends unexpectedly (byte ${this.bytePosition} of ${this.readerBuffer.length}); it may be truncated or damaged.`,
        this.currentFormat,
        { offset: this.bytePosition },
      );
    }
  }

  /** Reads a count (int32) and rejects values no real file has, before anything loops over it. */
  readCount(max: number, what: string): number {
    const offset = this.bytePosition;
    const count = this.readInt();
    if (count < 0 || count > max) {
      throw new ImportError(
        `Implausible number of ${what} (${count}); the file is damaged or not a .${this.currentFormat} file.`,
        this.currentFormat,
        { offset },
      );
    }
    return count;
  }

  readByte() {
    this.ensureAvailable(1);
    const byte = this.readerBuffer![this.bytePosition];
    this.bytePosition += 1;
    if (byte > 127) {
      return byte - 256;
    }
    return byte;
  }

  readUnsignedByte() {
    // e.g. convert -1 to 255
    this.ensureAvailable(1);
    const res = this.readerBuffer![this.bytePosition] & 255;
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
    if (length > IMPORT_LIMITS.stringBytes) {
      throw new ImportError(`Implausible text length (${length}).`, this.currentFormat, { offset: this.bytePosition });
    }
    this.ensureAvailable(Math.max(0, length));
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

  readStringByte(length: number, readAll: boolean = false) {
    let realLength = this.readUnsignedByte();
    if (readAll) realLength = length;
    const str = this.readBytesToString(realLength);
    if (length > realLength) this.skipBytes(length - realLength);
    return str;
  }

  bytesLeft(): number {
    return (this.readerBuffer?.length ?? 0) - this.bytePosition;
  }

  skipBytes(numBytesToSkip: number) {
    this.ensureAvailable(numBytesToSkip);
    this.bytePosition += numBytesToSkip;
  }

  /**
   * Restores the drum mixer state saved with a .gt file. Files written before
   * the fix stored the Map as `{}` (JSON.stringify drops Map entries); those keep
   * the defaults instead of replacing the Map with a plain object.
   */
  static applyDrumMap(saved: unknown) {
    if (!Array.isArray(saved)) {
      return;
    }
    for (const entry of saved) {
      if (!Array.isArray(entry) || entry.length !== 2) {
        continue;
      }
      const [note, info] = entry;
      const current = audioEngine.noteToDrum.get(Number(note));
      if (current != null && Array.isArray(info) && info.length === current.length) {
        audioEngine.noteToDrum.set(Number(note), info as typeof current);
        const bus = audioEngine.drumBusses[Number(note) - 35];
        if (bus != null) {
          bus.volume.gain.value = Number(info[2]);
          bus.pan.pan.value = Number(info[3]);
        }
      }
    }
  }

  static writeNoteInfoToBeat() {
    // First Expand empty beats
    let currentNumerator = 4;
    let currentDenominator = 4;
    for (let i = 0, n = Song.measures.length; i < n; i += 1) {
      for (let j = 0, o = Song.measures[i].length; j < o; j += 1) {
        if (Song.measureMeta[j]) {
          if (Song.measureMeta[j].numerator != null) {
            currentNumerator = Song.measureMeta[j].numerator;
          }
          if (Song.measureMeta[j].denominator != null) {
            currentDenominator = Song.measureMeta[j].denominator;
          }
        }
        for (let k = 0, p = Song.measures[i][j].length; k < p; k += 1) {
          if (Song.measures[i][j][k].length > 0 && Song.findBeat({ trackId: i, blockId: j, voiceId: k, beatId: 0 })?.empty) {
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
            const beat = Song.findBeat({ trackId: i, blockId: j, voiceId: k, beatId: l });
            if (!beat || !beat.notes) continue;
            
            for (let s = 0, r = beat.notes.length; s < r; s += 1) {
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
                    const prevBeat = Song.findBeat({ trackId: i, blockId, voiceId: k, beatId });
                    if (!prevBeat || !prevBeat.notes) continue;
                    const { notes } = prevBeat;
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
                      const currentBeat = Song.findBeat({ trackId: i, blockId: bId, voiceId: k, beatId: beId });
                      if (!currentBeat) continue;
                      const { notes } = currentBeat;
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
