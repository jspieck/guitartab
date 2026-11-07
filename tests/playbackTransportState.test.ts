import { beforeEach, describe, expect, it } from 'vitest'
import Settings from '../src/stores/settingsState'
import { playbackTransportState, playbackTransportVersion } from '../src/stores/playbackTransportState'
import { publishPlaybackStopped, publishPlaybackPosition } from '../src/stores/playbackTransportState'

describe('playbackEngineBridge', () => {
  beforeEach(() => {
    playbackTransportState.isPlaying = false
    playbackTransportState.blockId = 0
    playbackTransportState.beatId = 0
    playbackTransportState.positionInBlock = 0
    playbackTransportVersion.value = 0
    Settings.songPlaying = false
  })

  it('publishes live transport positions during playback', () => {
    Settings.songPlaying = true

    publishPlaybackPosition(3, 2, 0.5)

    expect(playbackTransportState.isPlaying).toBe(true)
    expect(playbackTransportState.blockId).toBe(3)
    expect(playbackTransportState.beatId).toBe(2)
    expect(playbackTransportState.positionInBlock).toBe(0.5)
    expect(playbackTransportVersion.value).toBe(1)
  })

  it('resets transport state when playback stops', () => {
    publishPlaybackPosition(4, 1, 0.25)
    publishPlaybackStopped()

    expect(playbackTransportState.isPlaying).toBe(false)
    expect(playbackTransportState.blockId).toBe(0)
    expect(playbackTransportState.beatId).toBe(0)
    expect(playbackTransportVersion.value).toBe(2)
  })
})
