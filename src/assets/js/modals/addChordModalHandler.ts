import { BaseModalHandler, ModalState } from './baseModalHandler';
import { MODALS } from './modalTypes';
import { Song } from '../songData';
import SvgDrawer, { svgDrawer } from '../svgDrawer';
import { revertHandler } from '../revertHandler';
import EventBus from '../eventBus';
import { Measure, Chord } from '../songData';
import Helper from '../helper';

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
        width: number;
        height: number;
        numStrings: number;
        horizontalSteps: number;
        stringPadding: number;
        paddingRight: number;
        paddingLeft: number;
    };
    allChords: Record<string, any>;
}

const allChords = {
    C: {
        maj: { capo: 0, notes: [-1, 3, 2, 0, 1, 0], fingers: [null, 3, 2, null, 1, null] },
        min: { capo: 8, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    },
    'C#': {
        maj: { capo: 9, notes: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
        min: { capo: 9, notes: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    },
    // ... add other chords from the original implementation
};

export class AddChordModalHandler extends BaseModalHandler {
    private chordDisplayObjects: SVGGElement[] = [];

    constructor() {
        super(MODALS.ADD_CHORD.id, MODALS.ADD_CHORD.name);
        this.modalState = {
            ...this.modalState,
            chordModalData: {
                chordRoot: 'C',
                chordType: 'maj'
            },
            chordProperties: {
                name: '',
                capo: 0,
                currentNotes: [],
                fingers: [],
                width: 120,
                height: 140,
                numStrings: 6,
                horizontalSteps: 5,
                stringPadding: 10,
                paddingRight: 10,
                paddingLeft: 30
            },
            allChords: allChords
        } as AddChordModalState;
    }

    openModal(params: { trackId: number; blockId?: number; voiceId?: number; beatId?: number; beat?: Measure }) {
        this.showModal();
        this.fillChordsPresets(params.trackId);
        this.drawChordEditor();
        
        if (params.blockId !== undefined && params.beat) {
            this.setupChordSelectButton(params.trackId, params.blockId, params.voiceId!, params.beatId!, params.beat);
        } else {
            this.setupGlobalChordSelectButton(params.trackId);
        }
        
        this.drawChord(1, [0, 0, 0, 0, 0, 0], [null, null, null, null, null, null]);
    }

    protected setupModalContent(): void {
        this.initializeChordModalListeners();
    }

    protected initializeChordModalListeners(): void {
        const chordRootSelection = document.getElementById('chordRootSelection') as HTMLSelectElement;
        const chordTypeSelection = document.getElementById('chordTypeSelection') as HTMLSelectElement;
        const chordCapoInput = document.getElementById('chordCapoInput') as HTMLInputElement;
        const chordNameInput = document.getElementById('chordNameInput') as HTMLInputElement;

        chordRootSelection.onchange = () => {
            this.modalState.chordModalData.chordRoot = chordRootSelection.value;
            this.drawChordPreset(this.modalState.chordModalData.chordRoot, this.modalState.chordModalData.chordType);
        };

        chordTypeSelection.onchange = () => {
            this.modalState.chordModalData.chordType = chordTypeSelection.value;
            this.drawChordPreset(this.modalState.chordModalData.chordRoot, this.modalState.chordModalData.chordType);
        };

        chordCapoInput.oninput = () => {
            this.modalState.chordProperties.capo = parseInt(chordCapoInput.value, 10) + 1;
            this.drawChord(
                this.modalState.chordProperties.capo,
                this.modalState.chordProperties.currentNotes,
                this.modalState.chordProperties.fingers
            );
        };

        chordNameInput.onkeyup = () => {
            this.modalState.chordProperties.name = chordNameInput.value;
        };
    }

    private drawChordPreset(chordRoot: string, chordType: string): void {
        const chord = this.modalState.allChords[chordRoot][chordType];
        if (!chord) return;

        this.modalState.chordProperties.name = `${chordRoot}${chordType}`;
        (document.getElementById('chordNameInput') as HTMLInputElement).value = `${chordRoot}${chordType}`;
        
        this.drawChord(chord.capo + 1, chord.notes, chord.fingers);
    }

    private drawChord(capo: number, notes: number[], fingers: (number | null)[]): void {
        const chordDisplay = document.getElementById('chordDisplay')!;
        
        // Clear previous chord display objects
        this.chordDisplayObjects.forEach(obj => obj.parentNode?.removeChild(obj));
        this.chordDisplayObjects = [];

        // Update state
        this.modalState.chordProperties.capo = capo;
        this.modalState.chordProperties.currentNotes = notes;
        (document.getElementById('chordCapoInput') as HTMLInputElement).value = (capo - 1).toString();

        // Draw capo number
        const capoText = capo > 1 ? capo - 1 : capo;
        const capoNum = SvgDrawer.createText(46, 12, capoText.toString(), '12px', '', 'Source Sans Pro');
        chordDisplay.appendChild(capoNum);
        this.chordDisplayObjects.push(capoNum);

        // Draw capo bar if needed
        if (capo > 1) {
            const capoHeight = this.modalState.chordProperties.height + 2 * this.modalState.chordProperties.stringPadding - 10;
            const capoBar = SvgDrawer.createRect(46, 15, 7, capoHeight, '#000', '0', '#000');
            capoBar.setAttribute('rx', '4');
            capoBar.setAttribute('ry', '4');
            chordDisplay.appendChild(capoBar);
            this.chordDisplayObjects.push(capoBar);
        }

        // Draw notes
        notes.forEach((note, i) => this.drawChordNote(note, i, fingers[i], chordDisplay));
    }

    private drawChordNote(note: number, stringIndex: number, finger: number | null, chordDisplay: HTMLElement): void {
        const { height, numStrings, stringPadding, paddingRight } = this.modalState.chordProperties;
        const yPos = ((height - 2 * stringPadding) / (numStrings - 1)) * (numStrings - stringIndex - 1) + stringPadding + paddingRight;

        if (note === -1) {
            // Draw X
            const cross = SvgDrawer.createPath(
                `M13 ${yPos - 3}L19 ${yPos + 3}M13 ${yPos + 3}L19 ${yPos - 3}`, 
                '#333', '1', 'none'
            );
            cross.setAttribute('class', 'chordCross');
            chordDisplay.appendChild(cross);
            this.chordDisplayObjects.push(cross);
            
            cross.onclick = () => {
                this.modalState.chordProperties.currentNotes[stringIndex] = 0;
                this.drawChord(
                    this.modalState.chordProperties.capo,
                    this.modalState.chordProperties.currentNotes,
                    this.modalState.chordProperties.fingers
                );
            };
        } else if (note !== 0) {
            // Draw fretted note
            const fret = this.modalState.chordProperties.capo > 1 ? note + 1 : note;
            const chordCircle = this.placeFingerOnChord(stringIndex, fret, finger, chordDisplay);
            this.chordDisplayObjects.push(chordCircle);
            
            chordCircle.onclick = () => {
                this.modalState.chordProperties.currentNotes[stringIndex] = 0;
                this.drawChord(
                    this.modalState.chordProperties.capo,
                    this.modalState.chordProperties.currentNotes,
                    this.modalState.chordProperties.fingers
                );
            };
        } else {
            // Draw open string
            const circle = SvgDrawer.createCircle(16, yPos, 4, '#333333', '1', 'white');
            chordDisplay.appendChild(circle);
            this.chordDisplayObjects.push(circle);
            
            circle.onclick = () => {
                this.modalState.chordProperties.currentNotes[stringIndex] = -1;
                this.drawChord(
                    this.modalState.chordProperties.capo,
                    this.modalState.chordProperties.currentNotes,
                    this.modalState.chordProperties.fingers
                );
            };
        }
    }

    private placeFingerOnChord(
        string: number,
        fret: number,
        finger: number | null,
        chordDisplay: HTMLElement
    ): SVGGElement {
        const cP = this.modalState.chordProperties;
        const xPos = (cP.width / cP.horizontalSteps) * fret + cP.paddingLeft - 12;
        const yPos = ((cP.height - 2 * cP.stringPadding) / (cP.numStrings - 1)) * (cP.numStrings - string - 1) + cP.stringPadding + cP.paddingRight;
        
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        chordDisplay.appendChild(group);
        
        const pointElem = SvgDrawer.createCircle(xPos + cP.paddingLeft, yPos + cP.paddingRight, 9, 'none', '1', '#123e74');
        group.appendChild(pointElem);
        
        if (finger !== null) {
            group.appendChild(SvgDrawer.createText(xPos - 3, yPos + cP.paddingRight + 4, finger.toString(), '13px', '#fff', 'Source Sans Pro'));
        }
        
        return group;
    }

    private static computeFretsFromNotesAndCapo(notes: number[], capo: number): number[] {
        return notes.map(note => note >= 0 ? note + (capo - 1) : note).reverse();
    }

    private fillChordsPresets(trackId: number): void {
        const chordRootSelection = document.getElementById('chordRootSelection') as HTMLSelectElement;
        const chordTypeSelection = document.getElementById('chordTypeSelection') as HTMLSelectElement;

        // Clear existing options
        Helper.removeAllChildren(chordRootSelection);
        Helper.removeAllChildren(chordTypeSelection);

        // Add chord roots
        Object.keys(this.modalState.allChords).forEach(root => {
            const option = document.createElement('option');
            option.value = root;
            option.textContent = root;
            chordRootSelection.appendChild(option);
        });

        // Add chord types
        const firstRoot = Object.keys(this.modalState.allChords)[0];
        Object.keys(this.modalState.allChords[firstRoot]).forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            chordTypeSelection.appendChild(option);
        });
    }

    private setupChordSelectButton(
        trackId: number, 
        blockId: number, 
        voiceId: number, 
        beatId: number, 
        beat: Measure
    ): void {
        const selectButton = document.getElementById('chordSelectButton');
        if (!selectButton) return;

        selectButton.onclick = () => {
            this.closeModal();
            const chordPresentBefore = beat.chordPresent;
            
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
                display: false
            };

            if (!beat.chordPresent) {
                beat.chordPresent = true;
                EventBus.emit("menu.activateEffectsForBeat", beat);
            }

            const previousChord = beat.chord;
            beat.chord = chordObj;

            let trackRerendered = false;
            if (Song.chordsMap[trackId] == null) {
                Song.chordsMap[trackId] = new Map();
            }
            
            if (Song.chordsMap[trackId].has(chordObj.name)) {
                Song.chordsMap[trackId].set(chordObj.name, {
                    ...chordObj,
                    fingers: this.modalState.chordProperties.fingers,
                    display: true
                });
                trackRerendered = svgDrawer.redrawChordDiagrams();
            }

            if (!trackRerendered) {
                svgDrawer.rerenderBlock(trackId, blockId, voiceId);
            }

            if (previousChord) {
                revertHandler.addChord(
                    trackId, 
                    blockId, 
                    voiceId, 
                    beatId, 
                    previousChord,
                    chordObj, 
                    chordPresentBefore, 
                    beat.chordPresent
                );
            }
        };
    }

    private setupGlobalChordSelectButton(trackId: number): void {
        const selectButton = document.getElementById('chordSelectButton');
        if (!selectButton) return;

        selectButton.onclick = () => {
            this.closeModal();
            
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

            if (Song.chordsMap[trackId] == null) {
                Song.chordsMap[trackId] = new Map();
            }

            Song.chordsMap[trackId].set(chordObj.name, chordObj);
            svgDrawer.redrawChordDiagrams();
        };
    }

    private drawChordEditor(): void {
        const chordDisplay = document.getElementById('chordDisplay')!;
        const { paddingRight, paddingLeft, width, height, stringPadding, numStrings } = this.modalState.chordProperties;

        // Draw the base rectangle
        const rect = SvgDrawer.createRect(paddingLeft, paddingRight, width, height, '', '1', '');
        chordDisplay.appendChild(rect);

        // Draw left side
        const pathEl = SvgDrawer.createPath(
            `M${paddingLeft} ${paddingRight}V${height + paddingRight}`, 
            'rgb(0, 0, 0)', '3', 'none'
        );
        chordDisplay.appendChild(pathEl);

        // Draw frets
        for (let i = 0; i < this.modalState.chordProperties.horizontalSteps; i++) {
            const xPos = (width / this.modalState.chordProperties.horizontalSteps) * (i + 1) + paddingLeft;
            const pathStr = `M${xPos} ${paddingRight}L${xPos} ${height + paddingRight}`;
            const fretEl = SvgDrawer.createPath(pathStr, 'rgb(180, 180, 180)', '1', 'none');
            fretEl.setAttribute('class', 'gridLine');
            chordDisplay.appendChild(fretEl);
        }

        // Draw strings
        for (let i = 0; i < numStrings; i++) {
            const yPos = ((height - 2 * stringPadding) / (numStrings - 1)) * i + stringPadding + paddingRight;
            const pathStr = `M${paddingLeft} ${yPos}L${width + paddingLeft} ${yPos}`;
            const stringEl = SvgDrawer.createPath(pathStr, 'rgb(60, 60, 60)', '1', 'none');
            stringEl.setAttribute('class', 'strongGridLine');
            stringEl.style.pointerEvents = 'none';
            chordDisplay.appendChild(stringEl);
        }

        // Add string labels
        const noteNames = ['E', 'A', 'D', 'G', 'H', 'E'];
        for (let i = 0; i < numStrings; i++) {
            const y = ((height - 2 * stringPadding) / (numStrings - 1)) * i + stringPadding + paddingRight + 3;
            chordDisplay.appendChild(
                SvgDrawer.createText(0, y, noteNames[numStrings - 1 - i], '12px', '', 'Source Sans Pro')
            );
        }

        // Add click handler for placing notes
        rect.addEventListener('mousedown', (e: MouseEvent) => {
            const fret = Math.floor((e.offsetX - paddingLeft) / width * this.modalState.chordProperties.horizontalSteps) + 1;
            const string = Math.round(((e.offsetY - paddingRight) - stringPadding) / (height - 2 * stringPadding) * (numStrings - 1));
            
            if (string >= 0 && string < numStrings) {
                this.modalState.chordProperties.currentNotes[numStrings - string - 1] = fret;
                this.drawChord(
                    this.modalState.chordProperties.capo,
                    this.modalState.chordProperties.currentNotes,
                    this.modalState.chordProperties.fingers
                );
            }
        });
    }
} 