import { watch } from 'vue'
import Song from '../../../stores/song'
import {
  markPresetLoaded,
  setSoundFontDecoding,
  setSoundFontLoading,
  setSoundFontSettled,
  soundFontState,
} from '../../../stores/soundFontState'
import { markStartupStepDone } from '../../../utils/startupReadiness'
import { trackPresetKey } from '../samplePlayer'
import { bankStructure, buildPresetKeys, presetSampleIds, type BankStructure } from './banks'
import { parsePresetData, setSampleBytes, type SoundFontData } from './parser'
import { decodeCompressedSamples } from './sf3'
import { synth, type Banks } from './synth'

/**
 * Streams the SoundFont (Big win 32): the preset data first (one range request, ~220 KB),
 * then the samples of the presets the song's tracks use, then, when the browser is idle,
 * the rest preset by preset. Each preset joins `synth.bankSet` once all its samples are in,
 * so playback starts with what is there and the sequencer shows "Loading sound" on the
 * tracks still waiting. Apache (and Vite's dev server) answer range requests for static
 * files; a server that sends the whole file instead gets it loaded whole.
 */

/** `public/audio/manifest.json`, written by `scripts/soundfont-file.mjs`, read at build time. */
export interface SoundFontManifest {
  /** file name in the audio folder, with its content hash */
  soundFont: string
  bytes: number
  sha256: string
  /** the pdta LIST chunk incl. its header: [first byte, byte count] */
  pdta: [number, number]
  /** where the sample data starts */
  smpl: number
}

/** Ranges closer than this are fetched as one (fewer requests for a few unused bytes). */
const MERGE_GAP = 32 * 1024
/** Requests in flight at once. */
const PARALLEL_FETCHES = 4
/** Background pieces: about this much sample data per step. */
const BACKGROUND_PIECE = 512 * 1024

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>

interface LoadOptions {
  /** bytes fetched of this load's total */
  onDownload?: (loaded: number, total: number) => void
  /** SF3 streams decoded */
  onDecode?: (done: number, total: number) => void
  /** background: the browser may fetch it after everything else */
  low?: boolean
}

/** What a range fetch gave: the bytes, or the whole file when the server ignored the range. */
interface RangeResult {
  kind: 'range' | 'whole'
  bytes: Uint8Array
}

async function fetchRange(
  fetcher: Fetcher,
  url: string,
  first: number,
  end: number,
  low = false,
): Promise<RangeResult> {
  const response = await fetcher(url, {
    headers: { Range: `bytes=${first}-${end - 1}` },
    ...(low ? { priority: 'low' } : {}),
  } as RequestInit)
  if (!response.ok) throw new Error(`SoundFont: ${response.status} for ${url}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (response.status === 206) {
    if (bytes.length !== end - first)
      throw new Error(`SoundFont: range ${first}-${end} gave ${bytes.length} bytes`)
    return { kind: 'range', bytes }
  }
  return { kind: 'whole', bytes }
}

/** Byte ranges of the samples, sorted and merged when they (nearly) touch. */
export function mergedRanges(
  data: SoundFontData,
  sampleIds: number[],
  gap = MERGE_GAP,
): { first: number; end: number; ids: number[] }[] {
  const sorted = sampleIds
    .filter((id) => data.sampleRanges[id] && data.sampleRanges[id][1] > data.sampleRanges[id][0])
    .sort((a, b) => data.sampleRanges[a][0] - data.sampleRanges[b][0])
  const merged: { first: number; end: number; ids: number[] }[] = []
  for (const id of sorted) {
    const [first, end] = data.sampleRanges[id]
    const last = merged[merged.length - 1]
    if (last && first - last.end <= gap) {
      last.end = Math.max(last.end, end)
      last.ids.push(id)
    } else {
      merged.push({ first, end, ids: [id] })
    }
  }
  return merged
}

/** The SoundFont being streamed: which samples are in, and the queue of what to fetch. */
export class SoundFontStream {
  readonly data: SoundFontData
  readonly structure: BankStructure
  readonly banks: Banks = []
  /** preset index by "bank:preset" */
  private readonly presetIndex = new Map<string, number>()
  private readonly presetSamples: number[][]
  private readonly loadedSamples = new Set<number>()
  private readonly builtPresets = new Set<number>()
  /** preset keys asked for, most urgent first */
  private readonly wanted: string[] = []
  private running: Promise<void> | null = null
  /** set when the first batch (the song's presets) is in */
  firstBatchDone = false

  constructor(
    pdta: Uint8Array,
    private readonly url: string,
    private readonly smplOffset: number,
    private readonly fetcher: Fetcher,
    /** called after each step, with the presets that became playable */
    private readonly onPresetsBuilt: (keys: string[]) => void = () => {},
  ) {
    this.data = parsePresetData(pdta)
    this.structure = bankStructure(this.data)
    this.structure.presets.forEach((preset, index) => {
      // the first wins: the terminal "EOP" record usually says bank 0, preset 0 as well
      const key = `${preset.header.bank}:${preset.header.preset}`
      if (!this.presetIndex.has(key)) this.presetIndex.set(key, index)
    })
    this.presetSamples = this.structure.presets.map((preset) => presetSampleIds(preset, this.structure))
  }

  /** True when the SoundFont has a preset of that key. */
  has(key: string): boolean {
    return this.presetIndex.has(key)
  }

  isBuilt(key: string): boolean {
    const index = this.presetIndex.get(key)
    return index != null && this.builtPresets.has(index)
  }

  /** Asks for presets: the first ones asked are fetched first (an earlier ask moves back). */
  request(keys: string[], urgent = true): void {
    const fresh = keys.filter((key) => this.has(key) && !this.isBuilt(key))
    for (const key of fresh) {
      const at = this.wanted.indexOf(key)
      if (at >= 0) this.wanted.splice(at, 1)
    }
    if (urgent) this.wanted.unshift(...fresh)
    else this.wanted.push(...fresh)
  }

  /** Every preset not asked for yet, in bank/program order (the background fill). */
  requestRest(): void {
    const keys = [...this.presetIndex.keys()].sort((a, b) => {
      const [bankA, presetA] = a.split(':').map(Number)
      const [bankB, presetB] = b.split(':').map(Number)
      return bankA - bankB || presetA - presetB
    })
    this.request(keys, false)
  }

  /** Bytes of sample data still to fetch for these presets. */
  pendingBytes(keys: string[]): number {
    const ids = new Set(
      keys.flatMap((key) => this.samplesOf(key)).filter((id) => !this.loadedSamples.has(id)),
    )
    return [...ids].reduce(
      (sum, id) => sum + this.data.sampleRanges[id][1] - this.data.sampleRanges[id][0],
      0,
    )
  }

  private samplesOf(key: string): number[] {
    const index = this.presetIndex.get(key)
    return index == null ? [] : this.presetSamples[index]
  }

  /** The next step's presets: the first wanted one, plus followers while the piece stays small. */
  private nextStep(urgentOnly: boolean, limit: number): string[] {
    const step: string[] = []
    let bytes = 0
    while (this.wanted.length) {
      const key = this.wanted[0]
      if (this.isBuilt(key)) {
        this.wanted.shift()
        continue
      }
      const size = this.pendingBytes([key])
      if (step.length && (urgentOnly || bytes + size > limit)) break
      step.push(this.wanted.shift()!)
      bytes += size
    }
    return step
  }

  /** Loads run one after another: two decodes at once would take each other's streams. */
  private chain: Promise<unknown> = Promise.resolve()

  /**
   * Fetches and decodes the samples of `keys`, then builds every preset that is complete.
   * Returns the whole file when the server ignored the range (nothing is built then).
   */
  load(keys: string[], options: LoadOptions = {}): Promise<Uint8Array | null> {
    const result = this.chain.then(() => this.loadNow(keys, options))
    this.chain = result.catch(() => {})
    return result
  }

  private async loadNow(
    keys: string[],
    { onDownload, onDecode, low = false }: LoadOptions,
  ): Promise<Uint8Array | null> {
    const ids = [...new Set(keys.flatMap((key) => this.samplesOf(key)))].filter(
      (id) => !this.loadedSamples.has(id),
    )
    const ranges = mergedRanges(this.data, ids)
    const total = ranges.reduce((sum, range) => sum + range.end - range.first, 0)
    let loaded = 0
    onDownload?.(0, total)
    let next = 0
    let whole: Uint8Array | null = null
    const worker = async () => {
      while (next < ranges.length && !whole) {
        const range = ranges[next]
        next += 1
        const result = await fetchRange(
          this.fetcher,
          this.url,
          this.smplOffset + range.first,
          this.smplOffset + range.end,
          low,
        )
        if (result.kind === 'whole') {
          whole = result.bytes
          return
        }
        for (const id of range.ids) {
          const [first, end] = this.data.sampleRanges[id]
          setSampleBytes(this.data, id, result.bytes.subarray(first - range.first, end - range.first))
          this.loadedSamples.add(id)
        }
        loaded += range.end - range.first
        onDownload?.(loaded, total)
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL_FETCHES, ranges.length) }, worker))
    if (whole) return whole
    if (this.data.compressed.some((bytes) => bytes != null)) {
      const failed = await decodeCompressedSamples(this.data, onDecode)
      if (failed.length)
        console.warn(`SoundFont: ${failed.length} samples could not be decoded and stay silent:`, failed)
    }
    this.buildComplete()
    return null
  }

  /** Builds the presets whose samples are all in (and not built yet). */
  private buildComplete(): void {
    const built: string[] = []
    this.structure.presets.forEach((preset, index) => {
      if (
        this.builtPresets.has(index) ||
        this.presetIndex.get(`${preset.header.bank}:${preset.header.preset}`) !== index
      )
        return
      if (!this.presetSamples[index].every((id) => this.loadedSamples.has(id))) return
      const keys = buildPresetKeys(preset, this.structure, this.data)
      this.builtPresets.add(index)
      const key = `${preset.header.bank}:${preset.header.preset}`
      built.push(key)
      if (!keys) return
      this.banks[preset.header.bank] ??= []
      this.banks[preset.header.bank][preset.header.preset] = keys
    })
    if (built.length) this.onPresetsBuilt(built)
  }

  /**
   * Works through the wanted presets: urgent asks one step at a time, the background fill in
   * pieces of ~512 KB with an idle pause between them. Returns when nothing is left.
   */
  run(idle: () => Promise<void> = waitForIdle): Promise<void> {
    this.running ??= (async () => {
      while (this.wanted.length) {
        const background = this.firstBatchDone && !this.wanted.some((key) => this.urgent.has(key))
        if (background) await idle()
        const step = this.nextStep(!background, BACKGROUND_PIECE)
        if (!step.length) continue
        step.forEach((key) => this.urgent.delete(key))
        const whole = await this.load(step, { low: background })
        if (whole) throw new WholeFileError(whole)
      }
    })().finally(() => {
      this.running = null
    })
    return this.running
  }

  /** Keys asked for by the song or a note (not the background fill). */
  readonly urgent = new Set<string>()
}

/** The server sent the whole file instead of a range: load it as one. */
export class WholeFileError extends Error {
  constructor(readonly bytes: Uint8Array) {
    super('the server ignored the range request')
  }
}

function waitForIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 2000 })
    else setTimeout(resolve, 200)
  })
}

/** The presets the song's tracks sound with. */
export function songPresetKeys(): string[] {
  return [...new Set(Song.tracks.map((_, trackId) => trackPresetKey(trackId)))]
}

/** The background fill is skipped when the browser asks to save data. */
function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return connection?.saveData === true
}

/**
 * Streams the SoundFont named by `manifest` from `folder`. Resolves once the song's presets
 * are playable (`data-soundfont-ready`); the rest keeps loading. Rejects when nothing can be
 * read (missing file, no Vorbis decoder): the caller falls back to the whole SF2.
 */
export async function streamSoundFont(
  manifest: SoundFontManifest,
  folder: string,
  fetcher: Fetcher = (url, init) => fetch(url, init),
): Promise<void> {
  const url = `${folder}${manifest.soundFont}`
  setSoundFontLoading(0, 0)
  const [first, count] = manifest.pdta
  const head = await fetchRange(fetcher, url, first, first + count)
  if (head.kind === 'whole') throw new WholeFileError(head.bytes)
  const stream = new SoundFontStream(head.bytes, url, manifest.smpl, fetcher, (keys) => {
    synth.bankSet = stream.banks
    keys.forEach(markPresetLoaded)
  })
  soundFontState.streaming = true

  // keys the font doesn't have can't load: nothing to wait for
  const ask = (keys: string[]) => {
    keys.filter((key) => !stream.has(key)).forEach(markPresetLoaded)
    const missing = keys.filter((key) => stream.has(key) && !stream.isBuilt(key))
    missing.forEach((key) => stream.urgent.add(key))
    stream.request(missing)
    if (missing.length) void stream.run().catch(onStreamError)
  }
  synth.onMissingPreset = (bank, preset) => {
    const key = `${bank}:${preset}`
    if (!stream.has(key)) return false
    if (!stream.isBuilt(key)) ask([key])
    return true
  }

  // the first batch: the song's presets, with the Play buttons' progress
  const firstKeys = songPresetKeys().filter((key) => stream.has(key))
  songPresetKeys()
    .filter((key) => !stream.has(key))
    .forEach(markPresetLoaded)
  const whole = await stream.load(firstKeys, {
    onDownload: setSoundFontLoading,
    onDecode: setSoundFontDecoding,
  })
  if (whole) throw new WholeFileError(whole)
  if (!firstKeys.length) synth.bankSet = stream.banks
  stream.firstBatchDone = true
  document.documentElement.dataset.soundfont = url
  markStartupStepDone('soundfont')
  setSoundFontSettled('ready')

  // later songs, instrument changes, the amp switching samples: their presets first
  watch(songPresetKeys, ask, { immediate: true })
  if (!savesData()) {
    stream.requestRest()
    void stream.run().catch(onStreamError)
  }
}

function onStreamError(error: unknown): void {
  // the first batch arrived, so the file is there: a later failure (offline) only leaves
  // the remaining presets silent until the next visit
  console.warn('SoundFont: a part could not be loaded', error)
}
