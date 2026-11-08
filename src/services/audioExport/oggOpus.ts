/**
 * An Ogg Opus file (RFC 7845) from Opus packets: the identification header (OpusHead), the
 * comment header (OpusTags), then the audio packets in pages of up to 255 segments, each page
 * carrying the granule position (48 kHz samples, pre-skip included) of its last packet. Pure;
 * the packets come from the browser's encoder (`opusEncoder.ts`).
 */

export interface OpusPacket {
  data: Uint8Array
  /** samples at 48 kHz it decodes to */
  samples: number
}

export interface OggOpusHeader {
  channels: number
  /** samples the decoder drops at the start (the encoder's look-ahead) */
  preSkip: number
  /** the original sample rate, for information */
  inputSampleRate: number
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let crc = i << 24
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x80000000 ? (crc << 1) ^ 0x04c11db7 : crc << 1
    table[i] = crc >>> 0
  }
  return table
})()

/** Ogg's CRC-32: polynomial 0x04c11db7, no reflection, initial value and final XOR 0. */
export function oggCrc(bytes: Uint8Array): number {
  let crc = 0
  for (const byte of bytes) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]) >>> 0
  return crc
}

const FLAG_BOS = 0x02
const FLAG_EOS = 0x04
const MAX_SEGMENTS = 255
/** a page holds at most about a second, so a player can seek */
const PAGE_SAMPLES = 48000

/** The lacing values of one packet: 255 per full segment, then the rest (0 when it fits exactly). */
function lacing(length: number): number[] {
  const values = new Array<number>(Math.floor(length / 255)).fill(255)
  values.push(length % 255)
  return values
}

function page(
  packets: readonly Uint8Array[],
  flags: number,
  granule: bigint,
  serial: number,
  sequence: number,
): Uint8Array {
  const segments = packets.flatMap((packet) => lacing(packet.length))
  const bodyLength = packets.reduce((sum, packet) => sum + packet.length, 0)
  const bytes = new Uint8Array(27 + segments.length + bodyLength)
  const view = new DataView(bytes.buffer)
  bytes.set([0x4f, 0x67, 0x67, 0x53]) // "OggS"
  bytes[4] = 0 // version
  bytes[5] = flags
  view.setBigUint64(6, granule, true)
  view.setUint32(14, serial, true)
  view.setUint32(18, sequence, true)
  // CRC (22–25) stays 0 while it is computed
  bytes[26] = segments.length
  bytes.set(segments, 27)
  let offset = 27 + segments.length
  for (const packet of packets) {
    bytes.set(packet, offset)
    offset += packet.length
  }
  view.setUint32(22, oggCrc(bytes), true)
  return bytes
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0) & 0xff)
}

export function opusHead(header: OggOpusHeader): Uint8Array {
  const bytes = new Uint8Array(19)
  const view = new DataView(bytes.buffer)
  bytes.set(ascii('OpusHead'))
  bytes[8] = 1 // version
  bytes[9] = header.channels
  view.setUint16(10, header.preSkip, true)
  view.setUint32(12, header.inputSampleRate, true)
  view.setInt16(16, 0, true) // output gain
  bytes[18] = 0 // channel mapping family 0: mono or stereo
  return bytes
}

export function opusTags(vendor: string, comments: readonly string[]): Uint8Array {
  const encoder = new TextEncoder()
  const vendorBytes = encoder.encode(vendor)
  const commentBytes = comments.map((comment) => encoder.encode(comment))
  const length = 8 + 4 + vendorBytes.length + 4 + commentBytes.reduce((sum, c) => sum + 4 + c.length, 0)
  const bytes = new Uint8Array(length)
  const view = new DataView(bytes.buffer)
  bytes.set(ascii('OpusTags'))
  view.setUint32(8, vendorBytes.length, true)
  bytes.set(vendorBytes, 12)
  let offset = 12 + vendorBytes.length
  view.setUint32(offset, commentBytes.length, true)
  offset += 4
  for (const comment of commentBytes) {
    view.setUint32(offset, comment.length, true)
    bytes.set(comment, offset + 4)
    offset += 4 + comment.length
  }
  return bytes
}

/** The pre-skip from an OpusHead the encoder hands out (WebCodecs `decoderConfig.description`), if it is one. */
export function preSkipOf(description: Uint8Array | null | undefined): number | null {
  if (description == null || description.length < 19) return null
  const magic = String.fromCharCode(...description.subarray(0, 8))
  if (magic !== 'OpusHead') return null
  return description[10] | (description[11] << 8)
}

/**
 * The whole file. `totalSamples` is the audio's real length at 48 kHz: the last page's
 * granule stops there, so players drop the encoder's padding at the end.
 */
export function buildOggOpus(
  header: OggOpusHeader,
  packets: readonly OpusPacket[],
  totalSamples: number,
  options: { serial?: number; comments?: readonly string[] } = {},
): Uint8Array {
  const serial = options.serial ?? 0x47544142 // "GTAB"
  const pages: Uint8Array[] = [
    page([opusHead(header)], FLAG_BOS, 0n, serial, 0),
    page([opusTags('GuitarTab', options.comments ?? [])], 0, 0n, serial, 1),
  ]
  const end = BigInt(header.preSkip + totalSamples)
  let granule = header.preSkip
  let pending: Uint8Array[] = []
  let pendingSegments = 0
  let pendingSamples = 0
  const flush = (last: boolean) => {
    const position = BigInt(granule) < end && !last ? BigInt(granule) : end
    pages.push(page(pending, last ? FLAG_EOS : 0, position, serial, pages.length))
    pending = []
    pendingSegments = 0
    pendingSamples = 0
  }
  packets.forEach((packet, index) => {
    const segments = lacing(packet.data.length).length
    if (pending.length > 0 && (pendingSegments + segments > MAX_SEGMENTS || pendingSamples >= PAGE_SAMPLES)) {
      flush(false)
    }
    pending.push(packet.data)
    pendingSegments += segments
    pendingSamples += packet.samples
    granule += packet.samples
    if (index === packets.length - 1) flush(true)
  })
  if (packets.length === 0) pages.push(page([], FLAG_EOS, end, serial, pages.length))
  const size = pages.reduce((sum, bytes) => sum + bytes.length, 0)
  const file = new Uint8Array(size)
  let offset = 0
  for (const bytes of pages) {
    file.set(bytes, offset)
    offset += bytes.length
  }
  return file
}
