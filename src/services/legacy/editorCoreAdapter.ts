import Helper from '../../assets/js/helper'
import Duration from '../../assets/js/duration'
import EventBus from '../../assets/js/eventBus'
import playBackLogic from '../../assets/js/playBackLogicNew'
import Song, {
  type Measure as SongBeat,
  type MeasureMetaInfo,
  type Note as SongNote,
  type PlayBackInstrument,
  type SongDescription,
  type Track,
} from '../../assets/js/songData'
import { Tab, tab } from '../../assets/js/tab'
import { hasRegisteredSelectionSurface } from '../../composables/useSelectionSurfaceState'
import { DURATION_NAMES } from '../../utils/musicUtils'
import { TAB_CONSTANTS } from '../../utils/tabLayout'
import type {
  RenderedTabRow,
  SelectedNoteState,
  TabBeat,
  TabMeasureMetaData,
  TabNoteData,
  TabSelectionData,
} from '../../types/tab'
import legacyRenderBridge, {
  createRenderTrackLayoutState,
  type RenderBlockLayout,
  type RenderRowLayout,
  type RenderTrackLayoutState,
} from './renderBridge'

export interface LegacySongSnapshot {
  measures: SongBeat[][][][]
  songDescription: SongDescription
  tracks: Track[]
  measureMeta: MeasureMetaInfo[]
  playBackInstrument: PlayBackInstrument[]
  currentTrackId: number
  currentVoiceId: number
}

interface ModernLayoutOptions {
  availableWidth: number
  headerHeight: number
  rowHeight: number
  paddingTop: number
  tabInformationHeight: number
}

type BlockWidthInfo = ReturnType<typeof Tab.computeWidthOfBlock>

function getBeatRenderPositions(
  trackId: number,
  blockId: number,
  voiceId: number,
  beats: TabBeat[],
  minOffset: number,
): number[] {
  const leftOffset = Helper.getLeftOffset(blockId)
  const moveHelper = Song.measureMoveHelper?.[trackId]?.[blockId]?.[voiceId]

  if (Array.isArray(moveHelper) && moveHelper.length >= beats.length) {
    return beats.map((_, beatIndex) => {
      const beatOffset = moveHelper[beatIndex]
      return Number.isFinite(beatOffset) ? leftOffset + beatOffset * minOffset : leftOffset
    })
  }

  let position = leftOffset
  return beats.map((beat) => {
    const currentPosition = position
    position += Duration.getDurationWidth(beat) * minOffset
    return currentPosition
  })
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function notifySongDataChanged(): void {
  EventBus.emit('song-data-changed')
}

function getSongSnapshot(): LegacySongSnapshot {
  return {
    measures: cloneValue(Song.measures),
    songDescription: cloneValue(Song.songDescription),
    tracks: cloneValue(Song.tracks),
    measureMeta: cloneValue(Song.measureMeta),
    playBackInstrument: cloneValue(Song.playBackInstrument),
    currentTrackId: Song.currentTrackId,
    currentVoiceId: Song.currentVoiceId,
  }
}

function getTrackStringCount(trackId: number): number {
  return Song.tracks?.[trackId]?.numStrings || Song.tracks?.[trackId]?.strings?.length || 6
}

function defaultNote(): TabNoteData {
  return Song.defaultNote() as TabNoteData
}

function getBeat(trackId: number, blockId: number, voiceId: number, beatIndex: number): SongBeat | undefined {
  return Song.measures?.[trackId]?.[blockId]?.[voiceId]?.[beatIndex]
}

function getNote(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatIndex: number,
  stringIndex: number,
): SongNote | null | undefined {
  return getBeat(trackId, blockId, voiceId, beatIndex)?.notes?.[stringIndex]
}

function getSelectedNoteState(selection: TabSelectionData | null): SelectedNoteState | null {
  if (!selection) {
    return null
  }

  const beat = getBeat(selection.trackId, selection.blockId, selection.voiceId, selection.beatIndex) as TabBeat | undefined
  const note = beat?.notes?.[selection.stringIndex] as TabNoteData | null | undefined
  const rawDuration = beat?.duration || 'q'
  const cleanDuration = rawDuration.replace('r', '')
  const duration = DURATION_NAMES[cleanDuration as keyof typeof DURATION_NAMES] || 'quarter'

  return { ...(note || {}), duration, isEmpty: !note }
}

function copyBeat(trackId: number, blockId: number, voiceId: number, beatIndex: number): TabBeat | null {
  const beat = getBeat(trackId, blockId, voiceId, beatIndex)
  return beat ? cloneValue(beat as TabBeat) : null
}

function syncSelectionEffects(selection: TabSelectionData | null): void {
  if (!selection) {
    return
  }

  const payload = {
    trackId: selection.trackId,
    blockId: selection.blockId,
    voiceId: selection.voiceId,
    beatId: selection.beatIndex,
    string: selection.stringIndex,
  }

  EventBus.emit('menu.clickedOnPos', payload)
  playBackLogic.setPlayPosition(
    selection.trackId,
    selection.blockId,
    selection.voiceId,
    selection.beatIndex,
  )
}

function ensureBeatAtPosition(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatIndex: number,
  numStrings: number,
): TabBeat {
  if (!Song.measures[trackId]) Song.measures[trackId] = []
  if (!Song.measures[trackId][blockId]) Song.measures[trackId][blockId] = []
  if (!Song.measures[trackId][blockId][voiceId]) Song.measures[trackId][blockId][voiceId] = []

  if (!Song.measures[trackId][blockId][voiceId][beatIndex]) {
    const defaultBeat = Song.defaultMeasure() as TabBeat
    defaultBeat.duration = 'q'
    defaultBeat.notes = new Array(numStrings).fill(null)
    Song.measures[trackId][blockId][voiceId][beatIndex] = defaultBeat
  }

  const beat = Song.measures[trackId][blockId][voiceId][beatIndex] as TabBeat
  if (!beat.notes) {
    beat.notes = new Array(numStrings).fill(null)
  }

  return beat
}

const legacyEditorCore = {
  ensureSongInitialized(): boolean {
    if (!Song.measures || Song.measures.length === 0) {
      Song.initEmptySong()
      return true
    }

    return false
  },

  notifySongDataChanged(): void {
    notifySongDataChanged()
  },

  getSongSnapshot(): LegacySongSnapshot {
    return getSongSnapshot()
  },

  getTrackStringCount(trackId: number): number {
    return getTrackStringCount(trackId)
  },

  getMeasureMeta(blockId: number): TabMeasureMetaData {
    return Song.measureMeta?.[blockId] || Song.defaultMeasureMeta()
  },

  defaultMeasure(): TabBeat {
    return Song.defaultMeasure() as TabBeat
  },

  defaultNote(): TabNoteData {
    return defaultNote()
  },

  getBeat(trackId: number, blockId: number, voiceId: number, beatIndex: number): SongBeat | undefined {
    return getBeat(trackId, blockId, voiceId, beatIndex)
  },

  getNote(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatIndex: number,
    stringIndex: number,
  ): SongNote | null | undefined {
    return getNote(trackId, blockId, voiceId, beatIndex, stringIndex)
  },

  getSelectedNoteState(selection: TabSelectionData | null): SelectedNoteState | null {
    return getSelectedNoteState(selection)
  },

  syncSelection(selection: TabSelectionData | null): void {
    if (!selection) {
      tab.hasExplicitSelection = false
      return
    }

    const { trackId, voiceId, blockId, beatIndex, stringIndex } = selection
    tab.markedNoteObj = { trackId, voiceId, blockId, beatId: beatIndex, string: stringIndex }
    tab.hasExplicitSelection = true
  },

  syncSelectionEffects(selection: TabSelectionData | null): void {
    syncSelectionEffects(selection)
  },

  shouldUseLegacySelectionPresentation(): boolean {
    return !hasRegisteredSelectionSurface()
  },

  copyBeat(trackId: number, blockId: number, voiceId: number, beatIndex: number): TabBeat | null {
    return copyBeat(trackId, blockId, voiceId, beatIndex)
  },

  buildModernTabRows(
    trackId: number,
    voiceId: number,
    measures: Array<TabBeat[][] | undefined>,
    options: ModernLayoutOptions,
  ): RenderedTabRow[] {
    const rows: RenderedTabRow[] = []
    const state = createRenderTrackLayoutState({
      availableWidth: options.availableWidth,
      paddingTop: options.paddingTop,
      tabInformationHeight: options.tabInformationHeight,
    })

    if (measures.length === 0) {
      legacyRenderBridge.setTrackLayout(trackId, voiceId, state)
      return rows
    }

    let currentRowMeasures: RenderedTabRow['measures'] = []
    let currentWidth = TAB_CONSTANTS.TAB_LABEL_WIDTH
    let startBlockId = 0

    for (let blockId = 0; blockId < measures.length; blockId++) {
      const measure = measures[blockId]
      const voiceMeasures = (measure?.[voiceId] || []) as TabBeat[]

      let widthInfo: BlockWidthInfo | null = null
      try {
        Helper.groupMeasureBeats(trackId, blockId, voiceId)
        widthInfo = Tab.computeWidthOfBlock(trackId, blockId, voiceId)
      } catch {
        console.warn(`Failed to compute width for measure ${blockId}, using default.`)
      }

      const measureWidth = widthInfo && Number.isFinite(widthInfo.minWidth) && widthInfo.minWidth > 0
        ? widthInfo.minWidth
        : 200
      const minOffset = widthInfo && Number.isFinite(widthInfo.minOffset) && widthInfo.minOffset > 0
        ? widthInfo.minOffset
        : 40

      if (currentWidth + measureWidth > options.availableWidth && currentRowMeasures.length > 0) {
        const rowId = rows.length
        const yOffset = options.headerHeight + rowId * options.rowHeight
        const rowLayout: RenderRowLayout = { yOffset, height: options.rowHeight }
        state.rowLayouts[rowId] = rowLayout
        rows.push({
          id: rowId,
          measures: currentRowMeasures,
          startBlockId,
          endBlockId: blockId - 1,
          yOffset,
        })
        currentRowMeasures = []
        currentWidth = 0
        startBlockId = blockId
      }

      const rowId = rows.length
      const blockLayout: RenderBlockLayout = {
        xOffset: currentWidth,
        rowId,
        numInRow: currentRowMeasures.length,
        width: measureWidth,
        minOffset,
        pageId: 0,
        beatPositions: getBeatRenderPositions(trackId, blockId, voiceId, voiceMeasures, minOffset),
      }
      state.blockLayouts[blockId] = blockLayout

      currentRowMeasures.push({
        data: voiceMeasures,
        width: measureWidth,
      })
      currentWidth += measureWidth
    }

    if (currentRowMeasures.length > 0) {
      const rowId = rows.length
      const yOffset = options.headerHeight + rowId * options.rowHeight
      const rowLayout: RenderRowLayout = { yOffset, height: options.rowHeight }
      state.rowLayouts[rowId] = rowLayout
      rows.push({
        id: rowId,
        measures: currentRowMeasures,
        startBlockId,
        endBlockId: measures.length - 1,
        yOffset,
      })
    }

    state.numRows = rows.length
    legacyRenderBridge.setTrackLayout(trackId, voiceId, state)

    return rows
  },

  getModernLayout(trackId: number, voiceId: number): RenderTrackLayoutState | null {
    return legacyRenderBridge.getTrackLayout(trackId, voiceId)
  },

  changeNoteDuration(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatIndex: number,
    stringIndex: number,
    durationId: string,
  ): boolean {
    return tab.changeNoteDuration(trackId, blockId, voiceId, beatIndex, stringIndex, durationId, false)
  },

  setNoteAtPosition(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatIndex: number,
    stringIndex: number,
    fret: number,
    numStrings = getTrackStringCount(trackId),
  ): void {
    const beat = ensureBeatAtPosition(trackId, blockId, voiceId, beatIndex, numStrings)

    beat.notes[stringIndex] = fret === -1
      ? null
      : {
          ...defaultNote(),
          fret,
          string: stringIndex,
        }

    notifySongDataChanged()
  },

  setPlaybackBarObject(object: SVGGElement | null) {
    legacyRenderBridge.setPlaybackBarObject(object)
  },

  ensureBeatAtPosition(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatIndex: number,
    numStrings: number,
  ): TabBeat {
    return ensureBeatAtPosition(trackId, blockId, voiceId, beatIndex, numStrings)
  },
}

export { legacyEditorCore }
export default legacyEditorCore