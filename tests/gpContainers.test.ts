import { describe, expect, it } from 'vitest'
import { unzipSync, zipSync } from 'fflate'
import {
  decompressBcfz,
  detectGpContainer,
  extractGpifXml,
  readBcfsFiles,
} from '../src/services/gpContainers'
import { ImportError } from '../src/services/importErrors'
import { buildBcfs } from '../e2e/fixtures/gpFiles'
import { buildGpFile, buildStoredZip, crc32 } from '../src/services/gpxWriter'

const encoder = new TextEncoder()

function writeInt32(target: Uint8Array, offset: number, value: number) {
  new DataView(target.buffer, target.byteOffset).setInt32(offset, value, true)
}

/** Bit writer matching BCFZ: values most-significant bit first, "reversed" values least first. */
class BitWriter {
  bits: number[] = []

  write(value: number, count: number) {
    for (let i = count - 1; i >= 0; i -= 1) this.bits.push((value >> i) & 1)
  }

  writeReversed(value: number, count: number) {
    for (let i = 0; i < count; i += 1) this.bits.push((value >> i) & 1)
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8))
    this.bits.forEach((bit, i) => {
      out[i >> 3] |= bit << (7 - (i & 7))
    })
    return out
  }
}

/** BCFZ with literal runs, plus back references for repeated 4-byte groups (exercises both chunk types). */
function compressBcfz(data: Uint8Array): Uint8Array {
  const writer = new BitWriter()
  let i = 0
  while (i < data.length) {
    const canCopy =
      i >= 4 && i + 4 <= data.length && data.subarray(i, i + 4).every((byte, k) => byte === data[i - 4 + k])
    if (canCopy) {
      writer.write(1, 1)
      writer.write(3, 4) // 3-bit words
      writer.writeReversed(4, 3) // offset
      writer.writeReversed(4, 3) // size
      i += 4
    } else {
      const size = Math.min(3, data.length - i)
      writer.write(0, 1)
      writer.writeReversed(size, 2)
      for (let k = 0; k < size; k += 1) writer.write(data[i + k], 8)
      i += size
    }
  }
  const body = writer.bytes()
  const out = new Uint8Array(8 + body.length)
  out.set(encoder.encode('BCFZ'))
  writeInt32(out, 4, data.length)
  out.set(body, 8)
  return out
}

// Long enough to span two sectors, with repeats so the compressor uses back references.
const score = `<?xml version="1.0"?><GPIF>${'<Note id="1"><Fret>3</Fret></Note>'.repeat(200)}</GPIF>`

describe('Guitar Pro containers', () => {
  it('recognizes containers by their first bytes', () => {
    expect(detectGpContainer(zipSync({ a: new Uint8Array([1]) }))).toBe('zip')
    expect(detectGpContainer(buildBcfs({}))).toBe('bcfs')
    expect(detectGpContainer(compressBcfz(new Uint8Array([1, 2])))).toBe('bcfz')
    expect(detectGpContainer(encoder.encode('FICHIER GUITAR PRO v5.00'))).toBeNull()
  })

  it('reads files from BCFS by following the sector index', () => {
    const files = readBcfsFiles(
      buildBcfs({ misc: encoder.encode('other'), 'score.gpif': encoder.encode(score) }),
    )
    expect(new TextDecoder().decode(files.get('score.gpif'))).toBe(score)
    expect(new TextDecoder().decode(files.get('misc'))).toBe('other')
  })

  it('decompresses BCFZ literal runs and back references', () => {
    const data = encoder.encode('abcdabcdabcdxyz')
    expect(Array.from(decompressBcfz(compressBcfz(data)))).toEqual(Array.from(data))
  })

  it('extracts the score from .gpx (compressed and uncompressed) and .gp archives', () => {
    const bcfs = buildBcfs({ 'score.gpif': encoder.encode(score) })
    expect(extractGpifXml(bcfs, 'gpx')).toBe(score)
    expect(extractGpifXml(compressBcfz(bcfs), 'gpx')).toBe(score)
    const gp = zipSync({ VERSION: encoder.encode('7.0'), 'Content/score.gpif': encoder.encode(score) })
    expect(extractGpifXml(gp, 'gp')).toBe(score)
  })

  it('writes .gp archives as Guitar Pro 7 does: VERSION and Content/score.gpif', () => {
    const file = buildGpFile(score)
    expect(detectGpContainer(file)).toBe('zip')
    const entries = unzipSync(file)
    expect(Object.keys(entries).sort()).toEqual(['Content/score.gpif', 'VERSION'])
    expect(new TextDecoder().decode(entries.VERSION)).toBe('7.0')
    expect(extractGpifXml(file, 'gp')).toBe(score)
  })

  it('writes stored ZIP entries any ZIP reader accepts, with correct checksums', () => {
    const data = encoder.encode('ä'.repeat(3000))
    const zip = buildStoredZip({ 'a/b.txt': data, empty: new Uint8Array(0) })
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926) // the standard check value
    const entries = unzipSync(zip)
    expect(Array.from(entries['a/b.txt'])).toEqual(Array.from(data))
    expect(entries.empty.length).toBe(0)
  })

  it('fails with an ImportError for damaged or unrelated data', () => {
    const expectImportError = (bytes: Uint8Array) =>
      expect(() => extractGpifXml(bytes, 'gp')).toThrow(ImportError)
    expectImportError(zipSync({ 'Content/other.xml': encoder.encode('x') }))
    expectImportError(buildBcfs({ misc: encoder.encode('x') }))
    expectImportError(encoder.encode('not a guitar pro file'))
    expectImportError(zipSync({ 'Content/score.gpif': encoder.encode(score) }).subarray(0, 40))
    // A back reference before the start of the output.
    const writer = new BitWriter()
    writer.write(1, 1)
    writer.write(3, 4)
    writer.writeReversed(4, 3)
    writer.writeReversed(4, 3)
    const bad = new Uint8Array(8 + 2)
    bad.set(encoder.encode('BCFZ'))
    writeInt32(bad, 4, 100)
    bad.set(writer.bytes(), 8)
    expectImportError(bad)
  })
})
