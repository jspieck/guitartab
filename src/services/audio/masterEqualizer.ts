import { ref } from 'vue'
import type { EqBand } from '../../types/song'

export type { EqBand }

export const EQ_BAND_COLORS = ['#ff8a65', '#ffd54f', '#4dd0e1', '#b388ff']
export const EQ_MIN_FREQ = 20
export const EQ_MAX_FREQ = 20000
export const EQ_MAX_GAIN = 18
export const EQ_Q_RANGE = { min: 0.1, max: 18 }

const STORAGE_KEY = 'gt.equalizer.v1'

/** Filter types whose `gain` parameter has an audible effect. */
export function eqTypeUsesGain(type: BiquadFilterType): boolean {
  return type === 'peaking' || type === 'lowshelf' || type === 'highshelf'
}

export function createDefaultEqBands(): EqBand[] {
  return [
    { type: 'lowshelf', frequency: 100, gain: 0, q: 0.71, enabled: true },
    { type: 'peaking', frequency: 500, gain: 0, q: 1, enabled: true },
    { type: 'peaking', frequency: 2500, gain: 0, q: 1, enabled: true },
    { type: 'highshelf', frequency: 8000, gain: 0, q: 0.71, enabled: true },
  ]
}

const FILTER_TYPES = new Set<string>([
  'peaking',
  'lowshelf',
  'highshelf',
  'highpass',
  'lowpass',
  'bandpass',
  'notch',
])

/** A band with its values inside the panel's ranges. */
export function clampEqBand(band: EqBand): EqBand {
  const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)
  return {
    type: FILTER_TYPES.has(band.type) ? band.type : 'peaking',
    frequency: Math.min(EQ_MAX_FREQ, Math.max(EQ_MIN_FREQ, finite(band.frequency, 1000))),
    gain: Math.min(EQ_MAX_GAIN, Math.max(-EQ_MAX_GAIN, finite(band.gain, 0))),
    q: Math.min(EQ_Q_RANGE.max, Math.max(EQ_Q_RANGE.min, finite(band.q, 1))),
    enabled: band.enabled !== false,
  }
}

/** Four valid bands from stored data (a .gt file, localStorage), or null when they don't fit. */
export function sanitizeEqBands(raw: unknown): EqBand[] | null {
  if (!Array.isArray(raw) || raw.length !== EQ_BAND_COLORS.length) return null
  const defaults = createDefaultEqBands()
  return raw.map((band, index) => clampEqBand({ ...defaults[index], ...(band as Partial<EqBand>) }))
}

/** True when the bands leave the sound as it is (every band off or a shelf/bell at 0 dB). */
export function eqBandsFlat(bands: readonly EqBand[]): boolean {
  return bands.every((band) => !band.enabled || (eqTypeUsesGain(band.type) && Math.abs(band.gain) < 0.05))
}

function loadStoredBands(): EqBand[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw == null) return createDefaultEqBands()
    const parsed = JSON.parse(raw) as EqBand[]
    if (!Array.isArray(parsed) || parsed.length !== EQ_BAND_COLORS.length) return createDefaultEqBands()
    return parsed.map((band, index) => ({ ...createDefaultEqBands()[index], ...band }))
  } catch {
    return createDefaultEqBands()
  }
}

/** Sets a filter node to a band (master, channel and preview nodes alike). */
export function applyEqBand(node: BiquadFilterNode, band: EqBand): void {
  // A disabled band becomes an all-pass: flat magnitude, no rewiring needed.
  node.type = band.enabled ? band.type : 'allpass'
  node.frequency.value = band.frequency
  node.gain.value = band.enabled ? band.gain : 0
  node.Q.value = band.q
}

/**
 * The master equalizer: four filter bands between the master gain and the limiter
 * (`audioGraph.createBusses()`), edited in the Equalizer panel and kept in localStorage.
 */
export class MasterEqualizer {
  public readonly bands = ref<EqBand[]>(loadStoredBands())

  public equalizerNodes: BiquadFilterNode[] = []

  /** Gets the master spectrum every frame while the song plays (the open Equalizer panel). */
  public spectrumListener: ((frequencyData: Uint8Array) => void) | null = null

  private audioCtx: AudioContext | null = null
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  get sampleRate(): number {
    return this.audioCtx?.sampleRate ?? 44100
  }

  /** Creates the filter chain for `audioCtx` (once per context). */
  setAudioContext(audioCtx: AudioContext): void {
    if (this.equalizerNodes.length > 0 && this.audioCtx === audioCtx) {
      return
    }
    this.audioCtx = audioCtx
    this.equalizerNodes = this.bands.value.map(() => audioCtx.createBiquadFilter())
    this.bands.value.forEach((_, index) => this.applyBand(index))
  }

  /** A copy of the filter chain with the current settings, for another context (an audio render). */
  public createFilters(context: BaseAudioContext): BiquadFilterNode[] {
    return this.bands.value.map((band) => {
      const node = context.createBiquadFilter()
      applyEqBand(node, band)
      return node
    })
  }

  public insertBetween(audioNodeBefore: AudioNode, audioNodeAfter: AudioNode): void {
    let previous = audioNodeBefore
    for (const node of this.equalizerNodes) {
      previous.connect(node)
      previous = node
    }
    previous.connect(audioNodeAfter)
  }

  public setBand(index: number, patch: Partial<EqBand>): void {
    const band = this.bands.value[index]
    if (band == null) return
    Object.assign(band, clampEqBand({ ...band, ...patch }))
    this.applyBand(index)
    this.schedulePersist()
  }

  public resetBands(): void {
    createDefaultEqBands().forEach((band, index) => this.setBand(index, band))
  }

  public isFlat(): boolean {
    return eqBandsFlat(this.bands.value)
  }

  private applyBand(index: number): void {
    const node = this.equalizerNodes[index]
    const band = this.bands.value[index]
    if (node == null || band == null) return
    applyEqBand(node, band)
  }

  private schedulePersist(): void {
    if (this.persistTimer != null) clearTimeout(this.persistTimer)
    this.persistTimer = globalThis.setTimeout(() => {
      this.persistTimer = null
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.bands.value))
      } catch {
        // Storage full or blocked: the EQ still works for this session.
      }
    }, 300)
  }
}

export const masterEqualizer = new MasterEqualizer()
