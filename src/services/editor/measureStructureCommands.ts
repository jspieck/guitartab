import fastdom from 'fastdom'
import Song, { type Beat, type MeasureMetaInfo } from '../../assets/js/songData'
import AppManager from '../../assets/js/appManager'
import { sequencerHandler } from '../../assets/js/sequencerHandler'
import { revertHandler } from '../../assets/js/revertHandler'
import { requestDurationRender } from './renderCommands'

/** Host surface for measure-structure mutations (usually the Tab singleton). */
export interface MeasureStructureHost {
  measureOffset: number[][][]
  markedNoteObj: {
    trackId: number
    voiceId: number
    blockId: number
    beatId: number
    string: number
  } | null
  fillMeasure: (trackId: number, blockId: number, voiceId: number) => void
  drawTrack: (trackId: number, voiceId: number, forceScale: boolean, callback: (() => void) | null) => void
}

export function addTakt(
  host: Pick<MeasureStructureHost, 'measureOffset'>,
  trackId: number,
  blockId: number,
  voiceId: number,
): void {
  if (host.measureOffset[trackId] == null) {
    host.measureOffset[trackId] = []
  }
  if (host.measureOffset[trackId][blockId] == null) {
    host.measureOffset[trackId][blockId] = []
  }
  const defaultOffset = 20
  host.measureOffset[trackId][blockId][voiceId] = defaultOffset

  if (!Number.isFinite(host.measureOffset[trackId][blockId][voiceId])) {
    console.warn(`Setting invalid measureOffset, using default: ${defaultOffset}`)
    host.measureOffset[trackId][blockId][voiceId] = defaultOffset
  }
}

export function createTakte(
  host: Pick<MeasureStructureHost, 'measureOffset'>,
  trackId: number,
  voiceId: number,
): void {
  if (host.measureOffset[trackId] == null) {
    host.measureOffset[trackId] = []
  }
  for (let i = 0; i < Song.numMeasures; i += 1) {
    addTakt(host, trackId, i, voiceId)
  }
}

export function addBlock(host: MeasureStructureHost, duringRestoration: boolean): void {
  if (AppManager.duringTrackCreation) {
    return
  }
  const blockId = Song.numMeasures
  for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
    for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
      addTakt(host, trackId, blockId, voiceId)
      Song.initEmptyMeasure(trackId, blockId, voiceId)
      host.fillMeasure(trackId, blockId, voiceId)
      requestDurationRender(trackId, blockId, voiceId)
    }
  }
  Song.measureMeta[blockId].numerator = Song.measureMeta[blockId - 1].numerator
  Song.measureMeta[blockId].denominator = Song.measureMeta[blockId - 1].denominator
  Song.numMeasures += 1
  host.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null)
  sequencerHandler.redrawSequencerMain()
  if (duringRestoration === false) {
    revertHandler.addBlock()
  }
}

export function removeBlock(host: MeasureStructureHost, duringRestoration: boolean): void {
  if (AppManager.duringTrackCreation) {
    return
  }
  fastdom.mutate(() => {
    if (Song.numMeasures <= 1) return
    const blocksBefore: Beat[][][] = []
    Song.numMeasures -= 1
    if (host.markedNoteObj != null) {
      if (host.markedNoteObj.blockId === Song.numMeasures) {
        host.markedNoteObj.blockId -= 1
        host.markedNoteObj.beatId = 0
      }
    }
    for (let i = 0; i < Song.measures.length; i += 1) {
      blocksBefore.push(Song.measures[i].splice(-1)[0])
    }
    const measureMetaBefore = Song.measureMeta.splice(-1)[0] as MeasureMetaInfo
    host.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null)
    sequencerHandler.redrawSequencerMain()
    if (duringRestoration === false) {
      revertHandler.removeBlock(blocksBefore, measureMetaBefore)
      offerUndoOfRemovedBar(Song.numMeasures + 1)
    }
  })
}

// Removing a bar deletes its notes on every track, so offer the undo right where the user looks
// instead of asking first. The button only undoes while the removal is still the last edit.
function offerUndoOfRemovedBar(barNumber: number): void {
  const removal = revertHandler.peekUndo()
  AppManager.showNotification(`Removed bar ${barNumber}`, 'info', {
    label: 'Undo',
    run: () => {
      if (revertHandler.peekUndo() === removal) revertHandler.revertState()
    },
  })
}

export function createNewTrack(
  host: Pick<MeasureStructureHost, 'measureOffset'>,
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
  createTakte(host, trackId, 0)
  AppManager.setTracks(trackId)
}

export function initEmptyTab(): void {
  Song.measureMoveHelper.length = 0
  Song.measureMoveHelper[0] = []

  for (let i = 0; i < Song.numMeasures; i += 1) {
    for (let j = 0; j < Song.numVoices; j += 1) {
      Song.initEmptyMeasure(0, i, j)
    }
  }
}
