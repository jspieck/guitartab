import { fillAvailableSpaceWithRests } from './editor/barFilling'
import LZString from 'lz-string'
import Song from '../stores/song'
import { FIRST_DRUM_NOTE, noteToDrum } from './audio/drumKit'
import { audioGraph } from './audio/audioGraph'
import { parseMidiFile } from './import/midiFile'
import Duration from '../utils/duration'
import { setLoadingWheelVisible } from '../utils/editorUi'
import { serializeSongContent } from '../utils/gtSerialization'
import { notifySongDataChanged } from './appEvents'
import { undoHistory } from './editor/editCommands'
import { loadSongIntoEditor, resetEditorState } from './editor/trackLoading'
import { extractGpifXml } from './gpContainers'
import { applyGpifSong, parseGpif, type GpifSong } from './gpifImport'
import { ByteReader } from './import/guitarPro/byteReader'
import { applyGuitarProSong, parseGuitarPro } from './import/guitarPro'
import { ImportError, importFormatOf, type ImportFormat } from './importErrors'
import { applyImportedSong, buildSongFromMidi } from './midiImport'
import { markSongSaved } from './songAutosave'
import { migrateMeasureMeta, migrateSongMeasures } from './songMigrations'
import { showUserError } from './userNotifications'

/**
 * Opening songs: every format (Guitar Pro 3–8, MIDI, .gt) goes through
 * `importSongBytes`, which puts the previous song back when a file can't be read.
 */

/** Opens the first file of a FileList (file input or drag and drop) and reports problems to the user. */
export function openSongFile(files: FileList | null): void {
  const file = files?.[0]
  if (file == null) {
    showUserError('No file selected.')
    return
  }
  if (importFormatOf(file.name) == null) {
    showUserError('Unsupported file type. Open a Guitar Pro (.gp, .gpx, .gp5, .gp4, .gp3), .mid or .gt file.')
    return
  }
  setLoadingWheelVisible(true)
  const reader = new FileReader()
  reader.onload = () => {
    try {
      importSongBytes(file.name, new Uint8Array(reader.result as ArrayBuffer))
    } catch (error) {
      console.error('Import failed', error)
      showUserError(
        error instanceof ImportError
          ? `Could not open ${file.name}: ${error.message}`
          : `Could not open ${file.name}.`,
      )
    } finally {
      setLoadingWheelVisible(false)
    }
  }
  reader.onerror = () => {
    setLoadingWheelVisible(false)
    showUserError(`Could not read ${file.name}.`)
  }
  reader.readAsArrayBuffer(file)
}

/** Opens a .gt file's bytes (autosave restore, cloud songs). */
export function loadGtBytes(bytes: Uint8Array): void {
  importSongBytes('song.gt', bytes)
}

/**
 * Replaces the current song with the one in `bytes`. Throws an ImportError
 * (and puts the previous song back) when the file can't be read, so a bad
 * file never leaves a half-loaded song behind.
 */
export function importSongBytes(fileName: string, bytes: Uint8Array): void {
  const format = importFormatOf(fileName)
  if (format == null) {
    const ending = fileName.substring(fileName.lastIndexOf('.') + 1)
    throw new ImportError(`.${ending} files are not supported.`, ending)
  }
  if (bytes.length === 0) throw new ImportError('The file is empty.', format)
  const backup = {
    content: serializeSongContent(),
    chordsMap: Song.chordsMap,
    allChannels: Song.allChannels.map((channel) => ({ ...channel })),
    bpm: Song.bpm,
  }
  const reader = new ByteReader(bytes, format)
  try {
    parseSong(format, bytes, fileName, reader)
  } catch (error) {
    restoreAfterFailedImport(backup)
    if (error instanceof ImportError) throw error
    const detail = error instanceof Error ? error.message : String(error)
    throw new ImportError(`This doesn't look like a valid .${format} file (${detail}).`, format, {
      offset: reader.position,
      cause: error,
    })
  }
}

function parseSong(format: ImportFormat, bytes: Uint8Array, fileName: string, reader: ByteReader): void {
  if (format === 'gt') {
    applyGtContent(decompressGt(bytes), { fromFile: true })
    return
  }
  if (format === 'gp3' || format === 'gp4' || format === 'gp5') {
    applyGuitarProSong(parseGuitarPro(format, bytes, reader))
  } else if (format === 'mid') {
    applyImportedSong(buildSongFromMidi(parseMidiFile(bytes), fileName))
  } else {
    // .gpx and .gp hold the same GPIF XML; only the container differs.
    applyGpifSong(parseGpif(extractGpifXml(bytes, format), format))
  }
  if (!Array.isArray(Song.measures[0]) || Song.measures[0].length === 0) {
    throw new ImportError('The file contains no bars.', format)
  }
  finishLoading()
}

function decompressGt(bytes: Uint8Array): string {
  let text: string | null
  try {
    text = LZString.decompressFromUint8Array(bytes)
  } catch {
    text = null
  }
  if (text == null || text.split('%%%').length < 6)
    throw new ImportError('This is not a valid .gt file.', 'gt')
  return text
}

/** Loads .gt document text. `fromFile: false` (restoring) keeps the undo history and the dirty state. */
export function applyGtContent(text: string, { fromFile }: { fromFile: boolean }): void {
  const parts = text.split('%%%')
  Song.songDescription = JSON.parse(parts[0])
  const measures = JSON.parse(parts[1])
  migrateSongMeasures(measures)
  Song.measures = measures
  const measureMeta = JSON.parse(parts[2])
  migrateMeasureMeta(measureMeta)
  Song.measureMeta = measureMeta
  Song.numMeasures = Song.measureMeta.length
  Song.tracks = JSON.parse(parts[3])
  completeLoadedSong()
  loadSongIntoEditor(0)
  Song.playBackInstrument = JSON.parse(parts[4])
  applyDrumMap(JSON.parse(parts[5]))
  if (fromFile) {
    undoHistory.clear()
    markSongSaved()
  }
}

/** Shows a song built in code (the demo song), set up exactly like an opened file. */
export function loadBuiltSong(song: GpifSong): void {
  applyGpifSong(song)
  finishLoading()
}

/** Steps every newly loaded song needs: rests in empty voices, ties, tracks, audio, a clean undo history. */
function finishLoading(): void {
  resetEditorState()
  completeLoadedSong()
  loadSongIntoEditor(0)
  undoHistory.clear()
  markSongSaved()
  notifySongDataChanged()
}

function restoreAfterFailedImport(backup: {
  content: string
  chordsMap: typeof Song.chordsMap
  allChannels: typeof Song.allChannels
  bpm: number
}): void {
  try {
    applyGtContent(backup.content, { fromFile: false })
    Song.chordsMap = backup.chordsMap
    Song.allChannels = backup.allChannels
    Song.setTempo(backup.bpm)
  } catch (restoreError) {
    console.error('Could not restore the song after a failed import', restoreError)
  }
}

/**
 * Restores the drum mixer state saved with a .gt file. Files written before
 * the fix stored the Map as `{}` (JSON.stringify drops Map entries); those keep
 * the defaults instead of replacing the Map with a plain object.
 */
export function applyDrumMap(saved: unknown): void {
  if (!Array.isArray(saved)) return
  for (const entry of saved) {
    if (!Array.isArray(entry) || entry.length !== 2) continue
    const [note, info] = entry
    const current = noteToDrum.get(Number(note))
    if (current != null && Array.isArray(info) && info.length === current.length) {
      noteToDrum.set(Number(note), info as typeof current)
      const bus = audioGraph.drumBusses[Number(note) - FIRST_DRUM_NOTE]
      if (bus != null) {
        bus.volume.gain.value = Number(info[2])
        bus.pan.pan.value = Number(info[3])
      }
    }
  }
}

/**
 * Fills voices marked empty with rests, and connects ties: a tied note gets
 * the fret of the note it continues (and `tiedTo`), that note `tieBegin`; a
 * tie with nothing before it is dropped.
 */
export function completeLoadedSong(): void {
  fillEmptyVoices()
  Song.measures.forEach((bars, trackId) =>
    bars.forEach((voices, blockId) =>
      voices.forEach((beats, voiceId) =>
        beats.forEach((beat, beatId) => {
          beat?.notes?.forEach((note, string) => {
            if (note?.tied) connectTie(trackId, blockId, voiceId, beatId, string)
          })
        }),
      ),
    ),
  )
}

function fillEmptyVoices(): void {
  let numerator = 4
  let denominator = 4
  Song.measures.forEach((bars, trackId) =>
    bars.forEach((voices, blockId) => {
      const meta = Song.measureMeta[blockId]
      if (meta?.numerator != null) numerator = meta.numerator
      if (meta?.denominator != null) denominator = meta.denominator
      voices.forEach((beats, voiceId) => {
        if (beats.length > 0 && beats[0]?.empty) {
          Song.measures[trackId][blockId][voiceId] = []
          fillAvailableSpaceWithRests(
            trackId,
            blockId,
            voiceId,
            0,
            (Duration.getDurationOfType('wr') * numerator) / denominator,
          )
        }
      })
    }),
  )
}

/** Walks back from a tied note to the note it continues. */
function connectTie(trackId: number, blockId: number, voiceId: number, beatId: number, string: number): void {
  const bars = Song.measures[trackId]
  let fromBlock = blockId
  let fromBeat = beatId - 1
  let fret: number | null = null
  search: for (; fromBlock >= 0; fromBlock -= 1) {
    if (fromBlock !== blockId) fromBeat = bars[fromBlock][voiceId].length - 1
    for (; fromBeat >= 0; fromBeat -= 1) {
      const previous = bars[fromBlock][voiceId][fromBeat]?.notes?.[string]
      if (previous == null) continue
      if (!previous.tied) previous.tieBegin = true
      // Earlier ties in the chain were already connected, so this fret is the original one.
      fret = previous.fret
      break search
    }
  }
  if (fret == null) {
    // A tie that continues nothing.
    bars[blockId][voiceId][beatId].notes[string]!.tied = false
    return
  }
  for (let bar = fromBlock; bar <= blockId; bar += 1) {
    const first = bar === fromBlock ? fromBeat + 1 : 0
    const last = bar === blockId ? beatId : bars[bar][voiceId].length - 1
    for (let beat = first; beat <= last; beat += 1) {
      const target = bars[bar][voiceId][beat]
      if (target == null) continue
      const note = (target.notes[string] ??= Song.defaultNote())
      note.tied = true
      note.fret = fret
      note.tiedTo = { blockId: fromBlock, beatId: fromBeat }
    }
  }
}
