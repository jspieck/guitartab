import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Song } from '../songData';
import Helper from '../helper';

interface TuningModalState extends ModalState {
    instrumentSettingData: {
        name: string;
        color: { red: number; green: number; blue: number };
        numStrings: number;
        capo: number;
        letItRing: boolean;
    };
    trackId: number;
    hasStringNumberChanged: boolean;
}

export class TuningModalHandler extends BaseModalHandler {
    readonly modalType = 'TuningModal' as const;

    private readonly defaultStringConfiguration: {
        [a: number]: string[],
    } = {
        4: ['E2', 'A2', 'D3', 'G3'],
        5: ['B1', 'E2', 'A2', 'D3', 'G3'],
        6: ['E3', 'A3', 'D4', 'G4', 'B4', 'E5'],
        7: ['B2', 'E3', 'A3', 'D4', 'G4', 'B4', 'E5'],
        8: ['E2', 'B2', 'E3', 'A3', 'D4', 'G4', 'B4', 'E5'],
        9: ['E2', 'B2', 'E3', 'A3', 'D4', 'G4', 'B4', 'E5', 'B5'],
    };

    constructor() {
        super('tuningModal', 'Tuning');
        this.modalState = {
            ...this.modalState,
            instrumentSettingData: {
                name: '',
                color: { red: 255, green: 0, blue: 0 },
                numStrings: 0,
                capo: 0,
                letItRing: false,
            },
            trackId: 0,
            hasStringNumberChanged: false
        } as TuningModalState;
    }

    openModal(params: { 
        trackId: number; 
        hasStringNumberChanged: boolean; 
        numStrings: number 
    }) {
        this.modalState.trackId = params.trackId;
        this.modalState.hasStringNumberChanged = params.hasStringNumberChanged;
        this.modalState.instrumentSettingData.numStrings = params.numStrings;
        this.showModal();
    }

    protected setupModalContent(): void {
        this.constructTuningArea(
            this.modalState.trackId, 
            this.modalState.hasStringNumberChanged, 
            this.modalState.instrumentSettingData.numStrings
        );
    }

    public constructTuningArea(trackId: number, hasStringNumberChanged: boolean, numStrings: number) {
        const tuningArea = document.getElementById('tuningAreaModal')!;
        Helper.removeAllChildren(tuningArea);
        
        for (let i = 0; i < numStrings; i++) {
            const tuningSelectBox = this.createTuningSelect(i, trackId, hasStringNumberChanged, numStrings);
            tuningArea.appendChild(tuningSelectBox);
        }
    }

    private createTuningSelect(
        stringIndex: number, 
        trackId: number, 
        hasStringNumberChanged: boolean,
        numStrings: number
    ): HTMLElement {
        const selectBox = document.createElement('div');
        selectBox.className = 'select';
        
        const select = this.createSelectElement(
            stringIndex, 
            trackId, 
            hasStringNumberChanged,
            numStrings
        );
        
        selectBox.appendChild(select);
        selectBox.appendChild(this.createSelectArrow());
        
        return selectBox;
    }

    createSelectElement(
        stringIndex: number, 
        trackId: number, 
        hasStringNumberChanged: boolean,
        numStrings: number
    ): HTMLSelectElement {
        const tuningSelect = document.createElement('select');
        tuningSelect.setAttribute('id', `tuningSelect${stringIndex}`);
        // construct options
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        for (let j = 0; j <= 9; j += 1) {
          for (let k = 0; k < notes.length; k += 1) {
            const tuningOption = document.createElement('option');
            const noteString = `${notes[k]}${j}`;
            const numericalNoteValue = notes.length * j + k;
            tuningOption.setAttribute('value', numericalNoteValue.toString());
            tuningOption.textContent = noteString;
            tuningSelect.appendChild(tuningOption);
            const { numStrings } = this.modalState.instrumentSettingData;
            if (hasStringNumberChanged
              && noteString === this.defaultStringConfiguration[numStrings][stringIndex]) {
              tuningSelect.options.selectedIndex = numericalNoteValue;
            }
          }
        }
        if (!hasStringNumberChanged) {
          tuningSelect.options.selectedIndex = Song.tracks[trackId].strings[stringIndex];
        }
        return tuningSelect;
    }

    createSelectArrow(): HTMLElement {
        const selectArrow = document.createElement('div');
        selectArrow.setAttribute('class', 'select__arrow');
        return selectArrow;
    }
} 