import { unzipSync } from 'fflate'
import { ImportError } from './importErrors'

/**
 * Guitar Pro 6+ files wrap one XML document, `score.gpif`, in a container:
 * - GP7/8 `.gp` is a ZIP with the score at `Content/score.gpif`.
 * - GP6 `.gpx` is "BCFS", a tiny sector file system, usually compressed as "BCFZ".
 * These functions only unpack; `gpifImport.ts` reads the XML.
 */

const HEADER_BCFS = 0x53464342 // 'BCFS', little-endian
const HEADER_BCFZ = 0x5a464342 // 'BCFZ'
const SECTOR_SIZE = 0x1000
// Real scores are a few MB at most; this stops a malicious size field from eating memory.
const MAX_SCORE_BYTES = 64 << 20

export type GpContainer = 'zip' | 'bcfs' | 'bcfz'

function readInt32(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) return 0
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

/** Which container `bytes` are, judged by the first bytes rather than the file name. */
export function detectGpContainer(bytes: Uint8Array): GpContainer | null {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip'
  const header = readInt32(bytes, 0)
  if (header === HEADER_BCFS) return 'bcfs'
  if (header === HEADER_BCFZ) return 'bcfz'
  return null
}

/** Reads bits most-significant first, as the BCFZ compressor writes them. */
class BitReader {
  private position = 0

  constructor(private readonly bytes: Uint8Array) {}

  get atEnd(): boolean {
    return this.position >= this.bytes.length * 8
  }

  bit(): number {
    const byte = this.bytes[this.position >> 3]
    const bit = (byte >> (7 - (this.position & 7))) & 1
    this.position += 1
    return bit
  }

  bits(count: number): number {
    let value = 0
    for (let i = count - 1; i >= 0; i -= 1) value |= this.bit() << i
    return value
  }

  bitsReversed(count: number): number {
    let value = 0
    for (let i = 0; i < count; i += 1) value |= this.bit() << i
    return value
  }
}

/** BCFZ: a 4-byte decompressed length, then LZ77-style chunks (literal runs or back references). */
export function decompressBcfz(bytes: Uint8Array): Uint8Array {
  const expected = readInt32(bytes, 4)
  if (expected === 0 || expected > MAX_SCORE_BYTES) {
    throw new ImportError('The .gpx file is damaged (bad compressed size).', 'gpx')
  }
  const out = new Uint8Array(expected)
  let length = 0
  const reader = new BitReader(bytes.subarray(8))
  while (!reader.atEnd && length < expected) {
    if (reader.bit() === 1) {
      const wordSize = reader.bits(4)
      const offset = reader.bitsReversed(wordSize)
      const size = reader.bitsReversed(wordSize)
      const from = length - offset
      if (offset === 0 || from < 0) {
        throw new ImportError('The .gpx file is damaged (bad back reference).', 'gpx')
      }
      for (let i = 0; i < Math.min(offset, size) && length < expected; i += 1) {
        out[length] = out[from + i]
        length += 1
      }
    } else {
      const size = reader.bitsReversed(2)
      for (let i = 0; i < size && length < expected; i += 1) {
        out[length] = reader.bits(8)
        length += 1
      }
    }
  }
  return out.subarray(0, length)
}

/**
 * BCFS: after the 4-byte header, sectors of 4 KB. A sector starting with 2 is a file
 * entry: name at +4 (127 bytes), size at +0x8C, then the indexes of its data sectors
 * at +0x94, ended by 0.
 */
export function readBcfsFiles(bytes: Uint8Array): Map<string, Uint8Array> {
  const data = bytes.subarray(4)
  const files = new Map<string, Uint8Array>()
  for (let offset = SECTOR_SIZE; offset + SECTOR_SIZE <= data.length; offset += SECTOR_SIZE) {
    if (readInt32(data, offset) !== 2) continue
    const nameBytes = data.subarray(offset + 4, offset + 4 + 127)
    const nameEnd = nameBytes.indexOf(0)
    const name = new TextDecoder().decode(nameEnd === -1 ? nameBytes : nameBytes.subarray(0, nameEnd))
    const size = readInt32(data, offset + 0x8c)
    if (size > MAX_SCORE_BYTES) continue
    const content = new Uint8Array(size)
    let written = 0
    for (let index = offset + 0x94; index + 4 <= offset + SECTOR_SIZE && written < size; index += 4) {
      const sector = readInt32(data, index)
      if (sector === 0) break
      const start = sector * SECTOR_SIZE
      const chunk = data.subarray(start, Math.min(start + SECTOR_SIZE, data.length, start + size - written))
      content.set(chunk, written)
      written += chunk.length
    }
    if (written === size) files.set(name, content)
  }
  return files
}

function decodeScore(bytes: Uint8Array | undefined, format: string): string {
  if (bytes == null) {
    throw new ImportError('The file has no score data (score.gpif is missing).', format)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

/** The GPIF XML inside a Guitar Pro 6, 7 or 8 file (any of the three containers). */
export function extractGpifXml(bytes: Uint8Array, format: string): string {
  const container = detectGpContainer(bytes)
  if (container === 'zip') {
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(bytes, { filter: (file) => file.name.toLowerCase().endsWith('score.gpif') })
    } catch (error) {
      throw new ImportError('The file is not a readable Guitar Pro archive.', format, { cause: error })
    }
    const name = Object.keys(entries).find((entry) => entry === 'Content/score.gpif') ?? Object.keys(entries)[0]
    return decodeScore(name != null ? entries[name] : undefined, format)
  }
  if (container === 'bcfz') return decodeScore(readBcfsFiles(decompressBcfz(bytes)).get('score.gpif'), format)
  if (container === 'bcfs') return decodeScore(readBcfsFiles(bytes).get('score.gpif'), format)
  throw new ImportError('This is not a Guitar Pro 6/7/8 file.', format)
}
