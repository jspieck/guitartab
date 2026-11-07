// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'

vi.mock('fastdom', () => ({
  default: { mutate: (fn: () => void) => fn(), measure: (fn: () => void) => fn() },
}))
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
import Song from '../src/stores/song'
import Settings from '../src/stores/settingsState'
import { selectionState } from '../src/stores/selectionState'
import { scoreSystems, scoreViewState } from '../src/stores/scoreViewState'
import { tabLayout } from '../src/stores/tabLayoutState'
import { getBlockRenderLayout } from '../src/stores/tabRenderLayout'
import { typedEventBus } from '../src/utils/typedEventBus'
import { computeTrackLayout } from '../src/services/editor/measureLayoutEngine'
import { computeScoreLayout, scoreTrackIds, SCORE_STAFF_GAP } from '../src/services/editor/scoreLayout'
import { moveCursorToTrack, toggleScoreTrack } from '../src/services/editor/scoreViewCommands'
import { beatAtSameTime, otherVoiceNoteAt, type OtherVoiceNote } from '../src/utils/otherVoiceNotes'
import type { Beat } from '../src/types/song'
import type { RenderedTabRow } from '../src/types/tab'

const OPTIONS = { availableWidth: 900, headerHeight: 80, paddingTop: 20, tabInformationHeight: 80 }

function rowsOf(rows: RenderedTabRow[], trackId: number) {
  return rows.filter((row) => row.trackId === trackId)
}

beforeAll(async () => {
  const { buildDemoArrangement } = await import('../src/data/demoArrangement')
  const { loadBuiltSong } = await import('../src/services/songImport')
  loadBuiltSong(buildDemoArrangement())
})

beforeEach(() => {
  Settings.vexFlowIsActive = false
  Settings.multiBarRests = false
  Settings.scoreView = true
  scoreViewState.trackIds = null
  Song.currentTrackId = 0
  Song.currentVoiceId = 0
})

describe('score view', () => {
  it('shows every track, or the chosen ones plus the edited track, and nothing extra for one track', () => {
    expect(scoreTrackIds()).toEqual([0, 1, 2, 3])
    scoreViewState.trackIds = [2]
    expect(scoreTrackIds()).toEqual([0, 2])
    scoreViewState.trackIds = []
    expect(scoreTrackIds()).toBeNull()
    Settings.scoreView = false
    expect(scoreTrackIds()).toBeNull()
  })

  it('gives every track the same rows and bar widths, at least as wide as each track alone', () => {
    const alone = [0, 1, 2, 3].map((trackId) =>
      computeTrackLayout(trackId, 0, Song.measures[trackId], OPTIONS),
    )
    const minWidths = alone.map((result) => result.allWidths.map((width) => width.minWidth))
    const rows = computeScoreLayout([0, 1, 2, 3], 0, 0, OPTIONS)

    const breaks = [0, 1, 2, 3].map((trackId) => JSON.stringify(toRaw(tabLayout.blocksPerRow[trackId][0])))
    expect(new Set(breaks).size).toBe(1)
    expect(rowsOf(rows, 0).length).toBe(scoreSystems.length)

    const numBars = Song.measureMeta.length
    for (let blockId = 0; blockId < numBars; blockId += 1) {
      const layouts = [0, 1, 2, 3].map((trackId) => getBlockRenderLayout(trackId, 0, blockId)!)
      // same x and width in every staff
      expect(new Set(layouts.map((layout) => layout.xOffset)).size).toBe(1)
      expect(new Set(layouts.map((layout) => layout.width)).size).toBe(1)
      for (const widths of minWidths) expect(layouts[0].width).toBeGreaterThanOrEqual(widths[blockId] - 1e-6)
    }
  })

  it('stacks the staves of a system in track order, one system after the other', () => {
    const rows = computeScoreLayout([0, 2, 3], 0, 0, OPTIONS)
    for (let system = 0; system < scoreSystems.length; system += 1) {
      const staves = rows.filter((row) => row.id === system)
      expect(staves.map((row) => row.trackId)).toEqual([0, 2, 3])
      staves.forEach((row, index) => {
        if (index === 0) expect(row.top).toBe(scoreSystems[system].top)
        else expect(row.top).toBe(staves[index - 1].top! + staves[index - 1].height! + SCORE_STAFF_GAP)
      })
      const last = staves.at(-1)!
      expect(scoreSystems[system].bottom).toBe(last.top! + last.height!)
      if (system > 0) expect(scoreSystems[system].top).toBeGreaterThan(scoreSystems[system - 1].bottom)
    }
  })

  it('lays the edited track out in its edited voice and the others in voice 1', () => {
    const rows = computeScoreLayout([0, 1], 1, 1, OPTIONS)
    expect(rowsOf(rows, 0).every((row) => row.voiceId === 0)).toBe(true)
    expect(rowsOf(rows, 1).every((row) => row.voiceId === 1)).toBe(true)
  })

  it('choosing tracks keeps the edited one in', () => {
    toggleScoreTrack(1)
    expect(scoreViewState.trackIds).toEqual([0, 2, 3])
    toggleScoreTrack(0)
    expect(scoreViewState.trackIds).toEqual([0, 2, 3])
    toggleScoreTrack(1)
    expect(scoreViewState.trackIds).toBeNull()
  })
})

describe('moving the cursor between tracks', () => {
  it('goes to the next shown track at the beat sounding then, on the same string from the top', () => {
    const moves: unknown[] = []
    const record = (position: unknown) => moves.push(position)
    typedEventBus.on('navigation.setClickedPos', record)
    scoreViewState.trackIds = [0, 2]
    // Acoustic guitar, bar 2, its third beat, top string (6 strings: index 5)
    const beats = Song.measures[0][1][0]
    const beatId = Math.min(2, beats.length - 1)
    selectionState.cursor = { trackId: 0, voiceId: 0, blockId: 1, beatId, string: 5 }

    expect(moveCursorToTrack(1)).toBe(true)
    typedEventBus.off('navigation.setClickedPos', record)
    expect(Song.currentTrackId).toBe(2)
    // the bass has 4 strings: its top string is index 3
    expect(moves.at(-1)).toEqual(expect.objectContaining({ trackId: 2, voiceId: 0, blockId: 1, string: 3 }))
    expect(moveCursorToTrack(1)).toBe(false)
  })
})

describe('clicking a faint note of the other voice', () => {
  const notes: OtherVoiceNote[] = [
    { x: 40, string: 2, text: '5', beatIndex: 1 },
    { x: 52, string: 2, text: '7', beatIndex: 2 },
  ]
  it('takes the nearest faint note on that string within reach', () => {
    expect(otherVoiceNoteAt(notes, 44, 2)?.beatIndex).toBe(1)
    expect(otherVoiceNoteAt(notes, 49, 2)?.beatIndex).toBe(2)
    expect(otherVoiceNoteAt(notes, 44, 3)).toBeNull()
    expect(otherVoiceNoteAt(notes, 70, 2)).toBeNull()
  })
})

describe('the cursor keeps its time across voices and tracks', () => {
  const beats = (...durations: string[]) =>
    durations.map((duration) => ({ duration, notes: [] }) as unknown as Beat)
  it('finds the beat sounding when the cursor’s beat starts', () => {
    const quarters = beats('q', 'q', 'q', 'q')
    const eighths = beats('e', 'e', 'e', 'e', 'e', 'e', 'e', 'e')
    expect(beatAtSameTime(eighths, 3, quarters)).toBe(1)
    expect(beatAtSameTime(quarters, 2, eighths)).toBe(4)
    expect(beatAtSameTime(quarters, 3, beats('h', 'h'))).toBe(1)
    expect(beatAtSameTime(quarters, 3, beats('h'))).toBe(0)
  })
})
