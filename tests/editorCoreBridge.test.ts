import { tabLayout } from '../src/stores/tabLayoutState'
import { selectionState } from '../src/stores/selectionState'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vanilla-picker', () => ({
  default: class PickerMock {},
}))

vi.mock('../src/services/playback', () => ({
  default: {
    setPlayPosition: vi.fn(),
  },
}))

vi.mock('../src/services/dialogs/modalManager', () =>
  import('./helpers/legacyMocks').then((m) => m.modalManagerModule),
)
vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)

vi.mock('../src/services/editor/rangeSelection', () => ({
  clearRange: vi.fn(),
  startRange: vi.fn(),
  extendRange: vi.fn(),
}))

import playback from '../src/services/playback'
import Song, {
  type MeasureMetaInfo,
  type PlayBackInstrument,
  type SongDescription,
  type Track,
} from '../src/stores/song'
import { resetPlaybackBarState, usePlaybackBarState } from '../src/stores/playbackBarState'
import { registerSelectionSurface, resetSelectionSurfaceState } from '../src/stores/selectionSurfaceState'
import { clearTrackRenderLayout, useTabRenderLayout } from '../src/stores/tabRenderLayout'
import { useTabSelection } from '../src/composables/useTabSelection'
import { useTabSelectionBridge } from '../src/composables/useTabSelectionBridge'
import editorCore from '../src/services/editor/editorCore'
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
let originalMarkedNoteObj: typeof selectionState.cursor
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
  originalMarkedNoteObj = cloneValue(selectionState.cursor)
  originalHasExplicitSelection = selectionState.hasExplicitSelection

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
  selectionState.cursor = originalMarkedNoteObj
  selectionState.hasExplicitSelection = originalHasExplicitSelection

  useTabSelection().clearSelection()
  vi.restoreAllMocks()
})

describe('editorCore bridge', () => {
  it('creates and removes notes through editorCore', () => {
    const emitSpy = vi.spyOn(typedEventBus, 'emit')

    editorCore.setNoteAtPosition(0, 0, 0, 0, 2, 5)

    expect(Song.measures[0][0][0][0].duration).toBe('q')
    expect(Song.measures[0][0][0][0].notes[2]?.fret).toBe(5)
    expect(emitSpy).toHaveBeenCalledWith('song-data-changed')

    editorCore.setNoteAtPosition(0, 0, 0, 0, 2, -1)

    expect(Song.measures[0][0][0][0].notes[2] ?? null).toBeNull()
  })

  it('returns live song-state references for the reactive bridge', () => {
    editorCore.setNoteAtPosition(0, 0, 0, 0, 1, 7)

    const snapshot = editorCore.getSongSnapshot()
    snapshot.tracks[0].name = 'Changed'
    snapshot.measures[0][0][0][0].notes[1] = null

    expect(Song.tracks[0].name).toBe('Changed')
    expect(Song.measures[0][0][0][0].notes[1]).toBeNull()
  })

  it('still clones beats for clipboard copy', () => {
    editorCore.setNoteAtPosition(0, 0, 0, 0, 1, 7)

    const copied = editorCore.copyBeat(0, 0, 0, 0)
    copied!.notes[1] = null

    expect(Song.measures[0][0][0][0].notes[1]?.fret).toBe(7)
  })

  it('stores modern layout in the render bridge and keeps tab arrays synced', () => {
    const { getTrackLayout } = useTabRenderLayout()

    Song.measures = [[[[Song.defaultMeasure()]], [[Song.defaultMeasure()]]]]

    const rows = editorCore.buildModernTabRows(0, 0, Song.measures[0], {
      availableWidth: 250,
      headerHeight: 50,
      rowHeight: 120,
      paddingTop: 24,
      tabInformationHeight: 50,
    })
    const layout = editorCore.getModernLayout(0, 0)
    const reactiveLayout = getTrackLayout(0, 0)

    expect(rows).toHaveLength(2)
    expect(layout?.numRows).toBe(2)
    expect(reactiveLayout?.numRows).toBe(2)
    expect(layout?.blockLayouts[0]?.rowId).toBe(0)
    // First bar: padding 10 + tempo mark 43 + 8 for a three-digit bpm
    expect(layout?.blockLayouts[0]?.beatPositions).toEqual([61])
    expect(layout?.blockLayouts[1]?.rowId).toBe(1)
    expect(reactiveLayout?.blockLayouts[1]?.rowId).toBe(1)
    expect(tabLayout.blockToRow[0][0][1]).toEqual({ rowId: 1, numInRow: 0 })
    expect(tabLayout.blocksPerRow[0][0][0]).toEqual({ start: 0, end: 1 })
    expect(tabLayout.measureOffset[0][1][0]).toBe(52.5)
    // Rows stack by their real content height: row 1 starts below row 0's bottom.
    expect(reactiveLayout?.rowLayouts[1]?.yOffset).toBe(rows[1].yOffset)
    expect(rows[1].top).toBeGreaterThanOrEqual(rows[0].top! + rows[0].height!)
    expect(rows[1].yOffset).toBe(rows[1].top! + rows[1].lanes!.overBarHeight)
  })

  it('routes playback marker ownership through the render bridge', () => {
    const { playbackBarState } = usePlaybackBarState()
    const marker = { id: 'playback-marker' } as unknown as SVGGElement

    editorCore.setPlaybackBarObject(marker)
    expect(playbackBarState.registered).toBe(true)

    editorCore.setPlaybackBarObject(null)
    expect(playbackBarState.registered).toBe(false)
  })

  it('finds the previous note on the same string for tie eligibility', () => {
    Song.initEmptySong()
    editorCore.setNoteAtPosition(0, 0, 0, 1, 2, 7)
    editorCore.setNoteAtPosition(0, 0, 0, 3, 2, 9)

    expect(editorCore.findPreviousNoteOnString(0, 0, 0, 3, 2)).toEqual({ blockId: 0, beatId: 1 })

    expect(editorCore.findPreviousNoteOnString(0, 0, 0, 0, 2)).toBeNull()
  })
})

describe('useTabSelection', () => {
  it('syncs selection state from navigation events without a broadcast loop', () => {
    registerSelectionSurface(true)
    editorCore.setNoteAtPosition(0, 0, 0, 0, 2, 9)
    Song.measures[0][0][0][0].duration = 'e'

    const { currentSelection, selectedNote, setSelection } = useTabSelection()
    const unregisterBridge = useTabSelectionBridge(setSelection).registerNavigationSelectionBridge()

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
    expect(selectionState.hasExplicitSelection).toBe(true)
    expect(selectionState.cursor).toEqual({
      trackId: 0,
      voiceId: 0,
      blockId: 0,
      beatId: 0,
      string: 2,
    })
    expect(playback.setPlayPosition).toHaveBeenCalledWith(0, 0, 0, 0)
    expect(selectedNote.value?.fret).toBe(9)
    expect(selectedNote.value?.duration).toBe('eighth')

    unregisterBridge()
  })
})
