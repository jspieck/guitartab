import { reactive, watch } from 'vue'

/**
 * The fretboard or keyboard docked under the tab (Big win 28): which one, and how many of
 * the next beats it shows ahead of the current one. Persisted per browser.
 */
export type DockInstrument = 'off' | 'guitar' | 'piano'

export interface PracticeDockSettings {
  instrument: DockInstrument
  /** next beats drawn as fading marks (0–2) */
  ahead: number
}

const STORAGE_KEY = 'guitartab:practiceDock'
const DEFAULTS: PracticeDockSettings = { instrument: 'off', ahead: 2 }

function readStored(): PracticeDockSettings {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<PracticeDockSettings> | null
    if (!stored || typeof stored !== 'object') return { ...DEFAULTS }
    const instrument =
      stored.instrument === 'guitar' || stored.instrument === 'piano' ? stored.instrument : 'off'
    const ahead = Math.min(2, Math.max(0, Math.round(Number(stored.ahead ?? DEFAULTS.ahead)) || 0))
    return { instrument, ahead }
  } catch {
    return { ...DEFAULTS }
  }
}

export const practiceDockState = reactive<PracticeDockSettings>(
  typeof localStorage === 'undefined' ? { ...DEFAULTS } : readStored(),
)

watch(
  practiceDockState,
  (settings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // storage unavailable: the choice lasts for this session
    }
  },
  { deep: true },
)

export function setDockInstrument(instrument: DockInstrument): void {
  practiceDockState.instrument = instrument
}
