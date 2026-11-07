import { changeNoteDuration } from './durationCommands'
import { deleteNote } from './noteCommands'
import { tabDurationHost } from './durationEditing'
import { setFret } from './noteCommands'
import { selectionState } from '../../stores/selectionState'
import { notifySongDataChanged as publishSongDataChanged } from '../appEvents'
import playback from '../playback'
import Song, {
  type Beat as SongBeat,
  type MeasureMetaInfo,
  type Note as SongNote,
  type PlayBackInstrument,
  type SongDescription,
  type Track,
} from '../../stores/song'
import { hasRegisteredSelectionSurface } from '../../stores/selectionSurfaceState'
import { songState } from '../../stores/songState'
import { DURATION_NAMES } from '../../utils/musicUtils'
import type {
  BeatDuration,
  RenderedTabRow,
  SelectedNoteState,
  TabBeat,
  TabMeasureMetaData,
  TabNoteData,
  TabSelectionData,
} from '../../types/tab'
import renderBridge, { type RenderTrackLayoutState } from './renderBridge'
import { computeTrackLayout } from './measureLayoutEngine'
import { computeScoreLayout, scoreTrackIds } from './scoreLayout'

export interface SongSnapshot {
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
  /** @deprecated Rows are sized from their content. Ignored. */
  rowHeight?: number
  paddingTop: number
  tabInformationHeight: number
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function getSongSnapshot(): SongSnapshot {
  return {
    measures: songState.measures,
    songDescription: songState.songDescription,
    tracks: songState.tracks,
    measureMeta: songState.measureMeta,
    playBackInstrument: songState.playBackInstrument,
    currentTrackId: songState.currentTrackId,
    currentVoiceId: songState.currentVoiceId,
  }
}

function getTrackStringCount(trackId: number): number {
  return songState.tracks?.[trackId]?.numStrings || songState.tracks?.[trackId]?.strings?.length || 6
}

function defaultNote(): TabNoteData {
  return Song.defaultNote() as TabNoteData
}

function getBeat(trackId: number, blockId: number, voiceId: number, beatIndex: number): SongBeat | undefined {
  return songState.measures?.[trackId]?.[blockId]?.[voiceId]?.[beatIndex]
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

  const beat = getBeat(selection.trackId, selection.blockId, selection.voiceId, selection.beatIndex) as
    TabBeat | undefined
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

  playback.setPlayPosition(selection.trackId, selection.blockId, selection.voiceId, selection.beatIndex)
}

function ensureBeatAtPosition(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatIndex: number,
  numStrings: number,
): TabBeat {
  if (!songState.measures[trackId]) songState.measures[trackId] = []
  if (!songState.measures[trackId][blockId]) songState.measures[trackId][blockId] = []
  if (!songState.measures[trackId][blockId][voiceId]) songState.measures[trackId][blockId][voiceId] = []

  if (!songState.measures[trackId][blockId][voiceId][beatIndex]) {
    const defaultBeat = Song.defaultMeasure() as TabBeat
    defaultBeat.duration = 'q'
    defaultBeat.notes = new Array(numStrings).fill(null)
    songState.measures[trackId][blockId][voiceId][beatIndex] = defaultBeat
  }

  const beat = songState.measures[trackId][blockId][voiceId][beatIndex] as TabBeat
  if (!beat.notes) {
    beat.notes = new Array(numStrings).fill(null)
  }

  return beat
}

function getVoiceBeatCount(trackId: number, blockId: number, voiceId: number): number {
  return songState.measures?.[trackId]?.[blockId]?.[voiceId]?.length ?? 0
}

function findPreviousNoteOnString(
  trackId: number,
  blockId: number,
  voiceId: number,
  beatId: number,
  stringIndex: number,
): { blockId: number; beatId: number } | null {
  for (let currentBlockId = blockId; currentBlockId >= 0; currentBlockId -= 1) {
    const startBeatId =
      currentBlockId === blockId ? beatId - 1 : getVoiceBeatCount(trackId, currentBlockId, voiceId) - 1

    for (let currentBeatId = startBeatId; currentBeatId >= 0; currentBeatId -= 1) {
      const note = getNote(trackId, currentBlockId, voiceId, currentBeatId, stringIndex)
      if (note != null) {
        return { blockId: currentBlockId, beatId: currentBeatId }
      }
    }
  }

  return null
}

const editorCore = {
  ensureSongInitialized(): boolean {
    if (!songState.measures || songState.measures.length === 0) {
      Song.initEmptySong()
      return true
    }

    return false
  },

  notifySongDataChanged(): void {
    publishSongDataChanged()
  },

  getSongSnapshot(): SongSnapshot {
    return getSongSnapshot()
  },

  getTrackStringCount(trackId: number): number {
    return getTrackStringCount(trackId)
  },

  getMeasureMeta(blockId: number): TabMeasureMetaData {
    return songState.measureMeta?.[blockId] || Song.defaultMeasureMeta()
  },

  findPreviousNoteOnString(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
    stringIndex: number,
  ): { blockId: number; beatId: number } | null {
    return findPreviousNoteOnString(trackId, blockId, voiceId, beatId, stringIndex)
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
      selectionState.hasExplicitSelection = false
      return
    }

    const { trackId, voiceId, blockId, beatIndex, stringIndex } = selection
    selectionState.cursor = { trackId, voiceId, blockId, beatId: beatIndex, string: stringIndex }
    selectionState.hasExplicitSelection = true
  },

  syncSelectionEffects(selection: TabSelectionData | null): void {
    syncSelectionEffects(selection)
  },

  shouldUseDomSelectionPresentation(): boolean {
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
    const score = scoreTrackIds()
    if (score != null) return computeScoreLayout(score, trackId, voiceId, options)
    return computeTrackLayout(trackId, voiceId, measures, options).rows
  },

  getModernLayout(trackId: number, voiceId: number): RenderTrackLayoutState | null {
    return renderBridge.getTrackLayout(trackId, voiceId)
  },

  changeNoteDuration(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatIndex: number,
    stringIndex: number,
    durationId: BeatDuration,
  ): boolean {
    return changeNoteDuration(tabDurationHost, trackId, blockId, voiceId, beatIndex, stringIndex, durationId)
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
    ensureBeatAtPosition(trackId, blockId, voiceId, beatIndex, numStrings)
    selectionState.cursor = {
      trackId,
      voiceId,
      blockId,
      beatId: beatIndex,
      string: stringIndex,
    }

    if (fret === -1) {
      deleteNote(trackId, blockId, voiceId, beatIndex, stringIndex, false)
    } else {
      setFret(trackId, blockId, voiceId, beatIndex, stringIndex, fret, false)
    }

    publishSongDataChanged()
  },

  setPlaybackBarObject(object: SVGGElement | null) {
    renderBridge.setPlaybackBarObject(object)
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

  getPlayBackInstrument(trackId: number) {
    return songState.playBackInstrument?.[trackId] ?? null
  },

  getTrackCount(): number {
    return songState.measures?.length ?? 0
  },

  canDeleteTrack(): boolean {
    return (songState.measures?.length ?? 0) > 1
  },

  setTrackName(trackId: number, name: string): void {
    if (!songState.tracks?.[trackId]) {
      return
    }
    songState.tracks[trackId].name = name
    publishSongDataChanged()
  },

  isBeatEmpty(trackId: number, blockId: number): boolean {
    return Song.isBeatEmpty(trackId, blockId)
  },

  togglePlayBackInstrumentFlag(trackId: number, flag: 'solo' | 'mute'): void {
    const instrument = songState.playBackInstrument?.[trackId]
    if (!instrument) {
      return
    }
    instrument[flag] = !instrument[flag]
    publishSongDataChanged()
  },

  setPlayBackInstrumentEffect(
    trackId: number,
    effect: 'balance' | 'reverb' | 'chorus' | 'phaser',
    value: number,
  ): void {
    const instrument = songState.playBackInstrument?.[trackId]
    if (!instrument) {
      return
    }
    instrument[effect] = value
  },
}

export { editorCore }
export default editorCore
