/**
 * Typed application settings with JSON localStorage persistence.
 */

export interface AppSettings {
  darkMode: boolean
  vexFlowIsActive: boolean
  currentZoom: number
  pageMode: boolean
  masterVolume: number
  scrollingEnabled: boolean
  sequencerTrackColor: boolean
  /** Runtime only — not persisted */
  songPlaying: boolean
  EPSILON: number
  OVERBAR_ROW_HEIGHT: number
}

type PersistedSettingKey = Exclude<keyof AppSettings, 'songPlaying' | 'EPSILON' | 'OVERBAR_ROW_HEIGHT'>

const DEFAULTS: AppSettings = {
  darkMode: false,
  vexFlowIsActive: false,
  currentZoom: 1.0,
  pageMode: true,
  masterVolume: 0.8,
  scrollingEnabled: true,
  sequencerTrackColor: false,
  songPlaying: false,
  EPSILON: 0.001,
  OVERBAR_ROW_HEIGHT: 25,
}

const STORAGE_PREFIX = 'guitartab_'

const PERSISTED_KEYS: PersistedSettingKey[] = [
  'darkMode',
  'vexFlowIsActive',
  'currentZoom',
  'pageMode',
  'masterVolume',
  'scrollingEnabled',
  'sequencerTrackColor',
]

function storageKey(key: PersistedSettingKey): string {
  return `${STORAGE_PREFIX}${key}`
}

function readPersisted<K extends PersistedSettingKey>(key: K): AppSettings[K] {
  try {
    const stored = localStorage.getItem(storageKey(key))
    if (stored === null) {
      return DEFAULTS[key]
    }
    return JSON.parse(stored) as AppSettings[K]
  } catch {
    return DEFAULTS[key]
  }
}

function writePersisted<K extends PersistedSettingKey>(key: K, value: AppSettings[K]): void {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value))
  } catch {
    // ignore quota / private mode failures
  }
}

class AppSettingsStore implements AppSettings {
  darkMode = DEFAULTS.darkMode
  vexFlowIsActive = DEFAULTS.vexFlowIsActive
  currentZoom = DEFAULTS.currentZoom
  pageMode = DEFAULTS.pageMode
  masterVolume = DEFAULTS.masterVolume
  scrollingEnabled = DEFAULTS.scrollingEnabled
  sequencerTrackColor = DEFAULTS.sequencerTrackColor
  songPlaying = DEFAULTS.songPlaying
  EPSILON = DEFAULTS.EPSILON
  OVERBAR_ROW_HEIGHT = DEFAULTS.OVERBAR_ROW_HEIGHT

  constructor() {
    for (const key of PERSISTED_KEYS) {
      Object.assign(this, { [key]: readPersisted(key) })
    }
  }

  persist<K extends PersistedSettingKey>(key: K): void {
    writePersisted(key, this[key])
  }
}

const appSettings = new AppSettingsStore()

const settingsProxy = new Proxy(appSettings, {
  set(target, property, value, receiver) {
    const result = Reflect.set(target, property, value, receiver)
    if (typeof property === 'string' && (PERSISTED_KEYS as string[]).includes(property)) {
      writePersisted(property as PersistedSettingKey, value as AppSettings[PersistedSettingKey])
    }
    return result
  },
}) as AppSettingsStore

export default settingsProxy
