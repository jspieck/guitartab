import fastdom from 'fastdom'
import { selectionState } from '../../stores/selectionState'
import Song, { type Beat, type MeasureMetaInfo } from '../../stores/song'
import { cloneData, executeCommand, undoHistory } from './editCommands'
import { requestDurationRender } from './renderCommands'
import { showNotification } from '../../stores/notificationState'
import { initTrackPlayback } from './trackLoading'
import { tabLayout } from '../../stores/tabLayoutState'
import { fillMeasure } from './barFilling'
import { redrawTrack } from './layoutInvalidation'

/** Gives a new bar its default unit width until the layout engine sets the real one. */
export function addMeasureSlot(trackId: number, blockId: number, voiceId: number): void {
  if (tabLayout.measureOffset[trackId] == null) {
    tabLayout.measureOffset[trackId] = []
  }
  if (tabLayout.measureOffset[trackId][blockId] == null) {
    tabLayout.measureOffset[trackId][blockId] = []
  }
  const defaultOffset = 20
  tabLayout.measureOffset[trackId][blockId][voiceId] = defaultOffset

  if (!Number.isFinite(tabLayout.measureOffset[trackId][blockId][voiceId])) {
    console.warn(`Setting invalid measureOffset, using default: ${defaultOffset}`)
    tabLayout.measureOffset[trackId][blockId][voiceId] = defaultOffset
  }
}

export function createMeasures(trackId: number, voiceId: number): void {
  if (tabLayout.measureOffset[trackId] == null) {
    tabLayout.measureOffset[trackId] = []
  }
  for (let i = 0; i < Song.numMeasures; i += 1) {
    addMeasureSlot(trackId, i, voiceId)
  }
}

function appendBar(): void {
  const blockId = Song.numMeasures
  for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
    for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
      addMeasureSlot(trackId, blockId, voiceId)
      Song.initEmptyMeasure(trackId, blockId, voiceId)
      fillMeasure(trackId, blockId, voiceId)
      requestDurationRender(trackId, blockId, voiceId)
    }
  }
  Song.measureMeta[blockId].numerator = Song.measureMeta[blockId - 1].numerator
  Song.measureMeta[blockId].denominator = Song.measureMeta[blockId - 1].denominator
  Song.numMeasures += 1
}

interface RemovedBar {
  /** The bar's voices, per track. */
  tracks: Beat[][][]
  meta: MeasureMetaInfo
}

function removeLastBar(): RemovedBar {
  Song.numMeasures -= 1
  if (selectionState.cursor.blockId >= Song.numMeasures) {
    selectionState.cursor.blockId = Song.numMeasures - 1
    selectionState.cursor.beatId = 0
  }
  const tracks = Song.measures.map((bars) => bars.splice(-1)[0])
  const meta = Song.measureMeta.splice(-1)[0] as MeasureMetaInfo
  return { tracks, meta }
}

function restoreLastBar(bar: RemovedBar): void {
  bar.tracks.forEach((voices, trackId) => Song.measures[trackId]?.push(cloneData(voices)))
  Song.measureMeta.push(cloneData(bar.meta))
  Song.numMeasures += 1
}

function barStructureChanged(): void {
  redrawTrack(Song.currentTrackId, Song.currentVoiceId)
}

/** Appends an empty bar to every track. */
export function addBlock(): void {
  let removed: RemovedBar | null = null
  executeCommand({
    label: 'Add bar',
    apply: appendBar,
    invert: () => {
      removed = removeLastBar()
    },
    afterChange: barStructureChanged,
    adaptToTrackRemove(trackId) {
      removed?.tracks.splice(trackId, 1)
      return true
    },
  })
}

/** Removes the last bar on every track. */
export function removeBlock(): void {
  fastdom.mutate(() => {
    if (Song.numMeasures <= 1) return
    let removed: RemovedBar | null = null
    executeCommand({
      label: 'Remove bar',
      apply: () => {
        removed = removeLastBar()
      },
      invert: () => {
        if (removed) restoreLastBar(removed)
      },
      afterChange: barStructureChanged,
      adaptToTrackRemove(trackId) {
        removed?.tracks.splice(trackId, 1)
        return true
      },
    })
    offerUndoOfRemovedBar(Song.numMeasures + 1)
  })
}

// Removing a bar deletes its notes on every track, so offer the undo right where the user looks
// instead of asking first. The button only undoes while the removal is still the last edit.
function offerUndoOfRemovedBar(barNumber: number): void {
  const removal = undoHistory.peek()
  showNotification(`Removed bar ${barNumber}`, 'info', {
    label: 'Undo',
    run: () => {
      if (undoHistory.peek() === removal) undoHistory.undo()
    },
  })
}

export function createNewTrack(
  trackId: number,
  instrObj: { name: string; channel: number; numStrings: number; strings: number[] },
): void {
  let channelId = trackId >= 9 ? trackId + 1 : trackId
  if (instrObj.name === 'Drums') {
    channelId = 9
  }
  Song.allChannels[channelId] = {
    cInstrument: instrObj.channel,
    volume: 127,
    balance: 63,
    chorus: 0,
    reverb: 0,
    phaser: 0,
    tremolo: 0,
  }
  Song.tracks[trackId] = {
    numStrings: instrObj.numStrings,
    strings: instrObj.strings,
    capo: 0,
    volume: 127,
    balance: 63,
    reverb: 0,
    name: instrObj.name,
    color: { red: 0, blue: 127, green: 0 },
    channel: { index: channelId, effectChannel: 0 },
    program: 0,
    primaryChannel: 0,
    letItRing: false,
  }

  Song.measures[trackId] = []
  Song.measureMoveHelper[trackId] = []

  for (let i = 0; i < Song.numMeasures; i += 1) {
    for (let j = 0; j < Song.numVoices; j += 1) {
      Song.initEmptyMeasure(trackId, i, j)
    }
  }
  createMeasures(trackId, 0)
  initTrackPlayback(trackId)
}
