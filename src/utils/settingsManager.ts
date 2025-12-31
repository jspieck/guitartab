/**
 * Application Settings Manager
 * 
 * Centralized configuration management with localStorage persistence.
 * All settings are type-safe and have default values.
 */

import { ref, watch, readonly } from 'vue'

// =============================================================================
// Types
// =============================================================================

export interface AppSettings {
  // Display
  darkMode: boolean
  currentZoom: number
  pageMode: boolean
  vexFlowIsActive: boolean
  
  // Audio
  masterVolume: number
  metronomeEnabled: boolean
  metronomeVolume: number
  countInEnabled: boolean
  
  // Playback
  songPlaying: boolean
  scrollingEnabled: boolean
  loopEnabled: boolean
  
  // UI
  sequencerTrackColor: boolean
  showMiniMap: boolean
  autoSave: boolean
  
  // Layout
  OVERBAR_ROW_HEIGHT: number
  EPSILON: number
}

// =============================================================================
// Default Settings
// =============================================================================

const DEFAULT_SETTINGS: AppSettings = {
  // Display
  darkMode: false,
  currentZoom: 1.0,
  pageMode: true,
  vexFlowIsActive: false,
  
  // Audio
  masterVolume: 0.8,
  metronomeEnabled: false,
  metronomeVolume: 0.5,
  countInEnabled: false,
  
  // Playback
  songPlaying: false,
  scrollingEnabled: true,
  loopEnabled: false,
  
  // UI
  sequencerTrackColor: false,
  showMiniMap: false,
  autoSave: true,
  
  // Layout
  OVERBAR_ROW_HEIGHT: 25,
  EPSILON: 0.001
}

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_PREFIX = 'guitartab_'

const STORAGE_KEYS: Record<keyof AppSettings, string> = {
  darkMode: `${STORAGE_PREFIX}darkMode`,
  currentZoom: `${STORAGE_PREFIX}zoom`,
  pageMode: `${STORAGE_PREFIX}pageMode`,
  vexFlowIsActive: `${STORAGE_PREFIX}vexFlow`,
  masterVolume: `${STORAGE_PREFIX}masterVolume`,
  metronomeEnabled: `${STORAGE_PREFIX}metronome`,
  metronomeVolume: `${STORAGE_PREFIX}metronomeVolume`,
  countInEnabled: `${STORAGE_PREFIX}countIn`,
  songPlaying: `${STORAGE_PREFIX}songPlaying`,
  scrollingEnabled: `${STORAGE_PREFIX}scrolling`,
  loopEnabled: `${STORAGE_PREFIX}loop`,
  sequencerTrackColor: `${STORAGE_PREFIX}seqTrackColor`,
  showMiniMap: `${STORAGE_PREFIX}miniMap`,
  autoSave: `${STORAGE_PREFIX}autoSave`,
  OVERBAR_ROW_HEIGHT: `${STORAGE_PREFIX}overbarHeight`,
  EPSILON: `${STORAGE_PREFIX}epsilon`
}

// =============================================================================
// Settings Class
// =============================================================================

class SettingsManager {
  private settings: AppSettings
  
  constructor() {
    this.settings = this.loadAll()
  }
  
  /**
   * Load all settings from localStorage, using defaults for missing values
   */
  private loadAll(): AppSettings {
    const loaded: Partial<AppSettings> = {}
    
    for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) {
        try {
          loaded[key as keyof AppSettings] = JSON.parse(stored)
        } catch {
          // If JSON parse fails, use as string for backwards compatibility
          loaded[key as keyof AppSettings] = stored as any
        }
      }
    }
    
    return { ...DEFAULT_SETTINGS, ...loaded }
  }
  
  /**
   * Get a setting value
   */
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key]
  }
  
  /**
   * Set a setting value and persist to localStorage
   */
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value
    localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value))
  }
  
  /**
   * Toggle a boolean setting
   */
  toggle(key: keyof AppSettings): boolean {
    const currentValue = this.settings[key]
    if (typeof currentValue !== 'boolean') {
      console.warn(`Cannot toggle non-boolean setting: ${key}`)
      return false
    }
    const newValue = !currentValue
    this.set(key, newValue as AppSettings[typeof key])
    return newValue
  }
  
  /**
   * Reset a setting to its default value
   */
  reset<K extends keyof AppSettings>(key: K): void {
    this.set(key, DEFAULT_SETTINGS[key])
  }
  
  /**
   * Reset all settings to defaults
   */
  resetAll(): void {
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
      this.reset(key)
    }
  }
  
  /**
   * Remove a setting from localStorage
   */
  remove<K extends keyof AppSettings>(key: K): void {
    localStorage.removeItem(STORAGE_KEYS[key])
    this.settings[key] = DEFAULT_SETTINGS[key]
  }
  
  /**
   * Export all settings as JSON
   */
  export(): string {
    return JSON.stringify(this.settings, null, 2)
  }
  
  /**
   * Import settings from JSON
   */
  import(json: string): boolean {
    try {
      const imported = JSON.parse(json) as Partial<AppSettings>
      for (const [key, value] of Object.entries(imported)) {
        if (key in DEFAULT_SETTINGS) {
          this.set(key as keyof AppSettings, value)
        }
      }
      return true
    } catch {
      console.error('Failed to import settings')
      return false
    }
  }
  
  // =============================================================================
  // Legacy API - for backwards compatibility with existing code
  // =============================================================================
  
  get darkMode(): boolean { return this.get('darkMode') }
  set darkMode(v: boolean) { this.set('darkMode', v) }
  
  get vexFlowIsActive(): boolean { return this.get('vexFlowIsActive') }
  set vexFlowIsActive(v: boolean) { this.set('vexFlowIsActive', v) }
  
  get currentZoom(): number { return this.get('currentZoom') }
  set currentZoom(v: number) { this.set('currentZoom', v) }
  
  get songPlaying(): boolean { return this.get('songPlaying') }
  set songPlaying(v: boolean) { this.set('songPlaying', v) }
  
  get pageMode(): boolean { return this.get('pageMode') }
  set pageMode(v: boolean) { this.set('pageMode', v) }
  
  get masterVolume(): number { return this.get('masterVolume') }
  set masterVolume(v: number) { this.set('masterVolume', v) }
  
  get scrollingEnabled(): boolean { return this.get('scrollingEnabled') }
  set scrollingEnabled(v: boolean) { this.set('scrollingEnabled', v) }
  
  get sequencerTrackColor(): boolean { return this.get('sequencerTrackColor') }
  set sequencerTrackColor(v: boolean) { this.set('sequencerTrackColor', v) }
  
  get EPSILON(): number { return this.get('EPSILON') }
  get OVERBAR_ROW_HEIGHT(): number { return this.get('OVERBAR_ROW_HEIGHT') }
  
  // Legacy save/load methods
  save(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value))
  }
  
  load(key: string): any {
    const stored = localStorage.getItem(key)
    if (stored === null) return null
    try {
      return JSON.parse(stored)
    } catch {
      return stored
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const settingsManager = new SettingsManager()

// Default export for backwards compatibility
export default settingsManager
