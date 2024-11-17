import { BaseModalHandler } from './baseModalHandler';
import { Track, Song } from '../songData';
import { tab } from '../tab';
import AppManager from '../appManager';
import { instrumentGroups, instrumentList } from '../instrumentData';

interface InstrumentGroup {
    title: string;
    choices: string[];
    visible: boolean;
}

export class AddTrackModalHandler extends BaseModalHandler {
    private numberOfTrackToAdd: number = -1;
    public instrumentGroups: InstrumentGroup[];

    constructor() {
        super('addTrackModal', 'New Instrument');
        this.instrumentGroups = instrumentGroups.map(group => ({
            ...group,
            visible: false
        }));
    }

    openModal(trackNumber?: number) {
        this.numberOfTrackToAdd = trackNumber ?? -1;
        this.showModal();
    }

    protected setupModalContent(): void {
        // The actual setup is handled by the Vue component
    }

    toggleVisibility(index: number) {
        this.instrumentGroups[index].visible = !this.instrumentGroups[index].visible;
    }

    selectInstrument(choice: string) {
        const instrument = instrumentList[choice];
        if (this.numberOfTrackToAdd < 0) {
            this.addNewInstrument(instrument[2], instrument[1]);
        } else {
            this.changeInstrumentForTrack(this.numberOfTrackToAdd, instrument[2], instrument[1]);
        }
        this.closeModal();
    }

    private addNewInstrument(instrumentChannel: number, instrumentName: string) {
        const numTracks = Song.measures.length;
        const instrObj = {
            name: instrumentName,
            channel: instrumentChannel,
            numStrings: 6,
            strings: [40, 45, 50, 55, 59, 64],
        };
        
        tab.createNewTrack(numTracks, instrObj);
        tab.createTakte(numTracks, 0);
        tab.fillMeasures(numTracks, 0);
    }

    private changeInstrumentForTrack(
        trackNumber: number,
        instrumentChannel: number,
        instrumentName: string
    ) {
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
        };

        // Update track data
        let channelId = (trackNumber >= 9) ? trackNumber + 1 : trackNumber;
        if (instrObj.name === 'Drums') {
            channelId = 9;
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
        };

        // Update track settings
        Song.tracks[trackNumber] = {
            ...instrObj,
            channel: { index: channelId, effectChannel: 0 },
            color: { red: 0, blue: 127, green: 0 },
        };

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
        };

        AppManager.setTracks(trackNumber);
        tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    }

    setNumberOfTrackToAdd(trackNumber: number) {
        this.numberOfTrackToAdd = trackNumber;
    }
} 