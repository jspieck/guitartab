/**
 * Writes Guitar Pro 6 .gpx and Guitar Pro 7/8 .gp containers (the reader is in
 * `gpContainers.ts`). Only the export code imports this, so it stays out of the startup bundle.
 */

const SECTOR_SIZE = 0x1000

function writeInt32(target: Uint8Array, offset: number, value: number): void {
  new DataView(target.buffer, target.byteOffset).setInt32(offset, value, true)
}

/**
 * A BCFS image as Guitar Pro 6 writes it: header, then 4 KB sectors. Sector 0 is unused;
 * each file gets an entry sector (name, size, data sector indexes) followed by its data.
 */
export function buildBcfs(files: Record<string, Uint8Array>): Uint8Array {
  const encoder = new TextEncoder()
  const sectors: Uint8Array[] = [new Uint8Array(SECTOR_SIZE)]
  for (const [name, content] of Object.entries(files)) {
    const entry = new Uint8Array(SECTOR_SIZE)
    writeInt32(entry, 0, 2)
    entry.set(encoder.encode(name).subarray(0, 127), 4)
    writeInt32(entry, 0x8c, content.length)
    sectors.push(entry)
    const chunkCount = Math.ceil(content.length / SECTOR_SIZE)
    if (chunkCount > (SECTOR_SIZE - 0x94) / 4 - 1) {
      throw new RangeError(`${name} is too large for a .gpx file.`)
    }
    for (let chunk = 0; chunk < chunkCount; chunk += 1) {
      const data = new Uint8Array(SECTOR_SIZE)
      data.set(content.subarray(chunk * SECTOR_SIZE, (chunk + 1) * SECTOR_SIZE))
      writeInt32(entry, 0x94 + chunk * 4, sectors.length)
      sectors.push(data)
    }
  }
  const out = new Uint8Array(4 + sectors.length * SECTOR_SIZE)
  out.set(encoder.encode('BCFS'))
  sectors.forEach((sector, i) => out.set(sector, 4 + i * SECTOR_SIZE))
  return out
}

/** Bit writer for BCFZ: values most-significant bit first, "reversed" values least first. */
class BitWriter {
  private bytes: number[] = []
  private bit = 0

  write(value: number, count: number): void {
    for (let i = count - 1; i >= 0; i -= 1) this.push((value >> i) & 1)
  }

  writeReversed(value: number, count: number): void {
    for (let i = 0; i < count; i += 1) this.push((value >> i) & 1)
  }

  private push(bit: number): void {
    if (this.bit === 0) this.bytes.push(0)
    this.bytes[this.bytes.length - 1] |= bit << (7 - this.bit)
    this.bit = (this.bit + 1) % 8
  }

  result(): Uint8Array {
    return Uint8Array.from(this.bytes)
  }
}

const MIN_MATCH = 4
const MAX_WORD_BITS = 15

/**
 * BCFZ compression (LZ77 with literal runs of up to 3 bytes and back references), the
 * compressed .gpx container. Greedy matching over a hash of 4-byte sequences: simple, and
 * the empty sectors of a BCFS image shrink to almost nothing.
 */
export function compressBcfz(data: Uint8Array): Uint8Array {
  const writer = new BitWriter()
  const lastSeen = new Map<number, number[]>()
  const maxDistance = (1 << MAX_WORD_BITS) - 1
  const key = (at: number) =>
    ((data[at] << 24) | (data[at + 1] << 16) | (data[at + 2] << 8) | data[at + 3]) >>> 0
  const remember = (at: number) => {
    if (at + MIN_MATCH > data.length) return
    const list = lastSeen.get(key(at)) ?? []
    list.push(at)
    if (list.length > 8) list.shift()
    lastSeen.set(key(at), list)
  }
  let literal: number[] = []
  const flushLiterals = () => {
    for (let i = 0; i < literal.length; i += 3) {
      const run = literal.slice(i, i + 3)
      writer.write(0, 1)
      writer.writeReversed(run.length, 2)
      for (const byte of run) writer.write(byte, 8)
    }
    literal = []
  }
  let at = 0
  while (at < data.length) {
    let bestLength = 0
    let bestDistance = 0
    if (at + MIN_MATCH <= data.length) {
      for (const candidate of lastSeen.get(key(at)) ?? []) {
        const distance = at - candidate
        if (distance > maxDistance) continue
        // A reference copies at most `distance` bytes (the decoder doesn't overlap copies).
        const limit = Math.min(distance, maxDistance, data.length - at)
        let length = 0
        while (length < limit && data[candidate + length] === data[at + length]) length += 1
        if (length > bestLength) {
          bestLength = length
          bestDistance = distance
        }
      }
    }
    if (bestLength >= MIN_MATCH) {
      flushLiterals()
      const bits = Math.max(1, Math.ceil(Math.log2(Math.max(bestDistance, bestLength) + 1)))
      writer.write(1, 1)
      writer.write(bits, 4)
      writer.writeReversed(bestDistance, bits)
      writer.writeReversed(bestLength, bits)
      for (let i = 0; i < bestLength; i += 1) remember(at + i)
      at += bestLength
    } else {
      literal.push(data[at])
      remember(at)
      at += 1
    }
  }
  flushLiterals()
  const body = writer.result()
  const out = new Uint8Array(8 + body.length)
  out.set(new TextEncoder().encode('BCFZ'))
  writeInt32(out, 4, data.length)
  out.set(body, 8)
  return out
}

/** A Guitar Pro 6 .gpx file holding the given GPIF score. */
export function buildGpxFile(gpifXml: string): Uint8Array {
  return compressBcfz(buildBcfs({ 'score.gpif': new TextEncoder().encode(gpifXml) }))
}

let crcTable: Uint32Array | null = null

export function crc32(data: Uint8Array): number {
  if (crcTable == null) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * A ZIP archive with the files stored, not compressed. (fflate's compressor would have joined
 * the startup chunk, which shares fflate's module for reading .gp files.)
 */
export function buildStoredZip(files: Record<string, Uint8Array>): Uint8Array {
  const encoder = new TextEncoder()
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [name, data] of Object.entries(files)) {
    const nameBytes = encoder.encode(name)
    const crc = crc32(data)
    const header = new Uint8Array(30 + nameBytes.length)
    const view = new DataView(header.buffer)
    view.setUint32(0, 0x04034b50, true) // local file header
    view.setUint16(4, 20, true) // version needed
    view.setUint16(6, 0x0800, true) // UTF-8 names
    view.setUint32(14, crc, true)
    view.setUint32(18, data.length, true)
    view.setUint32(22, data.length, true)
    view.setUint16(26, nameBytes.length, true)
    header.set(nameBytes, 30)
    const entry = new Uint8Array(46 + nameBytes.length)
    const entryView = new DataView(entry.buffer)
    entryView.setUint32(0, 0x02014b50, true) // central directory header
    entryView.setUint16(4, 20, true)
    entryView.setUint16(6, 20, true)
    entryView.setUint16(8, 0x0800, true)
    entryView.setUint32(16, crc, true)
    entryView.setUint32(20, data.length, true)
    entryView.setUint32(24, data.length, true)
    entryView.setUint16(28, nameBytes.length, true)
    entryView.setUint32(42, offset, true)
    entry.set(nameBytes, 46)
    local.push(header, data)
    central.push(entry)
    offset += header.length + data.length
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true) // end of central directory
  endView.setUint16(8, central.length, true)
  endView.setUint16(10, central.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  const out = new Uint8Array(offset + centralSize + end.length)
  let at = 0
  for (const part of [...local, ...central, end]) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/**
 * A Guitar Pro 7/8 .gp file: a ZIP with the score at `Content/score.gpif` and a `VERSION`
 * entry, as Guitar Pro writes them. The style sheet and part/layout configuration files
 * Guitar Pro adds are optional (Guitar Pro falls back to defaults), so they are left out.
 */
export function buildGpFile(gpifXml: string): Uint8Array {
  const encoder = new TextEncoder()
  return buildStoredZip({
    VERSION: encoder.encode('7.0'),
    'Content/score.gpif': encoder.encode(gpifXml),
  })
}
