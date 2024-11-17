import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Song } from '../songData';
import { revertHandler } from '../revertHandler';
import { tab } from '../tab';
import Picker from 'vanilla-picker';
import Settings from '../settingManager';
import AppManager from '../appManager';
import { modalManager } from './modalManager';
import { TuningModalHandler } from './tuningModalHandler';

interface InstrumentSettingsState extends ModalState {
    instrumentSettingData: {
        name: string;
        color: { red: number; green: number; blue: number };
        numStrings: number;
        capo: number;
        letItRing: boolean;
    };
    trackId: number;
}

export class InstrumentSettingsModalHandler extends BaseModalHandler {
    readonly modalType = 'InstrumentSettingsModal' as const;

    constructor() {
        super('instrumentSettingsModal', 'Settings');
        this.modalState = {
            ...this.modalState,
            instrumentSettingData: {
                name: '',
                color: { red: 0, green: 0, blue: 0 },
                numStrings: 0,
                capo: 0,
                letItRing: false
            },
            trackId: 0
        } as InstrumentSettingsState;
    }

    openModal(params: { trackId: number }) {
        this.modalState.trackId = params.trackId;
        this.showModal();
    }

    protected setupModalContent(): void {
        this.setInstrumentSettingsState();
        this.setupEventListeners();
    }

    private setInstrumentSettingsState() {
        const { trackId, instrumentSettingData } = this.modalState;
        const track = Song.tracks[trackId];

        // Update state
        instrumentSettingData.name = track.name;
        instrumentSettingData.color = track.color;
        instrumentSettingData.numStrings = track.numStrings;
        instrumentSettingData.capo = track.capo;
        instrumentSettingData.letItRing = track.letItRing;

        // Update DOM
        const ringCheckbox = document.getElementById('ringCheckbox') as HTMLInputElement;
        const stringCountSelect = document.getElementById('stringCountSelect') as HTMLInputElement;
        const instrumentNameInput = document.getElementById('instrumentNameInput') as HTMLInputElement;
        const capoSelect = document.getElementById('capoSelect') as HTMLInputElement;

        ringCheckbox.checked = instrumentSettingData.letItRing;
        instrumentNameInput.value = instrumentSettingData.name;
        stringCountSelect.value = instrumentSettingData.numStrings.toString();
        capoSelect.value = instrumentSettingData.capo.toString();

        this.setupColorPicker();
        modalManager.getHandler<TuningModalHandler>('tuning').constructTuningArea(trackId, false, instrumentSettingData.numStrings);
    }

    private setupColorPicker() {
        const { color } = this.modalState.instrumentSettingData;
        const pickerParent = document.getElementById('instrumentColorPicker')!;
        
        const picker = new Picker({
            parent: pickerParent,
            color: `rgb(${color.red},${color.green},${color.blue})`,
            popup: 'bottom',
        });

        picker.onChange = (color: { rgba: number[] }) => {
            pickerParent.style.backgroundColor = `rgb(${color.rgba[0]},${color.rgba[1]},${color.rgba[2]})`;
            this.modalState.instrumentSettingData.color = {
                red: color.rgba[0],
                green: color.rgba[1],
                blue: color.rgba[2],
            };
        };
    }

    private setupEventListeners() {
        const { trackId, instrumentSettingData } = this.modalState;

        this.setupSelect('instrumentNameInput', (value) => {
            instrumentSettingData.name = value;
        });

        this.setupSelect('stringCountSelect', (value) => {
            instrumentSettingData.numStrings = parseInt(value, 10);
            modalManager.getHandler<TuningModalHandler>('tuning').constructTuningArea(trackId, true, instrumentSettingData.numStrings);
        });

        this.setupSelect('capoSelect', (value) => {
            instrumentSettingData.capo = parseInt(value, 10);
        });

        this.setupSelectButton('instrumentSettingsSelectButton', () => {
            this.handleSettingsSubmit();
        });
    }

    private handleSettingsSubmit() {
        const { trackId, instrumentSettingData } = this.modalState;
        const trackBefore = JSON.parse(JSON.stringify(Song.tracks[trackId]));
        const numStringsBefore = Song.tracks[trackId].numStrings;
        const track = Song.tracks[trackId];

        // Update track data
        track.name = instrumentSettingData.name;
        track.color = instrumentSettingData.color;
        track.numStrings = instrumentSettingData.numStrings;
        track.capo = instrumentSettingData.capo;
        track.letItRing = (document.getElementById('ringCheckbox') as HTMLInputElement).checked;

        // Update strings
        track.strings.length = 0;
        for (let i = 0; i < track.numStrings; i++) {
            const selectEl = document.getElementById(`tuningSelect${i}`) as HTMLInputElement | null;
            if (selectEl) {
                track.strings[i] = parseInt(selectEl.value, 10);
            }
        }

        // Update UI
        if (Settings.sequencerTrackColor) {
            const { red, green, blue } = track.color;
            document.getElementById(`labelImg${trackId}`)!.style.borderLeft = 
                `3px solid rgb(${red}, ${green}, ${blue})`;
        }
        document.getElementById(`instrumentLabel${trackId}`)!.textContent = track.name;
        
        // Handle state changes
        revertHandler.addInstrumentSettings(trackId, trackBefore, track);

        if (numStringsBefore !== track.numStrings) {
            tab.redrawCompleteTrack(trackId);
        }
        
        AppManager.setCapo(instrumentSettingData.capo);
        if (trackId === Song.currentTrackId) {
            tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, () => {
                AppManager.setTrackInstrument(trackId);
            });
        }
    }
}