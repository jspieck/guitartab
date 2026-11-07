import { beforeEach, describe, expect, it, vi } from 'vitest'

const scheduler = vi.hoisted(() => ({ init: vi.fn(), start: vi.fn(), stop: vi.fn() }))
vi.mock('../src/services/playback/scheduler', () => ({ scheduler }))
vi.mock('../src/services/playback/playhead', () => ({ playhead: { block: 0, beat: 0 } }))
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)

const { playback } = await import('../src/services/playback')
const state = await import('../src/stores/soundFontState')

describe('Play while the SoundFont loads', () => {
  beforeEach(() => {
    scheduler.start.mockClear()
    state.soundFontState.playWhenReady = false
  })

  it('plays at once when nothing is loading (or it failed)', () => {
    state.soundFontState.status = 'idle'
    playback.togglePlayback()
    expect(scheduler.start).toHaveBeenCalledTimes(1)
  })

  it('waits for the instruments, then starts; pressing again cancels', () => {
    playback.init()
    state.setSoundFontLoading(5_000_000, 20_000_000)
    expect(state.soundFontProgress()).toBe(0.25)
    expect(state.soundFontLoadingLabel()).toBe('Loading instruments… 25 %')

    playback.togglePlayback()
    expect(scheduler.start).not.toHaveBeenCalled()
    expect(state.soundFontLoadingLabel()).toBe('Starts when the instruments are loaded… 25 %')
    playback.togglePlayback()
    expect(state.soundFontState.playWhenReady).toBe(false)

    playback.togglePlayback()
    state.setSoundFontSettled('ready')
    expect(scheduler.start).toHaveBeenCalledTimes(1)
    expect(state.soundFontState.playWhenReady).toBe(false)
    expect(state.soundFontLoadingLabel()).toBeNull()
  })

  it('Stop cancels a waiting Play', () => {
    state.setSoundFontLoading(0, 0)
    expect(state.soundFontLoadingLabel()).toBe('Loading instruments…')
    playback.togglePlayback()
    playback.stop()
    state.setSoundFontSettled('failed')
    expect(scheduler.start).not.toHaveBeenCalled()
  })
})
