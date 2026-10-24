import { ByteReader } from './byteReader'
import { Gp3Parser } from './gp3'
import { Gp4Parser } from './gp4'
import { Gp5Parser } from './gp5'
import { emptyGuitarProSong, liftNoteDynamics, type GuitarProSong } from './guitarProSong'

export { applyGuitarProSong, type GuitarProSong } from './guitarProSong'

export type GuitarProFormat = 'gp3' | 'gp4' | 'gp5'

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
  const Parser = { gp3: Gp3Parser, gp4: Gp4Parser, gp5: Gp5Parser }[format]
  new Parser(reader, song).read()
  liftNoteDynamics(song)
  return song
}
