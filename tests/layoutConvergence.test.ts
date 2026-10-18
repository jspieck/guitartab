import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Song from '../src/assets/js/songData'
import { tab } from '../src/assets/js/tab'
import { clearTrackRenderLayout } from '../src/composables/useTabRenderLayout'
import { recomputeTrackLayoutFromSong } from '../src/services/editor/measureLayoutEngine'
import { getAvailableRowWidth } from '../src/utils/tabSheetConstants'
import { assertBeatPositionsMatchLayout, assertTabAndRenderLayoutMatch } from './helpers/layoutConvergence'

// Legacy singletons that need a browser; see tests/helpers/legacyMocks.ts.
vi.mock('../src/assets/js/audioEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.audioEngineModule),
)
vi.mock('../src/assets/js/playbackEngine', () =>
  import('./helpers/legacyMocks').then((m) => m.playbackModule),
)
vi.mock('../src/assets/js/midiReceiver', () =>
  import('./helpers/legacyMocks').then((m) => m.midiReceiverModule),
)
vi.mock('../src/assets/js/modals/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/assets/js/appManager', () => import('./helpers/legacyMocks').then((m) => m.appManagerModule))

const TRACK_ID = 0
const VOICE_ID = 0
const AVAILABLE_WIDTH = 900

describe('layout convergence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Song.initEmptySong()
    clearTrackRenderLayout(TRACK_ID, VOICE_ID)
  })

  it('keeps tab.blockToRow aligned with useTabRenderLayout after assignBlocksToRows', () => {
    tab.assignBlocksToRows(TRACK_ID, VOICE_ID)
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
    assertBeatPositionsMatchLayout(TRACK_ID, VOICE_ID)
  })

  it('keeps tab and render layout aligned after direct measureLayoutEngine recompute', () => {
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, AVAILABLE_WIDTH)
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
  })

  it('reconverges after widening a measure duration', () => {
    tab.assignBlocksToRows(TRACK_ID, VOICE_ID)
    Song.measures[TRACK_ID][0][VOICE_ID][0].duration = 'w'
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, getAvailableRowWidth())
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
  })

  it('reconverges when additional empty measures are appended', () => {
    tab.assignBlocksToRows(TRACK_ID, VOICE_ID)
    const templateMeasure = Song.measures[TRACK_ID][0]
    Song.measures[TRACK_ID].push(templateMeasure)
    Song.measureMeta.push(Song.defaultMeasureMeta())
    recomputeTrackLayoutFromSong(TRACK_ID, VOICE_ID, AVAILABLE_WIDTH)
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
    expect(tab.blockToRow[TRACK_ID][VOICE_ID].length).toBe(Song.measures[TRACK_ID].length)
  })
})
