import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs build script without types
import { buildTestSoundFont } from '../scripts/make-test-soundfont.mjs'
import { COMPRESSED_SAMPLE, parseSoundFont } from '../src/services/audio/soundFont/parser'
import { decodeCompressedSamples, hasCompressedSamples } from '../src/services/audio/soundFont/sf3'

/** The generated test SoundFont with its one sample flagged as an SF3 (Ogg Vorbis) stream. */
function asSf3(): Uint8Array {
  const bytes: Uint8Array = buildTestSoundFont()
  const text = new TextDecoder('latin1').decode(bytes)
  const shdr = text.indexOf('shdr') + 8
  const view = new DataView(bytes.buffer, bytes.byteOffset)
  view.setUint16(shdr + 44, view.getUint16(shdr + 44, true) | COMPRESSED_SAMPLE, true)
  return bytes
}

const fakeBuffer = (frames: number, sampleRate: number) =>
  ({ sampleRate, getChannelData: () => new Float32Array(frames).fill(0.5) }) as unknown as AudioBuffer
/** A browser decoder that rejects every stream, and a fallback that can't read them either. */
const rejecting = () => ({ decodeAudioData: () => Promise.reject(new Error('EncodingError')) })
const brokenFallback = async () => ({ decode: () => Promise.reject(new Error('bad stream')), free: () => {} })

describe('SF3 samples', () => {
  it('keeps a compressed sample as its bytes, loop points counted from the sample start', () => {
    const data = parseSoundFont(asSf3())
    expect(hasCompressedSamples(data)).toBe(true)
    // the test sample spans frames 0–100, read as bytes now
    expect(data.compressed[0]).toHaveLength(100)
    expect(data.samples[0]).toHaveLength(0)
    expect(data.sampleHeaders[0]).toMatchObject({ startLoop: 0, endLoop: 100, sampleRate: 44100 })
  })

  it('decodes each sample at its own rate and reports progress', async () => {
    const data = parseSoundFont(asSf3())
    const rates: number[] = []
    const progress: string[] = []
    await decodeCompressedSamples(
      data,
      (done, total) => progress.push(`${done}/${total}`),
      (rate) => {
        rates.push(rate)
        return { decodeAudioData: async () => fakeBuffer(300, rate) }
      },
    )
    expect(rates).toEqual([44100])
    expect(progress).toEqual(['1/1'])
    expect(data.samples[0]).toHaveLength(300)
    expect(data.compressed[0]).toBeNull()
    expect(hasCompressedSamples(data)).toBe(false)
  })

  it('scales the loop points if the decoder resamples', async () => {
    const data = parseSoundFont(asSf3())
    await decodeCompressedSamples(data, undefined, () => ({
      decodeAudioData: async () => fakeBuffer(200, 88200),
    }))
    expect(data.sampleHeaders[0]).toMatchObject({ startLoop: 0, endLoop: 200, sampleRate: 88200 })
  })

  it('decodes the streams the browser rejects with the fallback decoder', async () => {
    const data = parseSoundFont(asSf3())
    const decoded: number[] = []
    const failed = await decodeCompressedSamples(data, undefined, rejecting, async () => ({
      decode: async (bytes) => {
        decoded.push(bytes.length)
        return { channelData: [new Float32Array(64).fill(0.25)], samplesDecoded: 50, sampleRate: 44100 }
      },
      free: () => {},
    }))
    expect(failed).toEqual([])
    expect(decoded).toEqual([100])
    // trimmed to the decoded length
    expect(data.samples[0]).toHaveLength(50)
  })

  it('leaves a sample neither decoder reads empty and names it; fails only when none decodes', async () => {
    // one stream fails among several: build data with a second, decodable copy
    const data = parseSoundFont(asSf3())
    data.compressed.push(data.compressed[0]!.slice())
    data.sampleHeaders.push({ ...data.sampleHeaders[0], sampleName: 'Good' })
    data.samples.push(new Int16Array(0))
    let calls = 0
    const failed = await decodeCompressedSamples(
      data,
      undefined,
      () => ({
        decodeAudioData: () =>
          calls++ === 0 ? Promise.reject(new Error('EncodingError')) : Promise.resolve(fakeBuffer(10, 44100)),
      }),
      brokenFallback,
    )
    expect(failed).toEqual(['Sine'])
    expect([data.samples[0].length, data.samples.at(-1)!.length]).toEqual([0, 10])

    await expect(
      decodeCompressedSamples(parseSoundFont(asSf3()), undefined, rejecting, brokenFallback),
    ).rejects.toThrow('This browser cannot decode')
  })
})
