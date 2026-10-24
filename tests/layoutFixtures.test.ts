import { tabLayout } from '../src/stores/tabLayoutState'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Song from '../src/stores/song'
import Settings from '../src/stores/settingsState'
import { clearTrackRenderLayout, getBlockRenderLayout } from '../src/stores/tabRenderLayout'
import { computeTrackLayout } from '../src/services/editor/measureLayoutEngine'
import { getMeasureBeatX } from '../src/utils/measureBeatLayout'
import { getBeatPositionInRow } from '../src/utils/beatPositionInRow'
import { assertTabAndRenderLayoutMatch } from './helpers/layoutConvergence'

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
const NARROW_WIDTH = 520
const WIDE_WIDTH = 4000
const CLASSICAL_WIDTH = 900

vi.mock('../src/services/notation/classicalNotationAdapter', () => ({
  classicalNotation: {
    calculateLargestBeatWidth: () => 60,
    ensureStructuresForLayout: vi.fn(),
    computeVexFlowDataStructures: vi.fn(),
    syncLayoutMetrics: vi.fn(),
  },
}))

function layoutOptions(availableWidth: number, rowHeight = 120) {
  return {
    availableWidth,
    headerHeight: 80,
    rowHeight,
    paddingTop: 20,
    tabInformationHeight: 80,
  }
}

describe('layout fixtures', () => {
  beforeEach(() => {
    Song.initEmptySong()
    Settings.vexFlowIsActive = false
    clearTrackRenderLayout(TRACK_ID, VOICE_ID)
  })

  it('wraps the default 12-measure song across multiple rows at narrow width', () => {
    const { rows, state } = computeTrackLayout(
      TRACK_ID,
      VOICE_ID,
      Song.measures[TRACK_ID],
      layoutOptions(NARROW_WIDTH),
    )

    expect(Song.measures[TRACK_ID].length).toBe(12)
    expect(rows.length).toBeGreaterThan(1)
    expect(state.numRows).toBe(rows.length)
    expect(tabLayout.blocksPerRow[TRACK_ID][VOICE_ID].length).toBe(rows.length)

    const coveredBlocks = rows.reduce((sum, row) => sum + (row.endBlockId - row.startBlockId + 1), 0)
    expect(coveredBlocks).toBe(12)
    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
  })

  it('fits the default song on one row when the viewport is wide enough', () => {
    const { rows } = computeTrackLayout(
      TRACK_ID,
      VOICE_ID,
      Song.measures[TRACK_ID],
      layoutOptions(WIDE_WIDTH),
    )

    expect(rows.length).toBe(1)
    expect(rows[0].startBlockId).toBe(0)
    expect(rows[0].endBlockId).toBe(11)
  })

  it('creates more rows when classical beat widths widen measures', () => {
    Settings.vexFlowIsActive = false
    const withoutClassical = computeTrackLayout(
      TRACK_ID,
      VOICE_ID,
      Song.measures[TRACK_ID],
      layoutOptions(CLASSICAL_WIDTH),
    )

    clearTrackRenderLayout(TRACK_ID, VOICE_ID)
    Settings.vexFlowIsActive = true
    const withClassical = computeTrackLayout(
      TRACK_ID,
      VOICE_ID,
      Song.measures[TRACK_ID],
      layoutOptions(CLASSICAL_WIDTH, 278),
    )

    expect(withClassical.rows.length).toBeGreaterThanOrEqual(withoutClassical.rows.length)
    expect(withClassical.rows.length).toBeGreaterThan(1)

    const firstWidthWithout = withoutClassical.state.blockLayouts[0].width
    const firstWidthWith = withClassical.state.blockLayouts[0].width
    expect(firstWidthWith).toBeGreaterThan(firstWidthWithout)

    assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
    Settings.vexFlowIsActive = false
  })

  it('keeps beatPositions block-local with classical off and on', () => {
    for (const classical of [false, true]) {
      clearTrackRenderLayout(TRACK_ID, VOICE_ID)
      Settings.vexFlowIsActive = classical

      const { state } = computeTrackLayout(
        TRACK_ID,
        VOICE_ID,
        Song.measures[TRACK_ID],
        layoutOptions(CLASSICAL_WIDTH, classical ? 278 : 120),
      )

      for (let blockId = 0; blockId < Song.measures[TRACK_ID].length; blockId += 1) {
        const beats = Song.measures[TRACK_ID][blockId][VOICE_ID]
        const blockLayout = state.blockLayouts[blockId]
        expect(blockLayout).toBeDefined()

        let previousX = -1
        for (let beatId = 0; beatId < beats.length; beatId += 1) {
          const localX = blockLayout.beatPositions[beatId]
          expect(Number.isFinite(localX)).toBe(true)
          expect(localX).toBeGreaterThanOrEqual(0)
          expect(localX).toBeLessThan(blockLayout.width)
          expect(localX).toBeGreaterThan(previousX)
          previousX = localX

          expect(getMeasureBeatX(TRACK_ID, VOICE_ID, blockId, beatId, beats)).toBe(localX)

          const rowX = getBeatPositionInRow(TRACK_ID, VOICE_ID, blockId, beatId)
          expect(rowX).toBe(blockLayout.xOffset + localX)
        }
      }

      assertTabAndRenderLayoutMatch(TRACK_ID, VOICE_ID)
    }

    Settings.vexFlowIsActive = false
  })

  it('realigns block-local beat X after toggling classical off again', () => {
    Settings.vexFlowIsActive = true
    computeTrackLayout(TRACK_ID, VOICE_ID, Song.measures[TRACK_ID], layoutOptions(CLASSICAL_WIDTH, 278))
    const classicalWidth = getBlockRenderLayout(TRACK_ID, VOICE_ID, 0)?.width ?? 0

    clearTrackRenderLayout(TRACK_ID, VOICE_ID)
    Settings.vexFlowIsActive = false
    computeTrackLayout(TRACK_ID, VOICE_ID, Song.measures[TRACK_ID], layoutOptions(CLASSICAL_WIDTH))
    const normalWidth = getBlockRenderLayout(TRACK_ID, VOICE_ID, 0)?.width ?? 0

    expect(classicalWidth).toBeGreaterThan(normalWidth)

    const beats = Song.measures[TRACK_ID][0][VOICE_ID]
    const blockLayout = getBlockRenderLayout(TRACK_ID, VOICE_ID, 0)!
    for (let beatId = 0; beatId < beats.length; beatId += 1) {
      expect(getMeasureBeatX(TRACK_ID, VOICE_ID, 0, beatId, beats)).toBe(blockLayout.beatPositions[beatId])
      expect(blockLayout.beatPositions[beatId]).toBeLessThan(blockLayout.width)
    }
  })
})
