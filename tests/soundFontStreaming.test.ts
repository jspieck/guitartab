// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error plain .mjs build script without types
import { buildTestSoundFont } from '../scripts/make-test-soundfont.mjs'
// @ts-expect-error plain .mjs build script without types
import { manifestFor } from '../scripts/soundfont-file.mjs'
import { parsePresetData, parseSoundFont, type SoundFontData } from '../src/services/audio/soundFont/parser'
import {
  mergedRanges,
  SoundFontStream,
  streamSoundFont,
  WholeFileError,
  type Fetcher,
  type SoundFontManifest,
} from '../src/services/audio/soundFont/streaming'
import { synth } from '../src/services/audio/soundFont/synth'
import Song from '../src/stores/song'
import { isPresetLoading, soundFontState, whenPresetsLoaded } from '../src/stores/soundFontState'

vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)

/** A server for one file that answers range requests (or ignores them), logging each request. */
function server(file: Uint8Array, { ranges = true } = {}) {
  const requests: [number, number][] = []
  const fetcher: Fetcher = async (_url, init) => {
    const header = new Headers(init.headers).get('Range')
    const match = header?.match(/^bytes=(\d+)-(\d+)$/)
    if (!ranges || !match) return new Response(file.slice().buffer, { status: 200 })
    const [first, last] = [Number(match[1]), Number(match[2])]
    requests.push([first, last + 1])
    return new Response(file.slice(first, last + 1).buffer, { status: 206 })
  }
  return { fetcher, requests }
}

const font = (): Uint8Array => buildTestSoundFont()
const manifestOf = (bytes: Uint8Array): SoundFontManifest => manifestFor(bytes, 'test.sf2')

function streamOf(bytes: Uint8Array, fetcher: Fetcher, onBuilt?: (keys: string[]) => void) {
  const manifest = manifestOf(bytes)
  const [first, count] = manifest.pdta
  return new SoundFontStream(bytes.slice(first, first + count), 'test.sf2', manifest.smpl, fetcher, onBuilt)
}

describe('SoundFont manifest and preset data', () => {
  it('points at the pdta chunk and the sample data, which parse like the whole file', () => {
    const bytes = font()
    const manifest = manifestOf(bytes)
    const [first, count] = manifest.pdta
    expect(String.fromCharCode(...bytes.subarray(first, first + 4))).toBe('LIST')
    expect(String.fromCharCode(...bytes.subarray(first + 8, first + 12))).toBe('pdta')
    expect(String.fromCharCode(...bytes.subarray(manifest.smpl - 8, manifest.smpl - 4))).toBe('smpl')
    const presets = parsePresetData(bytes.slice(first, first + count))
    const whole = parseSoundFont(bytes)
    expect(presets.presetHeaders).toEqual(whole.presetHeaders)
    expect(presets.sampleHeaders.map((h) => h.sampleName)).toEqual(
      whole.sampleHeaders.map((h) => h.sampleName),
    )
    expect(presets.sampleRanges).toEqual(whole.sampleRanges)
    // nothing loaded yet
    expect(presets.samples.every((sample) => sample.length === 0)).toBe(true)
    expect(manifest.bytes).toBe(bytes.length)
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('mergedRanges', () => {
  const data = {
    sampleRanges: [
      [0, 100],
      [150, 300],
      [100_000, 100_400],
      [5, 5],
    ],
  } as unknown as SoundFontData

  it('sorts the ranges and joins those closer than the gap', () => {
    expect(mergedRanges(data, [2, 1, 0], 64)).toEqual([
      { first: 0, end: 300, ids: [0, 1] },
      { first: 100_000, end: 100_400, ids: [2] },
    ])
    expect(mergedRanges(data, [0, 1], 10)).toHaveLength(2)
  })

  it('skips empty samples', () => {
    expect(mergedRanges(data, [3])).toEqual([])
  })
})

describe('SoundFontStream', () => {
  it('fetches only the sample bytes a preset needs and builds the presets that are complete', async () => {
    const bytes = font()
    const { fetcher, requests } = server(bytes)
    const built: string[] = []
    const stream = streamOf(bytes, fetcher, (keys) => built.push(...keys))
    expect(stream.has('0:25')).toBe(true)
    expect(stream.isBuilt('0:25')).toBe(false)
    expect(stream.pendingBytes(['0:25'])).toBe(200) // the one 100-frame sine, 16 bit
    // preset 0 (the piano), not the terminal EOP record that also says bank 0, preset 0
    expect(stream.pendingBytes(['0:0'])).toBe(200)

    expect(await stream.load(['0:25'])).toBeNull()
    const smpl = manifestOf(bytes).smpl
    expect(requests).toEqual([[smpl, smpl + 200]])
    // every preset of the test font plays that one sample, so all are complete now
    expect(stream.isBuilt('0:25')).toBe(true)
    expect(stream.isBuilt('128:0')).toBe(true)
    expect(built).toContain('0:25')
    expect(stream.banks[0][25][69]?.sample.length).toBe(100)

    // nothing is fetched twice
    await stream.load(['0:30'])
    expect(requests).toHaveLength(1)
  })

  it('hands back the whole file when the server ignores the range', async () => {
    const bytes = font()
    const stream = streamOf(bytes, server(bytes, { ranges: false }).fetcher)
    const whole = await stream.load(['0:0'])
    expect(whole?.length).toBe(bytes.length)
    expect(stream.isBuilt('0:0')).toBe(false)
  })

  it('works through urgent asks before the background fill', async () => {
    const bytes = font()
    const { fetcher } = server(bytes)
    const stream = streamOf(bytes, fetcher)
    const load = vi.spyOn(stream, 'load')
    stream.firstBatchDone = true
    stream.requestRest()
    stream.urgent.add('0:40')
    stream.request(['0:40'])
    await stream.run(async () => {})
    expect(load.mock.calls[0][0]).toEqual(['0:40'])
    expect(load.mock.calls[0][1]).toEqual({ low: false })
    // the shared sample completed every preset: the background fill had nothing left
    expect(load).toHaveBeenCalledTimes(1)
    expect(stream.isBuilt('0:0')).toBe(true)
  })
})

describe('streamSoundFont', () => {
  beforeEach(() => {
    Song.initEmptySong()
    synth.bankSet = []
    synth.onMissingPreset = null
    Object.assign(soundFontState, { status: 'idle', streaming: false, loadedPresets: {} })
  })

  it('loads the preset data and the song’s presets, then marks the SoundFont ready', async () => {
    const bytes = font()
    const { fetcher, requests } = server(bytes)
    await streamSoundFont(manifestOf(bytes), './audio/', fetcher)
    const manifest = manifestOf(bytes)
    expect(requests[0]).toEqual([manifest.pdta[0], manifest.pdta[0] + manifest.pdta[1]])
    expect(soundFontState.status).toBe('ready')
    expect(soundFontState.streaming).toBe(true)
    expect(synth.bankSet[0][25][69]?.sample.length).toBe(100)
    expect(isPresetLoading('0:25')).toBe(false)
    await expect(whenPresetsLoaded(['0:25', '128:0'])).resolves.toBeUndefined()
  })

  it('treats presets the font lacks as loaded (nothing to wait for)', async () => {
    const bytes = font()
    await streamSoundFont(manifestOf(bytes), './audio/', server(bytes).fetcher)
    expect(isPresetLoading('5:3')).toBe(true) // not asked for: unknown to the stream
    expect(synth.onMissingPreset?.(5, 3)).toBe(false)
  })

  it('rejects with the whole file when the server has no range requests', async () => {
    const bytes = font()
    await expect(
      streamSoundFont(manifestOf(bytes), './audio/', server(bytes, { ranges: false }).fetcher),
    ).rejects.toBeInstanceOf(WholeFileError)
  })
})
