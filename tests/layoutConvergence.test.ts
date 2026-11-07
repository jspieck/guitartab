import { relayoutTrack } from '../src/services/editor/measureLayoutEngine'
import { tabLayout } from '../src/stores/tabLayoutState'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Song from '../src/stores/song'
import { clearTrackRenderLayout } from '../src/stores/tabRenderLayout'
import { recomputeTrackLayoutFromSong } from '../src/services/editor/measureLayoutEngine'
import { getAvailableRowWidth } from '../src/utils/tabSheetConstants'
import { assertBeatPositionsMatchLayout, assertTabAndRenderLayoutMatch } from './helpers/layoutConvergence'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
const TRACK_ID = 0
const VOICE_ID = 0
const AVAILABLE_WIDTH = 900

describe('layout convergence', () => {
  beforeEach(() => {
    Song.initEmptySong()
    clearTrackRenderLayout(TRACK_ID, VOICE_ID)
  })

  it('keeps tabLayout.blockToRow aligned with useTabRenderLayout after assignBlocksToRows', () => {
    relayoutTrack(TRACK_ID, VOICE_ID)
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
    assertBeatPositionsMatchLayout(TRACK_ID, VOICE_ID)
  })

  it('keeps tab and render layout aligned after direct measureLayoutEngine recompute', () => {
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, AVAILABLE_WIDTH)
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
  })

  it('reconverges after widening a measure duration', () => {
    relayoutTrack(TRACK_ID, VOICE_ID)
    Song.measures[TRACK_ID][0][VOICE_ID][0].duration = 'w'
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, getAvailableRowWidth())
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
  })

  it('reconverges when additional empty measures are appended', () => {
    relayoutTrack(TRACK_ID, VOICE_ID)
    const templateMeasure = Song.measures[TRACK_ID][0]
    Song.measures[TRACK_ID].push(templateMeasure)
    Song.measureMeta.push(Song.defaultMeasureMeta())
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, AVAILABLE_WIDTH)
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
    expect(tabLayout.blockToRow[TRACK_ID][VOICE_ID].length).toBe(Song.measures[TRACK_ID].length)
  })
})
