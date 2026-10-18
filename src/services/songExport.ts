import { toRaw } from 'vue'
import Song from '../assets/js/songData'
import { gp5Writer } from '../assets/js/GP5Writ'
import { serializeSongToGtBytes } from '../utils/gtSerialization'
import { buildMusicXml, musicXmlFileName } from './musicXmlExport'
import { buildGpif } from './gpifExport'
import { buildGpxFile } from './gpxWriter'
import { markSongSaved } from './songAutosave'
import { showUserError } from './userNotifications'

/** Download formats offered in the toolbar. Loaded on demand, so none of this is in the startup bundle. */
export type ExportFormat = 'gt' | 'gp5' | 'gpx' | 'musicxml'

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
  return {
    description: toRaw(Song.songDescription),
    tracks: toRaw(Song.tracks),
    measureMeta: toRaw(Song.measureMeta),
    measures: toRaw(Song.measures),
  }
}

/** The current song as a Guitar Pro 6 .gpx file. */
export function songAsGpx(): Uint8Array {
  return buildGpxFile(buildGpif(songSource()))
}

/** The current song as MusicXML text. */
export function songAsMusicXml(): string {
  return buildMusicXml(songSource())
}

export function exportSong(format: ExportFormat): void {
  try {
    if (format === 'gt') {
      download(serializeSongToGtBytes(), `${baseName()}.gt`, 'application/octet-stream')
      markSongSaved()
    } else if (format === 'gp5') {
      download(gp5Writer.buildSongBytes(), `${baseName()}.gp5`, 'application/octet-stream')
    } else if (format === 'gpx') {
      download(songAsGpx(), `${baseName()}.gpx`, 'application/octet-stream')
    } else {
      download(songAsMusicXml(), musicXmlFileName(Song.songDescription.title), 'application/vnd.recordare.musicxml+xml')
    }
  } catch (error) {
    console.error('Export failed', error)
    showUserError('Could not export the song.')
  }
}
