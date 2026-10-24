import { beforeEach, describe, expect, it, vi } from 'vitest'
import Song from '../src/stores/song'
import { recomputeTrackLayoutFromSong } from '../src/services/editor/measureLayoutEngine'
import { getMeasureBeatWidth, getMeasureBeatX } from '../src/utils/measureBeatLayout'
import { getBlockRenderLayout } from '../src/stores/tabRenderLayout'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
vi.mock('../src/services/dialogs/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)

const TRACK_ID = 0
const VOICE_ID = 0
const AVAILABLE_WIDTH = 900

describe('measureBeatLayout', () => {
  beforeEach(() => {
    Song.initEmptySong()
  })

  it('uses block-local beat positions from layout state', () => {
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, AVAILABLE_WIDTH)

    const blockLayout = getBlockRenderLayout(TRACK_ID, VOICE_ID, 0)
    expect(blockLayout).not.toBeNull()

    const beats = Song.measures[TRACK_ID][0][VOICE_ID]
    for (let beatId = 0; beatId < beats.length; beatId += 1) {
      expect(getMeasureBeatX(TRACK_ID, VOICE_ID, 0, beatId, beats)).toBe(blockLayout!.beatPositions[beatId])
      expect(getMeasureBeatWidth(TRACK_ID, VOICE_ID, 0, beatId, beats)).toBeGreaterThan(0)
    }
  })
})
