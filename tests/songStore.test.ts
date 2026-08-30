import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Song from '../src/assets/js/songData'
import { songDataVersion, songState } from '../src/stores/songState'
import { useSongStore } from '../src/stores/songStore'

describe('songState / Song facade', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Song.initEmptySong()
    songDataVersion.value = 0
  })

  it('keeps Song data properties on the shared reactive songState', () => {
    expect(Song.measures).toBe(songState.measures)
    expect(Song.tracks).toBe(songState.tracks)
  })

  it('reflects in-place measure mutations without reassignment', () => {
    Song.measures[0][0][0][0].duration = 'q'

    expect(songState.measures[0][0][0][0].duration).toBe('q')
  })

  it('exposes the same measures through the Pinia song store', () => {
    const songStore = useSongStore()

    expect(songStore.measures).toBe(songState.measures)
    expect(songStore.currentTrackId).toBe(songState.currentTrackId)
  })

  it('bumps the shared data version from the store action', () => {
    const songStore = useSongStore()

    songStore.notifyDataChanged()

    expect(songDataVersion.value).toBe(1)
  })
})
