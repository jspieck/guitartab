import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('appSettings', () => {
  beforeEach(async () => {
    storage.clear()
    vi.resetModules()
  })

  it('persists boolean settings as JSON', async () => {
    const { default: appSettings } = await import('../src/utils/appSettings')
    appSettings.darkMode = true
    expect(storage.get('guitartab_darkMode')).toBe('true')
  })

  it('does not persist runtime playback state', async () => {
    const { default: appSettings } = await import('../src/utils/appSettings')
    appSettings.songPlaying = true
    expect(storage.get('guitartab_songPlaying')).toBeUndefined()
  })
})
