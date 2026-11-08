// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Audio export (audit Big win 29): the render plan (bars, tempo, loop, count-in, clicks), how
 * the offline render schedules a bar's beats through `notePlayback` (tie chains across bars,
 * loop cuts, mute), and the WAV and Ogg Opus writers.
 */

vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)

type SongType = (typeof import('../src/stores/song'))['default']
type Beat = import('../src/stores/song').Beat
type Note = import('../src/stores/song').Note
type MeasureMeta = import('../src/types/song').MeasureMetaInfo
type Interval = import('../src/types/song').Interval

let Song: SongType
let plan: typeof import('../src/services/audioExport/renderPlan')
let render: typeof import('../src/services/audioExport/audioRender')
let wav: typeof import('../src/services/audioExport/wavFile')
let ogg: typeof import('../src/services/audioExport/oggOpus')

beforeAll(async () => {
  Song = (await import('../src/stores/song')).default
  plan = await import('../src/services/audioExport/renderPlan')
  render = await import('../src/services/audioExport/audioRender')
  wav = await import('../src/services/audioExport/wavFile')
  ogg = await import('../src/services/audioExport/oggOpus')
})

const bar = (extra: Partial<MeasureMeta> = {}) =>
  ({ numerator: 4, denominator: 4, repeatOpen: false, ...extra }) as MeasureMeta

const options = (
  extra: Partial<import('../src/services/audioExport/renderPlan').RenderPlanOptions> = {},
) => ({
  range: 'song' as const,
  loop: null,
  unrollRepeats: true,
  countIn: false,
  playbackRate: 1,
  songBpm: 120,
  ...extra,
})

const loop = (startBlock: number, startRatio: number, endBlock: number, endRatio: number) =>
  ({ trackId: 0, startBlock, startBeat: 0, startRatio, endBlock, endRatio, endBeat: 0 }) as Interval

describe('render plan', () => {
  it('plays repeats out, or every bar once', () => {
    const meta = [bar({ bpm: 120, repeatOpen: true }), bar({ repeatClose: 1 }), bar()]
    const unrolled = plan.buildRenderPlan(meta, options())
    expect(unrolled.bars.map((b) => b.blockId)).toEqual([0, 1, 0, 1, 2])
    expect(unrolled.bars.map((b) => b.start)).toEqual([0, 2, 4, 6, 8])
    expect(unrolled.duration).toBe(10)
    const straight = plan.buildRenderPlan(meta, options({ unrollRepeats: false }))
    expect(straight.bars.map((b) => b.blockId)).toEqual([0, 1, 2])
    expect(straight.duration).toBe(6)
  })

  it('follows tempo changes and the practice speed', () => {
    const meta = [bar({ bpm: 120 }), bar({ bpm: 60 }), bar()]
    const result = plan.buildRenderPlan(meta, options())
    expect(result.bars.map((b) => [b.start, b.bpm])).toEqual([
      [0, 120],
      [2, 60],
      [6, 60],
    ])
    expect(plan.buildRenderPlan(meta, options({ playbackRate: 0.5 })).duration).toBe(20)
    // no tempo in the song: the song's tempo
    expect(plan.buildRenderPlan([bar()], options({ songBpm: 90 })).bars[0].bpm).toBe(90)
  })

  it('renders the loop once, cut at its start and end', () => {
    const meta = [bar({ bpm: 120 }), bar(), bar(), bar()]
    const result = plan.buildRenderPlan(meta, options({ range: 'loop', loop: loop(1, 0.25, 2, 0.5) }))
    expect(result.bars.map(({ blockId, from, to, start }) => ({ blockId, from, to, start }))).toEqual([
      { blockId: 1, from: 0.25, to: 1, start: 0 },
      { blockId: 2, from: 0, to: 0.5, start: 1.5 },
    ])
    expect(result.duration).toBe(2.5)
    // the loop's clicks: no accent on beat 2, the next bar starts with one
    expect(plan.plannedClicks(meta, result)).toEqual([
      { time: 0, accent: false },
      { time: 0.5, accent: false },
      { time: 1, accent: false },
      { time: 1.5, accent: true },
      { time: 2, accent: false },
    ])
  })

  it('puts a count-in bar before the first note', () => {
    const result = plan.buildRenderPlan([bar({ bpm: 120, numerator: 3 })], options({ countIn: true }))
    expect(result.countInClicks).toEqual([
      { time: 0, accent: true },
      { time: 0.5, accent: false },
      { time: 1, accent: false },
    ])
    expect(result.bars[0].start).toBe(1.5)
    expect(result.duration).toBe(3)
  })

  it('formats lengths', () => {
    expect(plan.formatDuration(187.4)).toBe('3:07')
    expect(plan.formatDuration(5)).toBe('0:05')
  })
})

describe('render scheduling', () => {
  const log: string[] = []
  const player = {
    beatStart: null as number | null,
    effectBpm: null as number | null,
    playFret: (...a: unknown[]) => {
      const [track, , string, fret, , start, duration] = a as number[]
      log.push(`t${track} s${string} f${fret} at=${start} dur=${duration}`)
      return null
    },
    playPitch: () => null,
  } as unknown as import('../src/services/audio/samplePlayer').SamplePlayer

  const note = (fret: number, extra: Partial<Note> = {}): Note => ({ ...Song.defaultNote(), fret, ...extra })
  function beat(duration: string, notes: Record<number, Note> = {}): Beat {
    const b = { ...Song.defaultMeasure(), duration: duration as never, notes: [] as (Note | null)[] }
    for (const [string, n] of Object.entries(notes)) b.notes[Number(string)] = n
    return b
  }

  function setSong(bars: Beat[][], meta: Partial<MeasureMeta>[] = []): void {
    Song.measureMeta = bars.map((_, index) => ({
      ...Song.measureMeta[0],
      bpm: undefined,
      ...bar(index === 0 ? { bpm: 120 } : {}),
      ...meta[index],
    }))
    Song.measures = [bars.map((beats) => [beats, [beat('wr')]])]
    Song.playBackInstrument[0] = { ...Song.playBackInstrument[0], volume: 100, mute: false, solo: false }
    Song.setTempo(120)
  }

  function renderAll(result: import('../src/services/audioExport/renderPlan').RenderPlan): string[] {
    log.length = 0
    result.bars.forEach((_, index) => render.scheduleBar(result, index, player))
    return [...log]
  }

  beforeEach(() => {
    Song.initEmptySong()
  })

  it('ties a note on over any number of beats and bars', () => {
    // a whole note tied over the next bar's half: 2 s + 1 s; the half after it plays alone
    setSong([
      [beat('w', { 0: note(5) })],
      [beat('h', { 0: note(5, { tied: true }) }), beat('h', { 0: note(7) })],
    ])
    expect(renderAll(plan.buildRenderPlan(Song.measureMeta, options()))).toEqual([
      't0 s0 f5 at=0 dur=3',
      't0 s0 f7 at=3 dur=1',
    ])
  })

  it('follows ties through a repeat as it is played', () => {
    // bar 1 ends tied; its next played bar is bar 0 again (no tie there), then bar 2 (tied)
    setSong(
      [[beat('w', { 0: note(1) })], [beat('w', { 0: note(3) })], [beat('w', { 0: note(3, { tied: true }) })]],
      [{ repeatOpen: true }, { repeatClose: 1 }],
    )
    expect(renderAll(plan.buildRenderPlan(Song.measureMeta, options()))).toEqual([
      't0 s0 f1 at=0 dur=2',
      't0 s0 f3 at=2 dur=2',
      't0 s0 f1 at=4 dur=2',
      't0 s0 f3 at=6 dur=4',
    ])
  })

  it('plays only the loop, from its start', () => {
    setSong([[0, 1, 2, 3].map((fret) => beat('q', { 0: note(fret) }))])
    const result = plan.buildRenderPlan(
      Song.measureMeta,
      options({ range: 'loop', loop: loop(0, 0.25, 0, 0.75) }),
    )
    expect(renderAll(result)).toEqual(['t0 s0 f1 at=0 dur=0.5', 't0 s0 f2 at=0.5 dur=0.5'])
  })

  it('leaves muted tracks out', () => {
    setSong([[beat('w', { 0: note(5) })]])
    Song.playBackInstrument[0].mute = true
    expect(renderAll(plan.buildRenderPlan(Song.measureMeta, options()))).toEqual([])
  })

  it('gives trills and vibrato the bar tempo at the chosen speed', () => {
    setSong([[beat('w', { 0: note(5) })]], [{ bpm: 100 }])
    render.scheduleBar(plan.buildRenderPlan(Song.measureMeta, options({ playbackRate: 0.5 })), 0, player)
    expect(player.effectBpm).toBeCloseTo(50)
  })
})

describe('WAV file', () => {
  it('writes a 16-bit stereo RIFF file', () => {
    const left = new Float32Array([0, 1, -1, 0.5])
    const right = new Float32Array([0, -0.5, 2, Number.NaN])
    const bytes = wav.encodeWav([left, right], 44100)
    const view = new DataView(bytes.buffer)
    const text = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
    expect([text(0), text(8), text(12), text(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data'])
    expect(view.getUint32(4, true)).toBe(bytes.length - 8)
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint32(28, true)).toBe(44100 * 4)
    expect(view.getUint32(40, true)).toBe(16)
    const samples = Array.from({ length: 8 }, (_, i) => view.getInt16(44 + i * 2, true))
    // interleaved, clamped, NaN as silence
    expect(samples).toEqual([0, 0, 32767, -16384, -32768, 32767, 16384, 0])
  })

  it('finds where the sound ends', () => {
    const data = new Float32Array(1000)
    data[400] = 0.2
    expect(wav.audibleLength([data, new Float32Array(1000)], 100, 10)).toBe(411)
    expect(wav.audibleLength([data], 600, 10)).toBe(600)
    expect(wav.audibleLength([data], 0, 5000)).toBe(1000)
  })
})

describe('Ogg Opus file', () => {
  interface Page {
    flags: number
    granule: bigint
    sequence: number
    crcOk: boolean
    packets: Uint8Array[]
  }

  function readPages(bytes: Uint8Array): Page[] {
    const pages: Page[] = []
    let offset = 0
    while (offset < bytes.length) {
      expect(String.fromCharCode(...bytes.subarray(offset, offset + 4))).toBe('OggS')
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset)
      const segments = bytes[offset + 26]
      const lacing = [...bytes.subarray(offset + 27, offset + 27 + segments)]
      const length = 27 + segments + lacing.reduce((a, b) => a + b, 0)
      const copy = bytes.slice(offset, offset + length)
      copy.fill(0, 22, 26)
      const packets: Uint8Array[] = []
      let start = offset + 27 + segments
      let size = 0
      for (const value of lacing) {
        size += value
        if (value < 255) {
          packets.push(bytes.subarray(start, start + size))
          start += size
          size = 0
        }
      }
      pages.push({
        flags: bytes[offset + 5],
        granule: view.getBigUint64(6, true),
        sequence: view.getUint32(18, true),
        crcOk: ogg.oggCrc(copy) === view.getUint32(22, true),
        packets,
      })
      offset += length
    }
    return pages
  }

  it('computes the Ogg CRC', () => {
    // CRC-32 with polynomial 0x04c11db7, no reflection, init 0, no final XOR: check value of "123456789"
    expect(ogg.oggCrc(new TextEncoder().encode('123456789'))).toBe(0x89a1897f)
  })

  it('writes the headers, packets in pages and the end position', () => {
    const packets = Array.from({ length: 120 }, (_, i) => ({
      data: new Uint8Array(i === 3 ? 255 : i === 4 ? 600 : 200).fill(i),
      samples: 960,
    }))
    const total = 120 * 960 - 500
    const bytes = ogg.buildOggOpus({ channels: 2, preSkip: 312, inputSampleRate: 48000 }, packets, total, {
      comments: ['TITLE=Song'],
    })
    const pages = readPages(bytes)
    expect(pages.every((page) => page.crcOk)).toBe(true)
    expect(pages.map((page) => page.sequence)).toEqual(pages.map((_, i) => i))
    expect(pages[0].flags).toBe(2)
    expect(String.fromCharCode(...pages[0].packets[0].subarray(0, 8))).toBe('OpusHead')
    expect(pages[0].packets[0][9]).toBe(2)
    expect(pages[0].packets[0][10] | (pages[0].packets[0][11] << 8)).toBe(312)
    const tags = new TextDecoder().decode(pages[1].packets[0])
    expect(tags.startsWith('OpusTags')).toBe(true)
    expect(tags).toContain('TITLE=Song')
    const audio = pages.slice(2)
    // every packet comes back whole and in order (the 255-byte one gets a 0 lacing value)
    expect(audio.flatMap((page) => page.packets).map((packet) => packet.length)).toEqual(
      packets.map((packet) => packet.data.length),
    )
    // about a second per page; granules grow; the last one is the real end
    expect(audio.length).toBe(3)
    expect(audio[0].granule).toBe(BigInt(312 + 50 * 960))
    expect(audio[audio.length - 1].flags).toBe(4)
    expect(audio[audio.length - 1].granule).toBe(BigInt(312 + total))
  })

  it('reads the pre-skip from an OpusHead', () => {
    const head = ogg.opusHead({ channels: 2, preSkip: 3840, inputSampleRate: 48000 })
    expect(ogg.preSkipOf(head)).toBe(3840)
    expect(ogg.preSkipOf(new Uint8Array(4))).toBeNull()
    expect(ogg.preSkipOf(null)).toBeNull()
  })
})
