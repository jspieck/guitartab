import { reactive } from 'vue'
import { createMeasures, createNewTrack } from '../editor/measureStructureCommands'
import { fillMeasures } from '../editor/barFilling'
import { redrawTrack } from '../editor/layoutInvalidation'
import { BaseModalHandler } from './baseModalHandler'
import { DIALOGS } from './dialogs'
import { Track, Song } from '../../stores/song'
import { instrumentGroups, instrumentList } from '../../data/instrumentData'
import { notifySongDataChanged } from '../appEvents'
import { initTrackPlayback } from '../editor/trackLoading'

interface InstrumentGroup {
  title: string
  choices: string[]
}

export class AddTrackModalHandler extends BaseModalHandler {
  private numberOfTrackToAdd: number = -1
  private readonly instrumentGroups: InstrumentGroup[]
  /** What the dialog shows: whether it adds a track or changes one, and that track's instrument. */
  readonly view = reactive({ changing: false, currentInstrument: '', openCount: 0 })

  constructor() {
    super(DIALOGS.ADD_TRACK.id, 'New Instrument')
    this.instrumentGroups = instrumentGroups
  }

  openModal(trackNumber?: number) {
    this.numberOfTrackToAdd = trackNumber ?? -1
    this.view.changing = this.numberOfTrackToAdd >= 0
    this.view.currentInstrument = this.view.changing
      ? (Song.playBackInstrument[this.numberOfTrackToAdd]?.instrument ?? '')
      : ''
    this.view.openCount += 1
    this.showModal()
  }

  public getInstrumentGroups(): InstrumentGroup[] {
    return this.instrumentGroups
  }

  public selectInstrument(choice: string) {
    const instrument = instrumentList[choice]
    if (this.numberOfTrackToAdd < 0) {
      this.addNewInstrument(instrument[2], instrument[1])
    } else {
      this.changeInstrumentForTrack(this.numberOfTrackToAdd, instrument[2], instrument[1])
    }
    this.closeModal()
  }

  private addNewInstrument(instrumentChannel: number, instrumentName: string) {
    const numTracks = Song.measures.length
    const instrObj = {
      name: instrumentName,
      channel: instrumentChannel,
      numStrings: 6,
      strings: [40, 45, 50, 55, 59, 64],
    }
    createNewTrack(numTracks, instrObj)
    createMeasures(numTracks, 0)
    fillMeasures(numTracks, 0)
    notifySongDataChanged()
  }

  private changeInstrumentForTrack(trackNumber: number, instrumentChannel: number, instrumentName: string) {
    const instrObj: Track = {
      channel: { index: instrumentChannel, effectChannel: 0 },
      numStrings: 6,
      strings: [40, 45, 50, 55, 59, 64],
      name: instrumentName,
      capo: 0,
      volume: 127,
      balance: 127,
      color: { red: 1, green: 0, blue: 0 },
      reverb: 0,
      program: 0,
      primaryChannel: 0,
      letItRing: false,
    }

    // Update track data
    let channelId = trackNumber >= 9 ? trackNumber + 1 : trackNumber
    if (instrObj.name === 'Drums') {
      channelId = 9
    }

    // Update channel settings
    Song.allChannels[channelId] = {
      cInstrument: instrObj.channel.index,
      volume: 127,
      balance: 63,
      chorus: 0,
      reverb: 0,
      phaser: 0,
      tremolo: 0,
    }

    // Update track settings
    // playbackInstrumentFor prefers the track's program over its channel, so it must be the instrument.
    Song.tracks[trackNumber] = {
      ...instrObj,
      channel: { index: channelId, effectChannel: 0 },
      color: { red: 0, blue: 127, green: 0 },
      program: instrumentChannel,
      primaryChannel: channelId,
    }

    // A drum track had a line per drum; the new instrument has six strings.
    for (const bar of Song.measures[trackNumber] ?? []) {
      for (const voice of bar) {
        for (const beat of voice) {
          if ((beat.notes?.length ?? 0) > instrObj.numStrings) beat.notes.length = instrObj.numStrings
        }
      }
    }

    // Update playback settings
    Song.playBackInstrument[trackNumber] = {
      volume: 127,
      balance: 63,
      chorus: 0,
      reverb: 0,
      phaser: 0,
      tremolo: 0,
      instrument: instrObj.name,
      solo: false,
      mute: false,
    }

    initTrackPlayback(trackNumber)
    redrawTrack(Song.currentTrackId, Song.currentVoiceId)
    notifySongDataChanged()
  }

  setNumberOfTrackToAdd(trackNumber: number) {
    this.numberOfTrackToAdd = trackNumber
  }
}
