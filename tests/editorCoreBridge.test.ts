import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vanilla-picker', () => ({
  default: class PickerMock {},
}))

vi.mock('../src/assets/js/helper', () => ({
  default: {
    groupMeasureBeats: vi.fn(),
    getLeftOffset: vi.fn((blockId: number) => (blockId === 0 ? 53 : 10)),
  },
}))

vi.mock('../src/assets/js/playBackLogicNew', () => ({
  default: {
    setPlayPosition: vi.fn(),
  },
}))

vi.mock('../src/assets/js/svgDrawer', () => ({
  svgDrawer: {
    blockToPage: [],
    blockToX: [],
    rowToY: [],
    heightOfRow: [],
    trackCreated: false,
    paddingTop: 0,
    tabInformationHeight: 0,
    numRows: 0,
    numPages: 1,
    playBackBarObjects: [],
    getRowWidth: vi.fn(() => 800),
  },
}))

vi.mock('../src/assets/js/tab', () => {
  class TabMock {
    static computeWidthOfBlock() {
      return { minWidth: 200, minOffset: 40, num16ths: 4 }
    }
  }

  return {
    Tab: TabMock,
    tab: {
      markedNoteObj: { trackId: 0, voiceId: 0, blockId: 0, beatId: 0, string: 0 },
      hasExplicitSelection: false,
      blockToRow: [],
      finalBlockWidths: [],
      measureOffset: [],
      changeNoteDuration: vi.fn(() => true),
    },
  }
})

import EventBus from '../src/assets/js/eventBus'
import playBackLogic from '../src/assets/js/playBackLogicNew'
import Song, {
  type MeasureMetaInfo,
  type PlayBackInstrument,
  type SongDescription,
  type Track,
} from '../src/assets/js/songData'
import { svgDrawer } from '../src/assets/js/svgDrawer'
import { resetPlaybackBarState, usePlaybackBarState } from '../src/composables/usePlaybackBarState'
import { registerSelectionSurface, resetSelectionSurfaceState } from '../src/composables/useSelectionSurfaceState'
import { tab } from '../src/assets/js/tab'
import { clearTrackRenderLayout, useTabRenderLayout } from '../src/composables/useTabRenderLayout'
import { useTabSelection } from '../src/composables/useTabSelection'
import legacyEditorCore from '../src/services/legacy/editorCoreAdapter'
import { typedEventBus } from '../src/utils/typedEventBus'

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    numStrings: 6,
    capo: 0,
    strings: [64, 59, 55, 50, 45, 40],
    volume: 127,
    balance: 63,
    reverb: 0,
    name: 'Lead',
    color: { red: 10, green: 20, blue: 30 },
    channel: { index: 0, effectChannel: 1 },
    program: 0,
    primaryChannel: 0,
    letItRing: false,
    ...overrides,
  }
}

function createPlayback(overrides: Partial<PlayBackInstrument> = {}): PlayBackInstrument {
  return {
    instrument: 'guitar',
    solo: false,
    mute: false,
    volume: 100,
    tremolo: 0,
    reverb: 0,
    chorus: 0,
    phaser: 0,
    balance: 64,
    ...overrides,
  }
}

let originalMeasures: typeof Song.measures
let originalTracks: Track[]
let originalPlayback: PlayBackInstrument[]
let originalMeasureMeta: MeasureMetaInfo[]
let originalSongDescription: SongDescription
let originalCurrentTrackId: number
let originalCurrentVoiceId: number
let originalMarkedNoteObj: typeof tab.markedNoteObj
let originalHasExplicitSelection: boolean

beforeEach(() => {
  clearTrackRenderLayout(0, 0)
  resetPlaybackBarState()
  resetSelectionSurfaceState()

  originalMeasures = cloneValue(Song.measures)
  originalTracks = cloneValue(Song.tracks)
  originalPlayback = cloneValue(Song.playBackInstrument)
  originalMeasureMeta = cloneValue(Song.measureMeta)
  originalSongDescription = cloneValue(Song.songDescription)
  originalCurrentTrackId = Song.currentTrackId
  originalCurrentVoiceId = Song.currentVoiceId
  originalMarkedNoteObj = cloneValue(tab.markedNoteObj)
  originalHasExplicitSelection = tab.hasExplicitSelection

  Song.measures = []
  Song.tracks = [createTrack()]
  Song.playBackInstrument = [createPlayback()]
  Song.measureMeta = [Song.defaultMeasureMeta()]
  Song.songDescription = { title: 'Test Song', author: 'Test Author' }
  Song.currentTrackId = 0
  Song.currentVoiceId = 0

  useTabSelection().clearSelection()
})

afterEach(() => {
  clearTrackRenderLayout(0, 0)
  resetPlaybackBarState()
  resetSelectionSurfaceState()

  Song.measures = originalMeasures
  Song.tracks = originalTracks
  Song.playBackInstrument = originalPlayback
  Song.measureMeta = originalMeasureMeta
  Song.songDescription = originalSongDescription
  Song.currentTrackId = originalCurrentTrackId
  Song.currentVoiceId = originalCurrentVoiceId
  tab.markedNoteObj = originalMarkedNoteObj
  tab.hasExplicitSelection = originalHasExplicitSelection

  useTabSelection().clearSelection()
  vi.restoreAllMocks()
})

describe('legacyEditorCore bridge', () => {
  it('creates and removes notes through the legacy bridge', () => {
    const emitSpy = vi.spyOn(EventBus, 'emit')

    legacyEditorCore.setNoteAtPosition(0, 0, 0, 0, 2, 5)

    expect(Song.measures[0][0][0][0].duration).toBe('q')
    expect(Song.measures[0][0][0][0].notes[2]?.fret).toBe(5)
    expect(Song.measures[0][0][0][0].notes[2]?.string).toBe(2)
    expect(emitSpy).toHaveBeenCalledWith('song-data-changed')

    legacyEditorCore.setNoteAtPosition(0, 0, 0, 0, 2, -1)

    expect(Song.measures[0][0][0][0].notes[2]).toBeNull()
  })

  it('returns isolated snapshots for the reactive bridge', () => {
    legacyEditorCore.setNoteAtPosition(0, 0, 0, 0, 1, 7)

    const snapshot = legacyEditorCore.getSongSnapshot()
    snapshot.tracks[0].name = 'Changed'
    snapshot.measures[0][0][0][0].notes[1] = null

    expect(Song.tracks[0].name).toBe('Lead')
    expect(Song.measures[0][0][0][0].notes[1]?.fret).toBe(7)
  })

  it('stores modern layout in the render bridge and keeps legacy arrays synced', () => {
    const { getTrackLayout } = useTabRenderLayout()

    Song.measures = [
      [
        [[Song.defaultMeasure()]],
        [[Song.defaultMeasure()]],
      ],
    ]

    const rows = legacyEditorCore.buildModernTabRows(0, 0, Song.measures[0], {
      availableWidth: 250,
      headerHeight: 50,
      rowHeight: 120,
      paddingTop: 24,
      tabInformationHeight: 50,
    })
    const layout = legacyEditorCore.getModernLayout(0, 0)
    const reactiveLayout = getTrackLayout(0, 0)

    expect(rows).toHaveLength(2)
    expect(layout?.numRows).toBe(2)
    expect(reactiveLayout?.numRows).toBe(2)
    expect(layout?.blockLayouts[0]?.rowId).toBe(0)
    expect(layout?.blockLayouts[0]?.beatPositions).toEqual([53])
    expect(layout?.blockLayouts[1]?.rowId).toBe(1)
    expect(reactiveLayout?.blockLayouts[1]?.rowId).toBe(1)
    expect(tab.blockToRow[0][0][1]).toEqual({ rowId: 1, numInRow: 0 })
    expect(tab.measureOffset[0][1][0]).toBe(40)
    expect(svgDrawer.rowToY[0][0][1]).toBe(170)
  })

  it('routes playback marker ownership through the render bridge', () => {
    const { playbackBarState } = usePlaybackBarState()
    const marker = { id: 'playback-marker' } as unknown as SVGGElement

    legacyEditorCore.setPlaybackBarObject(marker)
    expect(playbackBarState.registered).toBe(true)
    expect(svgDrawer.playBackBarObjects).toEqual([])

    legacyEditorCore.setPlaybackBarObject(null)
    expect(playbackBarState.registered).toBe(false)
    expect(svgDrawer.playBackBarObjects).toEqual([])
  })
})

describe('useTabSelection', () => {
  it('syncs selection state from navigation events without a broadcast loop', () => {
    registerSelectionSurface(true)
    legacyEditorCore.setNoteAtPosition(0, 0, 0, 0, 2, 9)
    Song.measures[0][0][0][0].duration = 'e'

    const { currentSelection, selectedNote } = useTabSelection()
    const emitSpy = vi.spyOn(EventBus, 'emit')

    typedEventBus.emit('navigation.setClickedPos', {
      trackId: 0,
      voiceId: 0,
      blockId: 0,
      beatId: 0,
      string: 2,
    })

    expect(currentSelection.value).toEqual({
      trackId: 0,
      voiceId: 0,
      blockId: 0,
      beatIndex: 0,
      stringIndex: 2,
    })
    expect(tab.hasExplicitSelection).toBe(true)
    expect(tab.markedNoteObj).toEqual({
      trackId: 0,
      voiceId: 0,
      blockId: 0,
      beatId: 0,
      string: 2,
    })
    expect(emitSpy).toHaveBeenCalledWith('menu.clickedOnPos', {
      trackId: 0,
      voiceId: 0,
      blockId: 0,
      beatId: 0,
      string: 2,
    })
    expect(playBackLogic.setPlayPosition).toHaveBeenCalledWith(0, 0, 0, 0)
    expect(selectedNote.value?.fret).toBe(9)
    expect(selectedNote.value?.duration).toBe('eighth')
  })
})