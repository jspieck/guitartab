import LZString from 'lz-string'
import Song from '../stores/song'
import { noteToDrum } from '../services/audio/drumKit'

/** The .gt document as text (before compression); equal text means equal song content. */
export function serializeSongContent(): string {
  const limiter = '%%%'
  let content = ''
  content += JSON.stringify(Song.songDescription)
  content += limiter
  content += JSON.stringify(Song.measures)
  content += limiter
  content += JSON.stringify(Song.measureMeta)
  content += limiter
  content += JSON.stringify(Song.tracks)
  content += limiter
  content += JSON.stringify(Song.playBackInstrument)
  content += limiter
  // Entries, not the Map itself: JSON.stringify(new Map()) is "{}".
  content += JSON.stringify(Array.from(noteToDrum.entries()))

  return content
}

export function compressGtContent(content: string): Uint8Array {
  return new Uint8Array(LZString.compressToUint8Array(content))
}

export function serializeSongToGtBytes(): Uint8Array {
  return compressGtContent(serializeSongContent())
}
