/**
 * Standard MIDI files built byte by byte for tests (there are no real ones in the repo
 * besides `e2e/fixtures/files/two-bars.mid`).
 */

/** Variable-length quantity: 7 bits per byte, high bit = more bytes follow. */
export function vlq(value: number): number[] {
  const bytes = [value & 0x7f]
  let rest = value >> 7
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80)
    rest >>= 7
  }
  return bytes
}

const u16 = (value: number) => [(value >> 8) & 0xff, value & 0xff]
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >> 16) & 0xff,
  (value >> 8) & 0xff,
  value & 0xff,
]
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0))

/** A track chunk from events given as [delta, ...raw event bytes]; adds the end-of-track meta. */
export function track(events: [number, ...number[]][]): number[] {
  const body = events.flatMap(([delta, ...bytes]) => [...vlq(delta), ...bytes])
  body.push(0, 0xff, 0x2f, 0)
  return [...ascii('MTrk'), ...u32(body.length), ...body]
}

export function meta(type: number, data: number[]): number[] {
  return [0xff, type, ...vlq(data.length), ...data]
}

export const trackName = (name: string) => meta(0x03, ascii(name))
export const text = (value: string) => meta(0x01, ascii(value))
/** Tempo in BPM as microseconds per quarter. */
export const tempo = (bpm: number) => meta(0x51, u32(Math.round(60_000_000 / bpm)).slice(1))
export const timeSignature = (numerator: number, denominator: number) =>
  meta(0x58, [numerator, Math.log2(denominator), 24, 8])

export function midiFile(format: number, ticksPerQuarter: number, tracks: number[][]): Uint8Array {
  return Uint8Array.from([
    ...ascii('MThd'),
    ...u32(6),
    ...u16(format),
    ...u16(tracks.length),
    ...u16(ticksPerQuarter),
    ...tracks.flat(),
  ])
}
