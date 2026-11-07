import { ByteReader } from './byteReader'
import { GuitarProParser } from './parser'
import {
  emptyGuitarProSong,
  liftNoteDynamics,
  placeGuitarProLyrics,
  type GuitarProSong,
} from './guitarProSong'

export { applyGuitarProSong, type GuitarProSong } from './guitarProSong'

export type GuitarProFormat = 'gp3' | 'gp4' | 'gp5'

const VERSIONS = { gp3: 3, gp4: 4, gp5: 5 } as const

/**
 * Reads a Guitar Pro 3, 4 or 5 file. Throws an ImportError for a damaged or
 * truncated file; `reader.position` then says how far it got.
 */
export function parseGuitarPro(
  format: GuitarProFormat,
  bytes: Uint8Array,
  reader = new ByteReader(bytes, format),
): GuitarProSong {
  const song = emptyGuitarProSong()
  new GuitarProParser(reader, song, VERSIONS[format]).read()
  liftNoteDynamics(song)
  placeGuitarProLyrics(song)
  return song
}
