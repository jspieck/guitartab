import { buildOggOpus, preSkipOf, type OpusPacket } from './oggOpus'

/**
 * Opus through the browser's own encoder (WebCodecs `AudioEncoder`), packed into an Ogg file.
 * No encoder is shipped: where the browser has none, the dialog offers WAV only.
 */

// The parts of WebCodecs used here (TypeScript 4.9's DOM types don't have them yet).
interface AudioEncoderConfig {
  codec: string
  sampleRate: number
  numberOfChannels: number
  bitrate?: number
}
interface EncodedAudioChunk {
  readonly byteLength: number
  readonly duration: number | null
  copyTo(destination: Uint8Array): void
}
interface EncodedAudioChunkMetadata {
  decoderConfig?: { description?: ArrayBuffer | ArrayBufferView }
}
interface AudioEncoder {
  readonly state: 'unconfigured' | 'configured' | 'closed'
  readonly encodeQueueSize: number
  configure(config: AudioEncoderConfig): void
  encode(data: AudioData): void
  flush(): Promise<void>
  close(): void
}
interface AudioData {
  close(): void
}
interface WebCodecs {
  AudioEncoder?: {
    new (init: {
      output: (chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void
      error: (error: Error) => void
    }): AudioEncoder
    isConfigSupported(config: AudioEncoderConfig): Promise<{ supported?: boolean }>
  }
  AudioData?: new (init: {
    format: 'f32-planar'
    sampleRate: number
    numberOfFrames: number
    numberOfChannels: number
    timestamp: number
    data: Float32Array
  }) => AudioData
}

const webCodecs = globalThis as unknown as WebCodecs

export const OPUS_SAMPLE_RATE = 48000
const BITRATE = 160_000
/** frames per AudioData handed to the encoder */
const CHUNK_FRAMES = 4800
/** the libopus look-ahead at 48 kHz, when the encoder doesn't say */
const DEFAULT_PRE_SKIP = 312

function config(channels: number): AudioEncoderConfig {
  return { codec: 'opus', sampleRate: OPUS_SAMPLE_RATE, numberOfChannels: channels, bitrate: BITRATE }
}

function packetOf(chunk: EncodedAudioChunk): OpusPacket {
  const data = new Uint8Array(chunk.byteLength)
  chunk.copyTo(data)
  // (20 ms frames when the encoder doesn't say)
  return { data, samples: Math.round(((chunk.duration ?? 20_000) * OPUS_SAMPLE_RATE) / 1_000_000) }
}

function descriptionBytes(metadata: EncodedAudioChunkMetadata | undefined): Uint8Array | null {
  const description = metadata?.decoderConfig?.description
  if (description == null) return null
  return description instanceof ArrayBuffer
    ? new Uint8Array(description)
    : new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
}

/** `count` frames from `first` on as one planar AudioData. */
function audioDataAt(
  AudioDataClass: NonNullable<WebCodecs['AudioData']>,
  channels: readonly Float32Array[],
  first: number,
  count: number,
): AudioData {
  const planar = new Float32Array(count * channels.length)
  channels.forEach((data, channel) => planar.set(data.subarray(first, first + count), channel * count))
  return new AudioDataClass({
    format: 'f32-planar',
    sampleRate: OPUS_SAMPLE_RATE,
    numberOfFrames: count,
    numberOfChannels: channels.length,
    timestamp: Math.round((first / OPUS_SAMPLE_RATE) * 1_000_000),
    data: planar,
  })
}

/** Whether this browser can encode Opus. */
export async function opusSupported(): Promise<boolean> {
  const { AudioEncoder, AudioData } = webCodecs
  if (AudioEncoder == null || AudioData == null) return false
  try {
    return (await AudioEncoder.isConfigSupported(config(2))).supported === true
  } catch {
    return false
  }
}

/**
 * Encodes 48 kHz float channels to an Ogg Opus file. `onProgress` gets 0…1; an aborted
 * `signal` stops it with an AbortError.
 */
export async function encodeOggOpus(
  channels: readonly Float32Array[],
  options: {
    comments?: readonly string[]
    onProgress?: (fraction: number) => void
    signal?: AbortSignal
  } = {},
): Promise<Uint8Array> {
  const { AudioEncoder, AudioData } = webCodecs
  if (AudioEncoder == null || AudioData == null) throw new Error('This browser has no Opus encoder.')
  const { signal, onProgress } = options
  const frames = channels[0]?.length ?? 0
  const packets: OpusPacket[] = []
  let preSkip: number | null = null
  let failure: unknown = null
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      packets.push(packetOf(chunk))
      preSkip ??= preSkipOf(descriptionBytes(metadata))
    },
    error: (error) => {
      failure = error
    },
  })
  encoder.configure(config(channels.length))
  try {
    for (let first = 0; first < frames; first += CHUNK_FRAMES) {
      signal?.throwIfAborted()
      if (failure != null) throw failure
      const audio = audioDataAt(AudioData, channels, first, Math.min(CHUNK_FRAMES, frames - first))
      encoder.encode(audio)
      audio.close()
      // let the encoder catch up, and the page breathe
      if (encoder.encodeQueueSize > 8) await new Promise((resolve) => setTimeout(resolve, 0))
      onProgress?.(first / frames)
    }
    await encoder.flush()
    if (failure != null) throw failure
  } finally {
    if (encoder.state !== 'closed') encoder.close()
  }
  onProgress?.(1)
  return buildOggOpus(
    { channels: channels.length, preSkip: preSkip ?? DEFAULT_PRE_SKIP, inputSampleRate: OPUS_SAMPLE_RATE },
    packets,
    frames,
    { comments: options.comments },
  )
}
