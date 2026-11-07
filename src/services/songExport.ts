import { toRaw } from 'vue'
import type { ExportFormat } from '../utils/exportFormats'
import Song from '../stores/song'
import { currentSongAsGp5 } from './gp5Export'
import { serializeSongToGtBytes } from '../utils/gtSerialization'
import { currentPracticeMemory } from './practiceMemory'
import { buildMusicXml, musicXmlFileName } from './musicXmlExport'
import { buildGpif } from './gpifExport'
import { buildGpFile, buildGpxFile } from './gpxWriter'
import { markSongSaved } from './songAutosave'
import { showUserError } from './userNotifications'
import { trackProgram } from '../utils/trackProgram'
import { buildMidiFile, midiFileName } from './midiExport'

// Download formats offered in the toolbar (utils/exportFormats.ts). Loaded on demand, so none
// of this is in the startup bundle.
export type { ExportFormat }

function baseName(): string {
  const title = Song.songDescription.title.replace(/[\\/:*?"<>|]+/g, '').trim()
  return title && title !== '[Title]' ? title : 'song'
}

function download(data: BlobPart, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking right away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function songSource() {
  const channels = toRaw(Song.allChannels)
  return {
    description: toRaw(Song.songDescription),
    // The exporters read `track.program`; Guitar Pro 3–5 tracks keep theirs on the channel.
    tracks: toRaw(Song.tracks).map((track) => ({ ...track, program: trackProgram(track, channels) })),
    measureMeta: toRaw(Song.measureMeta),
    measures: toRaw(Song.measures),
  }
}

/** The current song as a Guitar Pro 6 .gpx file. */
export function songAsGpx(): Uint8Array {
  return buildGpxFile(buildGpif(songSource()))
}

/** The current song as a Guitar Pro 7/8 .gp file. */
export function songAsGp(): Uint8Array {
  return buildGpFile(buildGpif(songSource()))
}

/** The current song as a Standard MIDI File; `unrollRepeats` plays repeats and jumps out. */
export function songAsMidi(unrollRepeats: boolean): Uint8Array {
  const mixer = toRaw(Song.playBackInstrument)
  return buildMidiFile(
    { ...songSource(), title: Song.songDescription.title, mixer: Song.tracks.map((_, i) => mixer[i]) },
    { unrollRepeats },
  )
}

/** The current song as MusicXML text. */
export function songAsMusicXml(): string {
  return buildMusicXml(songSource())
}

export function exportSong(format: ExportFormat): void {
  try {
    if (format === 'gt') {
      download(
        serializeSongToGtBytes(currentPracticeMemory()),
        `${baseName()}.gt`,
        'application/octet-stream',
      )
      markSongSaved()
    } else if (format === 'gp5') {
      download(currentSongAsGp5(), `${baseName()}.gp5`, 'application/octet-stream')
    } else if (format === 'midi' || format === 'midi-bars') {
      download(songAsMidi(format === 'midi'), midiFileName(Song.songDescription.title), 'audio/midi')
    } else if (format === 'gp') {
      download(songAsGp(), `${baseName()}.gp`, 'application/octet-stream')
    } else if (format === 'gpx') {
      download(songAsGpx(), `${baseName()}.gpx`, 'application/octet-stream')
    } else {
      download(
        songAsMusicXml(),
        musicXmlFileName(Song.songDescription.title),
        'application/vnd.recordare.musicxml+xml',
      )
    }
  } catch (error) {
    console.error('Export failed', error)
    showUserError('Could not export the song.')
  }
}
