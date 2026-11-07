import type { SampleHeader, SoundFontData } from './parser'

/**
 * SF3 (MuseScore's compressed SoundFont): every sample is its own Ogg Vorbis stream. The
 * browser decodes them (`decodeAudioData`, off the main thread) on an OfflineAudioContext
 * running at the sample's own rate, so nothing is resampled and the loop points (decoded
 * frames from the sample's start) stay exact. Streams the browser rejects (Chrome: a few tiny
 * synth waveforms of MuseScore_General; browsers without Ogg Vorbis: all of them) go through
 * a WASM Vorbis decoder in a worker, loaded only then (its own `vorbis-decoder` chunk).
 */

/** Streams decoded at the same time: enough to keep the decoder busy without a 1000-promise burst. */
const PARALLEL = 8

export type DecodeContext = Pick<BaseAudioContext, 'decodeAudioData'>

/** Decoded PCM of one stream: the first channel, its length and rate. */
export interface DecodedStream {
  channelData: Float32Array[]
  samplesDecoded: number
  sampleRate: number
}

/** A second decoder for the streams the browser rejected. */
export interface FallbackDecoder {
  decode(bytes: Uint8Array): Promise<DecodedStream>
  free(): void
}

const defaultContext = (sampleRate: number): DecodeContext => new OfflineAudioContext(1, 1, sampleRate)

async function wasmDecoder(): Promise<FallbackDecoder> {
  const { OggVorbisDecoderWebWorker } = await import('@wasm-audio-decoders/ogg-vorbis')
  const decoder = new OggVorbisDecoderWebWorker()
  await decoder.ready
  return {
    async decode(bytes) {
      const decoded = await decoder.decodeFile(bytes)
      // each sample is a stream of its own: start the next from a clean decoder state
      await decoder.reset()
      return decoded
    },
    free: () => void decoder.free(),
  }
}

/** Stores decoded PCM for sample `index`; the loop points follow if the rate changed. */
function storeSample(data: SoundFontData, index: number, pcm: Float32Array, sampleRate: number): void {
  const header: SampleHeader = data.sampleHeaders[index]
  const ratio = sampleRate / header.sampleRate
  header.startLoop = Math.round(header.startLoop * ratio)
  header.endLoop = Math.round(header.endLoop * ratio)
  header.sampleRate = sampleRate
  data.samples[index] = pcm
}

const nameOf = (data: SoundFontData, index: number) =>
  data.sampleHeaders[index].sampleName.replace(/\0+$/, '')

/**
 * Decodes the compressed samples of `data` in place: `samples[i]` becomes the PCM, the
 * header's rate and loop points follow the decoded audio. `onProgress(done, total)` after
 * each sample. A sample neither decoder can read stays empty (its zones are left out) and its
 * name is returned. Rejects only when nothing decodes.
 */
export async function decodeCompressedSamples(
  data: SoundFontData,
  onProgress: (done: number, total: number) => void = () => {},
  createContext: (sampleRate: number) => DecodeContext = defaultContext,
  loadFallback: () => Promise<FallbackDecoder> = wasmDecoder,
): Promise<string[]> {
  const pending = data.compressed.flatMap((bytes, index) => (bytes ? [index] : []))
  const contexts = new Map<number, DecodeContext>()
  const contextFor = (rate: number) => {
    let context = contexts.get(rate)
    if (context == null) {
      context = createContext(rate)
      contexts.set(rate, context)
    }
    return context
  }
  let done = 0
  let next = 0
  const rejected = new Map<number, Uint8Array>()
  const progress = () => {
    done += 1
    onProgress(done, pending.length)
  }

  async function decodeNatively(index: number): Promise<void> {
    const bytes = data.compressed[index]!
    data.compressed[index] = null
    // decodeAudioData takes (detaches) the buffer: give it a copy of just this stream
    const stream = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    try {
      const buffer = await contextFor(data.sampleHeaders[index].sampleRate).decodeAudioData(stream)
      storeSample(data, index, buffer.getChannelData(0), buffer.sampleRate)
      progress()
    } catch {
      rejected.set(index, bytes)
    }
  }

  async function worker(): Promise<void> {
    while (next < pending.length) {
      const index = pending[next]
      next += 1
      await decodeNatively(index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(PARALLEL, pending.length) }, worker))
  const failed = rejected.size ? await decodeWithFallback(data, rejected, loadFallback, progress) : []
  if (pending.length && failed.length === pending.length) {
    throw new Error('This browser cannot decode the SoundFont’s Ogg Vorbis (SF3) samples')
  }
  return failed
}

/** Decodes the streams the browser rejected, one after another; returns the names that still fail. */
async function decodeWithFallback(
  data: SoundFontData,
  rejected: Map<number, Uint8Array>,
  loadFallback: () => Promise<FallbackDecoder>,
  progress: () => void,
): Promise<string[]> {
  const failed: string[] = []
  let decoder: FallbackDecoder | null = null
  try {
    decoder = await loadFallback()
  } catch (error) {
    console.error('The WASM Vorbis decoder could not be loaded', error)
  }
  for (const [index, bytes] of rejected) {
    try {
      if (decoder == null) throw new Error('no fallback decoder')
      const decoded = await decoder.decode(bytes)
      if (!decoded.samplesDecoded) throw new Error('empty stream')
      storeSample(data, index, decoded.channelData[0].subarray(0, decoded.samplesDecoded), decoded.sampleRate)
    } catch {
      failed.push(nameOf(data, index))
    }
    progress()
  }
  decoder?.free()
  return failed
}

/** True when the parsed SoundFont still holds compressed (SF3) samples. */
export function hasCompressedSamples(data: SoundFontData): boolean {
  return data.compressed.some((bytes) => bytes != null)
}
