import { BaseModalHandler, ModalState } from './baseModalHandler';
import { MODALS } from './modalTypes';
import { Song } from '../songData';
import { svgDrawer } from '../svgDrawer';
import { reactive } from 'vue';

interface AddChordModalState extends ModalState {
    chordModalData: {
        chordRoot: string;
        chordType: string;
    };
    chordProperties: {
        name: string;
        capo: number;
        currentNotes: number[];
        fingers: number[];
    };
}

export const allChords: {
    [chordName: string]: {
      [chordType: string]: {
        capo: number,
        notes: number[],
        fingers: (number | null)[]
      }
    }
  } = {
    C: {
      maj: { capo: 0, notes: [-1, 3, 2, 0, 1, 0], fingers: [null, 3, 2, null, 1, null] },
      min: { capo: 8, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    },
    'C#': {
      maj: { capo: 9, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
      min: { capo: 9, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    },
    D: {
      maj: { capo: 0, notes: [-1, -1, 0, 2, 3, 2], fingers: [null, null, null, 1, 2, 3] },
      min: { capo: 0, notes: [-1, -1, 0, 2, 3, 1], fingers: [null, null, null, 2, 3, 1] },
    },
    'D#': {
      maj: { capo: 11, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
      min: { capo: 11, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    },
    E: {
      maj: { capo: 0, notes: [0, 2, 2, 1, 0, 0], fingers: [null, 2, 3, 1, null, null] },
      min: { capo: 0, notes: [0, 2, 2, 0, 0, 0], fingers: [null, 2, 3, null, null, null] },
    },
    F: {
      maj: { capo: 1, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
      min: { capo: 1, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    },
    'F#': {
      maj: { capo: 2, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
      min: { capo: 2, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    },
    G: {
      maj: { capo: 0, notes: [3, 2, 0, 0, 0, 3], fingers: [3, 2, null, null, null, 4] },
      min: { capo: 3, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    },
    'G#': {
      maj: { capo: 4, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
      min: { capo: 4, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    },
    A: {
      maj: { capo: 0, notes: [0, 0, 2, 2, 2, 0], fingers: [null, null, 1, 2, 3, null] },
      min: { capo: 0, notes: [0, 0, 2, 2, 1, 0], fingers: [null, null, 2, 3, 1, null] },
    },
    'A#': {
      maj: { capo: 6, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
      min: { capo: 6, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    },
    H: {
      maj: { capo: 2, notes: [-1, 0, 2, 2, 2, 0], fingers: [null, 1, 3, 3, 3, 1] },
      min: { capo: 2, notes: [-1, 1, 2, 2, 1, 0], fingers: [null, 1, 3, 4, 1, 1] },
    },
} as const;

export class AddChordModalHandler extends BaseModalHandler {
    // SVG Constants
    width = 120 as const;
    height = 140 as const;
    numStrings = 6 as const;
    horizontalSteps = 5 as const;
    stringPadding = 10 as const;
    paddingRight = 10 as const;
    paddingLeft = 30 as const;

    constructor() {
        super(MODALS.ADD_CHORD.id, MODALS.ADD_CHORD.name);
        this.modalState = reactive({
            ...this.modalState,
            chordModalData: {
                chordRoot: 'C',
                chordType: 'maj'
            },
            chordProperties: {
                name: '',
                capo: 0,
                currentNotes: [0, 0, 0, 0, 0, 0],
                fingers: Array(6).fill(null)
            }
        } as AddChordModalState);
    }

    getStringY = (index: number) => {
        return ((this.height - 2 * this.stringPadding) / (this.numStrings - 1)) * index + this.stringPadding + this.paddingRight;
    };
      
    getFretX = (fret: number): number => {
        return (this.width / this.horizontalSteps) * fret + this.paddingLeft;
    };

    public handleChordClick(e: MouseEvent): void {
        const svg = e.currentTarget as SVGElement;
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const fret = Math.round((x - this.paddingLeft) / (this.width / this.horizontalSteps));
        const string = Math.round(((y - this.paddingRight) - this.stringPadding) / (this.height - 2 * this.stringPadding) * (this.numStrings - 1));
        if (string >= 0 && string < this.numStrings && fret > 0 && fret <= this.horizontalSteps) {
            const stringIndex = this.numStrings - string - 1;
            const currentNote = this.modalState.chordProperties.currentNotes[stringIndex];
            
            let newNote: number;
            if (currentNote === fret) {
                newNote = -1; // muted
            } else if (currentNote === -1) {
                newNote = 0; // open
            } else {
                newNote = fret;
            }
            this.modalState.chordProperties.currentNotes[stringIndex] = newNote;
        }
    }

    public updateChordNote(stringIndex: number, fret: number): void {
        this.modalState.chordProperties.currentNotes[stringIndex] = fret;
    }

    public updateChordPreset(): void {
        const chord = allChords[this.modalState.chordModalData.chordRoot]?.[this.modalState.chordModalData.chordType];
        if (!chord) return;

        this.modalState.chordProperties.name = `${this.modalState.chordModalData.chordRoot}${this.modalState.chordModalData.chordType}`;
        this.modalState.chordProperties.capo = chord.capo;
        this.modalState.chordProperties.currentNotes = [...chord.notes];
        this.modalState.chordProperties.fingers = [...chord.fingers];
    }

    public saveChord(): void {
        console.log("Saving chord: ", this.modalState);
        const chordObj = {
            capo: this.modalState.chordProperties.capo,
            name: this.modalState.chordProperties.name,
            chordRoot: this.modalState.chordModalData.chordRoot,
            chordType: this.modalState.chordModalData.chordType,
            frets: AddChordModalHandler.computeFretsFromNotesAndCapo(
                this.modalState.chordProperties.currentNotes,
                this.modalState.chordProperties.capo
            ),
            fingers: this.modalState.chordProperties.fingers,
            display: true
        };

        const trackId = Song.currentTrackId;
        if (Song.chordsMap[trackId] == null) {
            Song.chordsMap[trackId] = new Map();
        }

        Song.chordsMap[trackId].set(chordObj.name, chordObj);
        svgDrawer.redrawChordDiagrams();
        this.closeModal();
    }

    private static computeFretsFromNotesAndCapo(notes: number[], capo: number): number[] {
        return notes.map(note => note >= 0 ? note + (capo - 1) : note).reverse();
    }

    public updateCapo(capo: number): void {
        if (capo < 0) {
            this.modalState.chordProperties.capo = 0;
            return;
        }
        
        this.modalState.chordProperties.capo = capo + 1;
    }

    public getCapo(): number {
        return this.modalState.chordProperties.capo - 1;
    }

    public getChordRoot(): string {
        return this.modalState.chordModalData.chordRoot;
    }

    public setChordRoot(root: string): void {
        this.modalState.chordModalData.chordRoot = root;
    }

    public getChordType(): string {
        return this.modalState.chordModalData.chordType;
    }

    public setChordType(type: string): void {
        this.modalState.chordModalData.chordType = type;
    }

    public getModalState(): AddChordModalState {
        return this.modalState as AddChordModalState;
    }

    public openModal(): void {
        this.showModal();
    }

    public setupModalContent(): void {}

    public updateChordRoot(root: string): void {
        this.modalState.chordModalData.chordRoot = root;
        this.updateChordPreset();
    }

    public updateChordType(type: string): void {
        this.modalState.chordModalData.chordType = type;
        this.updateChordPreset();
    }
} 