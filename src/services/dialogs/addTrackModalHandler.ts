import { createMeasures, createNewTrack } from '../editor/measureStructureCommands'
import { fillMeasures } from '../editor/barFilling'
import { redrawTrack } from '../editor/layoutInvalidation'
import { BaseModalHandler } from './baseModalHandler'
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

  constructor() {
    super('addTrackModal', 'New Instrument')
    this.instrumentGroups = instrumentGroups
  }

  protected setupModalContent(): void {}

  openModal(trackNumber?: number) {
    this.numberOfTrackToAdd = trackNumber ?? -1
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
    Song.tracks[trackNumber] = {
      ...instrObj,
      channel: { index: channelId, effectChannel: 0 },
      color: { red: 0, blue: 127, green: 0 },
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
