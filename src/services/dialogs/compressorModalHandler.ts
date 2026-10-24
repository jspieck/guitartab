import { BaseModalHandler } from './baseModalHandler'
import { reactive, ref } from 'vue'

export interface CompressorSettings {
  threshold: number // dB
  knee: number // dB
  ratio: number
  attack: number // ms
  release: number // ms
}

export interface CompressorPreset {
  name: string
  settings: CompressorSettings
}

// The first preset matches what audioEngine.createBusses() always used: a
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

function clampSettings(settings: CompressorSettings): CompressorSettings {
  const clamped = { ...settings }
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
      settings: clampSettings({ ...fallback.settings, ...parsed.settings }),
      bypass: parsed.bypass === true,
    }
  } catch {
    return fallback
  }
}

export class CompressorModalHandler extends BaseModalHandler {
  public readonly settings: CompressorSettings
  public readonly bypass = ref(false)
  private node: DynamicsCompressorNode | null = null
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    super('compressorModal', 'Compressor')
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
    Object.assign(this.settings, clampSettings({ ...this.settings, ...patch }))
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
    if (this.node == null || this.bypass.value) return 0
    const value = this.node.reduction as unknown
    // Old Chrome exposed `reduction` as an AudioParam.
    return typeof value === 'number' ? value : ((value as AudioParam | null)?.value ?? 0)
  }

  public matchingPreset(): string {
    const match = COMPRESSOR_PRESETS.find((preset) =>
      (Object.keys(preset.settings) as (keyof CompressorSettings)[]).every(
        (key) => Math.abs(preset.settings[key] - this.settings[key]) < 0.05,
      ),
    )
    return match?.name ?? ''
  }

  private apply(): void {
    const node = this.node
    if (node == null) return
    const s = this.settings
    // Plain assignment (not automation) so the values also stick while the
    // context is still suspended, before the first user gesture.
    // Bypass = unity ratio at 0 dB threshold, so the node passes audio untouched.
    node.threshold.value = this.bypass.value ? 0 : s.threshold
    node.ratio.value = this.bypass.value ? 1 : s.ratio
    node.knee.value = s.knee
    node.attack.value = s.attack / 1000
    node.release.value = s.release / 1000
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

  openModal(): void {
    this.showModal()
  }

  protected setupModalContent(): void {
    // The Vue component renders everything.
  }
}
