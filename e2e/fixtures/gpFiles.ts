import { readFileSync } from 'node:fs'
import { zipSync } from 'fflate'

/** Builds Guitar Pro 6/7 containers around a GPIF score, for import tests. */

const SECTOR = 0x1000
const encoder = new TextEncoder()

function writeInt32(target: Uint8Array, offset: number, value: number) {
  new DataView(target.buffer, target.byteOffset).setInt32(offset, value, true)
}

/**
 * A BCFS image (uncompressed .gpx) as Guitar Pro 6 writes it: header, then 4 KB sectors.
 * Sector 0 is unused; each file gets an entry sector followed by its data in the sectors
 * listed in the entry. Data sectors are stored in reverse order to prove readers follow the index.
 */
export function buildBcfs(files: Record<string, Uint8Array>): Uint8Array {
  const sectors: Uint8Array[] = [new Uint8Array(SECTOR)]
  for (const [name, content] of Object.entries(files)) {
    const entry = new Uint8Array(SECTOR)
    writeInt32(entry, 0, 2)
    entry.set(encoder.encode(name), 4)
    writeInt32(entry, 0x8c, content.length)
    sectors.push(entry)
    const chunks: Uint8Array[] = []
    for (let start = 0; start < content.length; start += SECTOR) {
      const chunk = new Uint8Array(SECTOR)
      chunk.set(content.subarray(start, start + SECTOR))
      chunks.push(chunk)
    }
    const firstData = sectors.length
    chunks.reverse().forEach((chunk) => sectors.push(chunk))
    chunks.forEach((_, i) => writeInt32(entry, 0x94 + i * 4, firstData + chunks.length - 1 - i))
  }
  const out = new Uint8Array(4 + sectors.length * SECTOR)
  out.set(encoder.encode('BCFS'))
  sectors.forEach((sector, i) => out.set(sector, 4 + i * SECTOR))
  return out
}

/** A GP7/8 .gp archive (ZIP) holding `Content/score.gpif`. */
export function buildGpArchive(gpif: string): Uint8Array {
  return zipSync({
    VERSION: encoder.encode('7.0'),
    'Content/score.gpif': encoder.encode(gpif),
  })
}

export function readShowcaseGpif(): string {
  return readFileSync('e2e/fixtures/files/showcase.gpif', 'utf-8')
}
