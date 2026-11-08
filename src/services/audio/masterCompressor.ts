import { reactive, ref } from 'vue'
import type { CompressorSettings } from '../../types/song'

export type { CompressorSettings }

export interface CompressorPreset {
  name: string
  settings: CompressorSettings
}

// The first preset matches what audioGraph.createBusses() always used: a
// safety limiter that only catches peaks.
export const COMPRESSOR_PRESETS: CompressorPreset[] = [
  { name: 'Safety limiter', settings: { threshold: -1, knee: 0, ratio: 20, attack: 5, release: 50 } },
  { name: 'Gentle glue', settings: { threshold: -18, knee: 6, ratio: 2, attack: 30, release: 200 } },
  { name: 'Punchy', settings: { threshold: -14, knee: 3, ratio: 4, attack: 12, release: 120 } },
  { name: 'Heavy squash', settings: { threshold: -30, knee: 10, ratio: 12, attack: 3, release: 80 } },
]

// Ranges accepted by DynamicsCompressorNode.
export const COMPRESSOR_RANGES = {
  threshold: { min: -60, max: 0 },
  knee: { min: 0, max: 40 },
  ratio: { min: 1, max: 20 },
  attack: { min: 0.1, max: 1000 },
  release: { min: 10, max: 1000 },
} as const

const STORAGE_KEY = 'gt.compressor.v1'

/** Static output level (dB) for a given input level, matching the node's soft-knee curve. */
export function compressorCurve(inputDb: number, settings: CompressorSettings): number {
  const { threshold, knee, ratio } = settings
  const slope = 1 / ratio - 1
  if (knee > 0 && inputDb > threshold - knee / 2 && inputDb < threshold + knee / 2) {
    const over = inputDb - threshold + knee / 2
    return inputDb + (slope * over * over) / (2 * knee)
  }
  if (inputDb <= threshold) return inputDb
  return threshold + (inputDb - threshold) / ratio
}

/** The settings inside the node's ranges (non-numbers become the first preset's). */
export function clampCompressorSettings(settings: CompressorSettings): CompressorSettings {
  const clamped = {
    threshold: settings.threshold,
    knee: settings.knee,
    ratio: settings.ratio,
    attack: settings.attack,
    release: settings.release,
  }
  ;(Object.keys(COMPRESSOR_RANGES) as (keyof CompressorSettings)[]).forEach((key) => {
    const range = COMPRESSOR_RANGES[key]
    const value = Number(clamped[key])
    clamped[key] = Number.isFinite(value)
      ? Math.min(range.max, Math.max(range.min, value))
      : COMPRESSOR_PRESETS[0].settings[key]
  })
  return clamped
}

function loadStored(): { settings: CompressorSettings; bypass: boolean } {
  const fallback = { settings: { ...COMPRESSOR_PRESETS[0].settings }, bypass: false }
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw == null) return fallback
    const parsed = JSON.parse(raw) as { settings?: Partial<CompressorSettings>; bypass?: boolean }
    return {
      settings: clampCompressorSettings({ ...fallback.settings, ...parsed.settings }),
      bypass: parsed.bypass === true,
    }
  } catch {
    return fallback
  }
}

/** The preset whose values the settings match, or '' (custom). */
export function matchingCompressorPreset(settings: CompressorSettings): string {
  const match = COMPRESSOR_PRESETS.find((preset) =>
    (Object.keys(preset.settings) as (keyof CompressorSettings)[]).every(
      (key) => Math.abs(preset.settings[key] - settings[key]) < 0.05,
    ),
  )
  return match?.name ?? ''
}

/**
 * Sets a compressor node (master, channel, audio render). Plain assignment, not automation, so
 * the values also stick while the context is still suspended, before the first user gesture.
 * Bypass = unity ratio at 0 dB threshold, so the node passes audio untouched.
 */
export function applyCompressor(node: DynamicsCompressorNode, s: CompressorSettings, bypass: boolean): void {
  node.threshold.value = bypass ? 0 : s.threshold
  node.ratio.value = bypass ? 1 : s.ratio
  node.knee.value = s.knee
  node.attack.value = s.attack / 1000
  node.release.value = s.release / 1000
}

/** A compressor node's current gain reduction in dB (0 or negative). */
export function compressorReduction(node: DynamicsCompressorNode | null): number {
  if (node == null) return 0
  const value = node.reduction as unknown
  // Old Chrome exposed `reduction` as an AudioParam.
  return typeof value === 'number' ? value : ((value as AudioParam | null)?.value ?? 0)
}

/**
 * The master compressor/limiter's user settings (Compressor panel), kept in localStorage and
 * applied to the node `audioGraph.createBusses()` attaches.
 */
export class MasterCompressor {
  public readonly settings: CompressorSettings
  public readonly bypass = ref(false)
  private node: DynamicsCompressorNode | null = null
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    const stored = loadStored()
    this.settings = reactive(stored.settings)
    this.bypass.value = stored.bypass
  }

  /** Called by the audio engine once the master compressor exists. */
  public attach(node: DynamicsCompressorNode): void {
    this.node = node
    this.apply()
  }

  public update(patch: Partial<CompressorSettings>): void {
    Object.assign(this.settings, clampCompressorSettings({ ...this.settings, ...patch }))
    this.apply()
    this.schedulePersist()
  }

  public setBypass(bypass: boolean): void {
    this.bypass.value = bypass
    this.apply()
    this.schedulePersist()
  }

  /** Current gain reduction in dB (0 or negative). */
  public reduction(): number {
    return this.bypass.value ? 0 : compressorReduction(this.node)
  }

  public matchingPreset(): string {
    return matchingCompressorPreset(this.settings)
  }

  /** Sets the current settings on another node (an audio render's), without attaching it. */
  public applyTo(node: DynamicsCompressorNode): void {
    this.applyOn(node)
  }

  private apply(): void {
    if (this.node != null) this.applyOn(this.node)
  }

  private applyOn(node: DynamicsCompressorNode): void {
    applyCompressor(node, this.settings, this.bypass.value)
  }

  private schedulePersist(): void {
    if (this.persistTimer != null) clearTimeout(this.persistTimer)
    this.persistTimer = globalThis.setTimeout(() => {
      this.persistTimer = null
      try {
        globalThis.localStorage?.setItem(
          STORAGE_KEY,
          JSON.stringify({ settings: this.settings, bypass: this.bypass.value }),
        )
      } catch {
        // Storage blocked: settings still apply for this session.
      }
    }, 300)
  }
}

export const masterCompressor = new MasterCompressor()
