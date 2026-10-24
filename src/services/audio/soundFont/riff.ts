/*! Based on the JavaScript SoundFont 2 Parser. Copyright 2013-2015
imaya/GREE Inc and Colin Clark. Licensed under the MIT License. */

export interface RiffChunk {
  type: string
  size: number
  /** Where the chunk's data starts (after the 8-byte header). */
  offset: number
}

export interface RiffOptions {
  index?: number
  length?: number
  /** Chunks start on even offsets (default true). */
  padding?: boolean
  bigEndian?: boolean
}

export function fourCC(input: Uint8Array, ip: number): string {
  return String.fromCharCode(input[ip], input[ip + 1], input[ip + 2], input[ip + 3])
}

/** The chunks one after another in `input` from `index` on. */
export function parseRiff(input: Uint8Array, options: RiffOptions = {}): RiffChunk[] {
  let ip = options.index || 0
  // a length of 0 means "to the end", as in the original parser
  const length = options.length || input.length - ip
  const offset = ip
  const padding = options.padding ?? true
  const bigEndian = options.bigEndian ?? false
  const end = length + offset
  const chunks: RiffChunk[] = []
  while (ip < end) {
    const size = bigEndian
      ? ((input[ip + 4] << 24) | (input[ip + 5] << 16) | (input[ip + 6] << 8) | input[ip + 7]) >>> 0
      : (input[ip + 4] | (input[ip + 5] << 8) | (input[ip + 6] << 16) | (input[ip + 7] << 24)) >>> 0
    chunks.push({ type: fourCC(input, ip), size, offset: ip + 8 })
    ip += 8 + size
    if (padding && ((ip - offset) & 1) === 1) ip += 1
  }
  return chunks
}
