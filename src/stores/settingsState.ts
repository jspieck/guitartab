import { reactive, watch } from 'vue'

/**
 * User settings, reactive, persisted to localStorage (`guitartab_<key>`).
 * Read and write it anywhere; Vue code that reads it updates by itself.
 */
export interface AppSettings {
  darkMode: boolean
  vexFlowIsActive: boolean
  currentZoom: number
  pageMode: boolean
  masterVolume: number
  scrollingEnabled: boolean
  sequencerTrackColor: boolean
  /** Runtime only, not persisted. */
  songPlaying: boolean
}

type PersistedSettingKey = Exclude<keyof AppSettings, 'songPlaying'>

const DEFAULTS: AppSettings = {
  darkMode: false,
  vexFlowIsActive: false,
  currentZoom: 1.0,
  pageMode: true,
  masterVolume: 0.8,
  scrollingEnabled: true,
  sequencerTrackColor: false,
  songPlaying: false,
}

const PERSISTED_KEYS: PersistedSettingKey[] = [
  'darkMode',
  'vexFlowIsActive',
  'currentZoom',
  'pageMode',
  'masterVolume',
  'scrollingEnabled',
  'sequencerTrackColor',
]

/** Comparing note positions (in whole notes) with floating-point sums. */
export const EPSILON = 0.001
/** Height of one annotation lane above the tab, in px. */
export const OVERBAR_ROW_HEIGHT = 25

const STORAGE_PREFIX = 'guitartab_'

function readPersisted<K extends PersistedSettingKey>(key: K): AppSettings[K] {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    return stored === null ? DEFAULTS[key] : (JSON.parse(stored) as AppSettings[K])
  } catch {
    return DEFAULTS[key]
  }
}

function writePersisted<K extends PersistedSettingKey>(key: K, value: AppSettings[K]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value))
  } catch {
    // ignore quota / private mode failures
  }
}

function loadSettings(): AppSettings {
  const settings = { ...DEFAULTS }
  for (const key of PERSISTED_KEYS) {
    Object.assign(settings, { [key]: readPersisted(key) })
  }
  return settings
}

export const settingsState = reactive<AppSettings>(loadSettings())

for (const key of PERSISTED_KEYS) {
  // Synchronous, so a write is stored even if the page closes right after.
  watch(
    () => settingsState[key],
    (value) => writePersisted(key, value),
    { flush: 'sync' },
  )
}

export default settingsState
