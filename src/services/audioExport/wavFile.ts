/**
 * A WAV file (RIFF, 16-bit PCM, interleaved) from float channels. Pure.
 */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const channelCount = channels.length
  const frames = channels[0]?.length ?? 0
  const bytesPerSample = 2
  const dataBytes = frames * channelCount * bytesPerSample
  const bytes = new Uint8Array(44 + dataBytes)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i)
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true)
  view.setUint16(32, channelCount * bytesPerSample, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, dataBytes, true)
  let offset = 44
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      view.setInt16(offset, toInt16(channels[channel][frame]), true)
      offset += bytesPerSample
    }
  }
  return bytes
}

function toInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, Number.isFinite(sample) ? sample : 0))
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff)
}

/**
 * Where the sound ends: the frame after the last one louder than `threshold` (about -80 dB),
 * plus `padding` frames, but not before `minFrames`. Trims the silent tail a render leaves
 * for releases and reverb.
 */
export function audibleLength(
  channels: readonly Float32Array[],
  minFrames: number,
  padding: number,
  threshold = 1e-4,
): number {
  const frames = channels[0]?.length ?? 0
  let last = 0
  for (const data of channels) {
    for (let frame = frames - 1; frame > last; frame -= 1) {
      if (Math.abs(data[frame]) > threshold) {
        last = frame
        break
      }
    }
  }
  return Math.min(frames, Math.max(minFrames, last + 1 + padding))
}
