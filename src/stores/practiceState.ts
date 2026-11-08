import { reactive, watch } from 'vue'

/**
 * Practice transport settings: playback speed (independent of the score tempo),
 * metronome, count-in and speed trainer. Persisted per browser.
 */
export interface PracticeSettings {
  /** Multiplier on the score tempo used for playback only (1 = as written). */
  playbackRate: number
  metronome: boolean
  countIn: boolean
  /** Speed trainer: raise the speed after every pass through the loop selection. */
  trainer: boolean
  /** Speed added per loop pass (0.05 = 5 % of the written tempo). */
  trainerStep: number
  /** Speed at which the trainer stops increasing. */
  trainerTarget: number
  /** Speed a section loop starts at with the trainer on, the first time (Big win 28). */
  trainerStart: number
  /** A big beat counter while playing and during the count-in, readable from the instrument. */
  bigBeat: boolean
}

export const PLAYBACK_RATE_MIN = 0.25
export const PLAYBACK_RATE_MAX = 1.5

const STORAGE_KEY = 'guitartab:practice'

const DEFAULTS: PracticeSettings = {
  playbackRate: 1,
  metronome: false,
  countIn: false,
  trainer: false,
  trainerStep: 0.05,
  trainerTarget: 1,
  trainerStart: 0.7,
  bigBeat: false,
}

export function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return 1
  }
  return Math.min(PLAYBACK_RATE_MAX, Math.max(PLAYBACK_RATE_MIN, Math.round(rate * 100) / 100))
}

function readStored(): PracticeSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PracticeSettings> | null
    if (!stored || typeof stored !== 'object') {
      return { ...DEFAULTS }
    }
    return {
      playbackRate: clampPlaybackRate(Number(stored.playbackRate ?? DEFAULTS.playbackRate)),
      metronome: stored.metronome === true,
      countIn: stored.countIn === true,
      trainer: stored.trainer === true,
      trainerStep: Number(stored.trainerStep) > 0 ? Number(stored.trainerStep) : DEFAULTS.trainerStep,
      trainerTarget: clampPlaybackRate(Number(stored.trainerTarget ?? DEFAULTS.trainerTarget)),
      trainerStart: clampPlaybackRate(Number(stored.trainerStart ?? DEFAULTS.trainerStart)),
      bigBeat: stored.bigBeat === true,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export const practiceState = reactive<PracticeSettings>(
  typeof localStorage === 'undefined' ? { ...DEFAULTS } : readStored(),
)

watch(
  practiceState,
  (settings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Storage unavailable: settings last for this session only.
    }
  },
  { deep: true },
)

export function setPlaybackRate(rate: number): void {
  practiceState.playbackRate = clampPlaybackRate(rate)
}

/** Current speed factor for playback timing. */
export function getPlaybackRate(): number {
  return practiceState.playbackRate
}
