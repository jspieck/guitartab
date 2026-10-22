import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

const storage = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value)
  },
  removeItem: (key: string) => {
    storage.delete(key)
  },
  clear: () => {
    storage.clear()
  },
})

describe('settingsState', () => {
  beforeEach(() => {
    storage.clear()
    vi.resetModules()
  })

  it('persists settings as JSON on write', async () => {
    const { settingsState } = await import('../src/stores/settingsState')
    settingsState.darkMode = true
    expect(storage.get('guitartab_darkMode')).toBe('true')
  })

  it('loads persisted values', async () => {
    storage.set('guitartab_currentZoom', '1.25')
    const { settingsState } = await import('../src/stores/settingsState')
    expect(settingsState.currentZoom).toBe(1.25)
  })

  it('does not persist runtime playback state', async () => {
    const { settingsState } = await import('../src/stores/settingsState')
    settingsState.songPlaying = true
    expect(storage.get('guitartab_songPlaying')).toBeUndefined()
  })

  it('is reactive', async () => {
    const { settingsState } = await import('../src/stores/settingsState')
    const classical = computed(() => settingsState.vexFlowIsActive)
    expect(classical.value).toBe(false)
    settingsState.vexFlowIsActive = true
    expect(classical.value).toBe(true)
  })
})
