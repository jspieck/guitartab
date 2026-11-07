import LZString from 'lz-string'
import { toRaw } from 'vue'
import { songState } from '../stores/songState'
import { noteToDrum } from '../services/audio/drumKit'

/** The .gt document as text (before compression); equal text means equal song content. */
export function serializeSongContent(): string {
  // Read the raw data: through the reactive proxy every property read is a tracked `get`,
  // which made this 70 % of opening a 140-bar song (and of every autosave check).
  const song = toRaw(songState)
  const limiter = '%%%'
  let content = ''
  content += JSON.stringify(song.songDescription)
  content += limiter
  content += JSON.stringify(song.measures)
  content += limiter
  content += JSON.stringify(song.measureMeta)
  content += limiter
  content += JSON.stringify(song.tracks)
  content += limiter
  content += JSON.stringify(song.playBackInstrument)
  content += limiter
  // Entries, not the Map itself: JSON.stringify(new Map()) is "{}".
  content += JSON.stringify(Array.from(noteToDrum.entries()))

  return content
}

const PART_LIMITER = '%%%'
/** The song's own parts; a seventh, the practice memory (speed, loop), may follow. */
const SONG_PARTS = 6

export function compressGtContent(content: string): Uint8Array {
  return new Uint8Array(LZString.compressToUint8Array(content))
}

export function decompressGtContent(bytes: Uint8Array): string | null {
  try {
    return LZString.decompressFromUint8Array(bytes)
  } catch {
    return null
  }
}

/** A .gt document: the song content and, when given, the practice part after it. */
export function withPracticePart(content: string, practice?: unknown): string {
  return practice == null ? content : `${content}${PART_LIMITER}${JSON.stringify(practice)}`
}

/** Whether a .gt document holds exactly `content` as its song (whatever practice part follows). */
export function hasSongContent(document: string, content: string): boolean {
  return document === content || document.startsWith(`${content}${PART_LIMITER}`)
}

/** The practice part of a .gt document, or undefined (older files, damaged JSON). */
export function practicePartOf(text: string): unknown {
  const part = text.split(PART_LIMITER)[SONG_PARTS]
  if (part == null) return undefined
  try {
    return JSON.parse(part)
  } catch {
    return undefined
  }
}

export function serializeSongToGtBytes(practice?: unknown): Uint8Array {
  return compressGtContent(withPracticePart(serializeSongContent(), practice))
}
