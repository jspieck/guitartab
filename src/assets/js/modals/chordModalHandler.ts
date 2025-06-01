import { BaseModalHandler } from './baseModalHandler';
import { Chord, Note } from '../songData';
import { svgDrawer, SvgDrawer } from '../svgDrawer';
import { Song, Measure } from '../songData';
import Helper from '../helper';
import EventBus from '../eventBus';
import { revertHandler } from '../revertHandler';
import { ModalState } from './baseModalHandler';
import { MODALS } from './modalTypes';

interface ChordModalState extends ModalState {
    chordModalData: {
        chordRoot: string;
        chordType: string;
    };
    chordProperties: {
        name: string;
        capo: number;
        currentNotes: number[];
        fingers: (number | null)[];
        width: number;
        height: number;
        numStrings: number;
        horizontalSteps: number;
        stringPadding: number;
        paddingRight: number;
        paddingLeft: number;
    };
    chordDisplayObjects: SVGElement[];
    allChords: {
        [key: string]: {
            [key: string]: {
                notes: number[];
                fingers: (number | null)[];
                capo: number;
            };
        };
    };
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
};

interface ChordModalParams {
    trackId: number;
    blockId: number;
    voiceId: number;
    beatId: number;
    beat: Measure;
    isGlobal?: boolean;
}

export class ChordModalHandler extends BaseModalHandler {
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
            chordDisplayObjects: [],
            allChords: allChords
        } as ChordModalState;
    }

    openModal(params: ChordModalParams) {
        if (params.isGlobal) {
            this.openChordModalGlobal(params.trackId);
        } else {
            this.openChordModalForBeat(
                params.trackId,
                params.blockId,
                params.voiceId,
                params.beatId,
                params.beat
            );
        }
    }

    private openChordModalGlobal(trackId: number) {
        this.modalState.modalId = 'ChordModal';
        this.modalState.modalName = 'Chord';
        this.fillChordsPresets(trackId);
        this.drawChordEditor();
        this.drawChord(1, [0, 0, 0, 0, 0, 0], [null, null, null, null, null, null]);
        this.showModal();
    }

    private openChordModalForBeat(
        trackId: number,
        blockId: number,
        voiceId: number,
        beatId: number,
        beat: Measure
    ) {
        this.modalState.modalId = 'ChordModal';
        this.modalState.modalName = 'Chord';
        this.fillChordsPresets(trackId);
        this.drawChordEditor();
        this.setupChordSelectButton(trackId, blockId, voiceId, beatId, beat);
        this.drawChord(1, [0, 0, 0, 0, 0, 0], [null, null, null, null, null, null]);
        this.showModal();
    }

    protected setupModalContent(): void {
        // Handled by vue component
    }

    private initializeChordModalListeners() {
        const elements = {
            root: document.getElementById('chordRootSelection') as HTMLSelectElement,
            type: document.getElementById('chordTypeSelection') as HTMLSelectElement,
            capo: document.getElementById('chordCapoInput') as HTMLInputElement,
            name: document.getElementById('chordNameInput') as HTMLInputElement
        };

        elements.root.onchange = () => {
            this.modalState.chordModalData.chordRoot = elements.root.options[elements.root.selectedIndex].value;
            this.drawChordPreset(this.modalState.chordModalData.chordRoot, this.modalState.chordModalData.chordType);
        };

        elements.type.onchange = () => {
            this.modalState.chordModalData.chordType = elements.type.options[elements.type.selectedIndex].value;
            this.drawChordPreset(this.modalState.chordModalData.chordRoot, this.modalState.chordModalData.chordType);
        };

        elements.capo.oninput = () => {
            this.modalState.chordProperties.capo = parseInt(elements.capo.value, 10) + 1;
            this.drawChord(
                this.modalState.chordProperties.capo, 
                this.modalState.chordProperties.currentNotes,
                this.modalState.chordProperties.fingers
            );
        };

        elements.name.onkeyup = () => {
            this.modalState.chordProperties.name = elements.name.value;
        };
    }

    drawChordPreset(chordNoteName: string, chordType: string) {
        const chord = this.modalState.allChords[chordNoteName][chordType].notes;
        const { fingers } = this.modalState.allChords[chordNoteName][chordType];
        this.modalState.chordProperties.name = `${chordNoteName}${chordType}`;
        (document.getElementById('chordNameInput') as HTMLInputElement).value = `${chordNoteName}${chordType}`;
        if (chord == null) {
            return;
        }
        this.drawChord(this.modalState.allChords[chordNoteName][chordType].capo + 1, chord, fingers);
    }

    placeFingerOnChord(
        string: number, fret: number, finger: number | null, chordDisplay: HTMLElement,
    ) {
        const cP = this.modalState.chordProperties;
        const xPos = (cP.width / cP.horizontalSteps) * fret + cP.paddingLeft - 12;
        const yPos = ((cP.height - 2 * cP.stringPadding) / (cP.numStrings - 1))
            * (cP.numStrings - string - 1) + cP.stringPadding + cP.paddingRight;
        const fingerText = finger != null ? finger.toString() : '';
        return SvgDrawer.drawPoint(xPos, yPos, 0, 0, 9, chordDisplay as unknown as SVGElement, fingerText);
    }

    drawChord(capo: number, chord: number[], fingers: (number | null)[]) {
        const chordDisplay = document.getElementById('chordDisplay')!;
        for (let i = 0, n = this.modalState.chordDisplayObjects.length; i < n; i += 1) {
            const chordDisplayObjs = this.modalState.chordDisplayObjects[i];
            if (chordDisplayObjs != null && chordDisplayObjs.parentNode != null) {
                chordDisplayObjs.parentNode.removeChild(this.modalState.chordDisplayObjects[i]);
            }
        }
        this.modalState.chordProperties.capo = capo;
        this.modalState.chordProperties.currentNotes = chord;
        (document.getElementById('chordCapoInput') as HTMLInputElement).value = (capo - 1).toString();
        this.modalState.chordDisplayObjects.length = 0;
        const capoText = capo > 1 ? capo - 1 : capo;
        const capoNum = SvgDrawer.createText(46, 12, capoText.toString(), '12px', '', 'Source Sans Pro');
        chordDisplay.appendChild(capoNum);
        this.modalState.chordDisplayObjects.push(capoNum);

        const {
            height, numStrings, stringPadding, paddingRight,
        } = this.modalState.chordProperties;
        if (capo > 1) {
            const capoHeight = height + 2 * stringPadding - 10;
            const capoDrawn = SvgDrawer.createRect(46, 15, 7, capoHeight, '#000', '0', '#000');
            capoDrawn.setAttribute('rx', '4');
            capoDrawn.setAttribute('ry', '4');
            chordDisplay.appendChild(capoDrawn);
            this.modalState.chordDisplayObjects.push(capoDrawn);
        }
        for (let i = 0; i < 6; i += 1) {
            if (chord[i] === -1) {
                const yPos = (height - 2 * stringPadding) / ((numStrings - 1) * (numStrings - i - 1))
                    + stringPadding + paddingRight;
                const cross = SvgDrawer.createPath(`M13 ${yPos - 3}L19 ${yPos + 3}M13 ${yPos + 3}L19 ${yPos - 3}`, '#333', '1', 'none');
                cross.setAttribute('class', 'chordCross');
                chordDisplay.appendChild(cross);
                this.modalState.chordDisplayObjects.push(cross);
                cross.onclick = () => {
                    this.modalState.chordProperties.currentNotes[i] = 0;
                    this.drawChord(this.modalState.chordProperties.capo, this.modalState.chordProperties.currentNotes,
                        this.modalState.chordProperties.fingers);
                };
            } else if (chord[i] !== 0) {
                const fret = capo > 1
                    ? chord[i] + 1
                    : chord[i];
                const chordCircle = this.placeFingerOnChord(i, fret, fingers[i], chordDisplay);
                this.modalState.chordDisplayObjects.push(chordCircle as SVGGElement);
                chordCircle.onclick = () => {
                    this.modalState.chordProperties.currentNotes[i] = 0;
                    this.drawChord(this.modalState.chordProperties.capo, this.modalState.chordProperties.currentNotes,
                        this.modalState.chordProperties.fingers);
                };
            } else {
                const yPos = (height - 2 * stringPadding) / ((numStrings - 1)
                    * (numStrings - i - 1)) + stringPadding + paddingRight;
                const circle = SvgDrawer.createCircle(16, yPos, 4, '#333333', '1', 'white');
                chordDisplay.appendChild(circle);
                this.modalState.chordDisplayObjects.push(circle);

                circle.onclick = () => {
                    this.modalState.chordProperties.currentNotes[i] = -1;
                    this.drawChord(this.modalState.chordProperties.capo, this.modalState.chordProperties.currentNotes,
                        this.modalState.chordProperties.fingers);
                };
            }
        }
    }

    private setChordState(chord: Chord | null) {
        // default values
        const chordRoot = 'C';
        const chordType = 'maj';
        this.modalState.chordModalData.chordRoot = chordRoot;
        this.modalState.chordModalData.chordType = chordType;
        this.modalState.chordProperties.name = 'Cmaj';
        this.modalState.chordProperties.currentNotes = this.modalState.allChords[chordRoot][chordType].notes;
        this.modalState.chordProperties.capo = 1;
        // already set values
        this.modalState.chordProperties.fingers = [];
        if (chord != null) {
            this.modalState.chordModalData.chordRoot = chord.chordRoot;
            this.modalState.chordModalData.chordType = chord.chordType;
            this.modalState.chordProperties.name = chord.name;
            for (let i = 0; i < 6; i += 1) {
                this.modalState.chordProperties.currentNotes[i] = chord.frets[i];
                if (chord.frets[i] > 0) {
                    this.modalState.chordProperties.currentNotes[i] -= (chord.capo - 1);
                    // console.log(this.chordProperties.currentNotes[i]);
                }
            }
            this.modalState.chordProperties.capo = chord.capo;
        }
        (document.getElementById('chordRootSelection') as HTMLSelectElement).value = this.modalState.chordModalData.chordRoot;
        (document.getElementById('chordTypeSelection') as HTMLSelectElement).value = this.modalState.chordModalData.chordType;
        (document.getElementById('chordNameInput') as HTMLInputElement).value = this.modalState.chordProperties.name;

        this.drawChord(this.modalState.chordProperties.capo, this.modalState.chordProperties.currentNotes,
            this.modalState.chordProperties.fingers);
    }

    public drawChordEditor() {
        const chordDisplay = document.getElementById('chordDisplay')!;
        const { paddingRight } = this.modalState.chordProperties;
        const { paddingLeft } = this.modalState.chordProperties;
        const { width } = this.modalState.chordProperties;
        const { height } = this.modalState.chordProperties;
        const { stringPadding } = this.modalState.chordProperties;

        const rect = SvgDrawer.createRect(paddingLeft, paddingRight, width, height, '', '1', '');
        chordDisplay.appendChild(rect);

        // draw left side
        const pathEl = SvgDrawer.createPath(`M${paddingLeft} ${paddingRight}V${height + paddingRight}`, 'rgb(0, 0, 0)', '3', 'none');
        chordDisplay.appendChild(pathEl);
        // Draw 5 frets
        const HOSTEPS = this.modalState.chordProperties.horizontalSteps;
        for (let i = 0; i < HOSTEPS; i += 1) {
            const xPos = (width / HOSTEPS) * (i + 1) + paddingLeft;
            const pathStr = `M${xPos} ${paddingRight}L${xPos} ${height + paddingRight}`;
            const fretEl = SvgDrawer.createPath(pathStr, 'rgb(180, 180, 180)', '1', 'none');
            fretEl.setAttribute('class', 'gridLine');
            chordDisplay.appendChild(fretEl);
        }
        // draw horizontal lines
        const NUMSTRINGS = this.modalState.chordProperties.numStrings;
        for (let i = 0; i < NUMSTRINGS; i += 1) {
            const yPos = ((height - 2 * stringPadding) / (NUMSTRINGS - 1)) * i
                + stringPadding + paddingRight;
            const pathStr = `M${paddingLeft} ${yPos}L${width + paddingLeft} ${yPos}`;
            const stringEl = SvgDrawer.createPath(pathStr, 'rgb(60, 60, 60)', '1', 'none');
            stringEl.setAttribute('class', 'strongGridLine');
            stringEl.style.pointerEvents = 'none';
            chordDisplay.appendChild(stringEl);
        }
        // name notes
        const noteNames = ['E', 'A', 'D', 'G', 'H', 'E'];
        for (let i = 0; i < NUMSTRINGS; i += 1) {
            const y = ((height - 2 * stringPadding) / (NUMSTRINGS - 1)) * i
                + stringPadding + paddingRight + 3;
            chordDisplay.appendChild(SvgDrawer.createText(0, y, noteNames[NUMSTRINGS - 1 - i], '12px', '', 'Source Sans Pro'));
        }
        rect.addEventListener('mousedown', (e: MouseEvent) => {
            const fret = (Math.floor((e.offsetX - paddingLeft) / width) * HOSTEPS) + 1;
            const string = (Math.round(((e.offsetY - paddingRight) - stringPadding)
                / (height - 2 * stringPadding)) * (NUMSTRINGS - 1));
            if (string >= 0 && string < NUMSTRINGS) {
                const { currentNotes } = this.modalState.chordProperties;
                currentNotes[NUMSTRINGS - string - 1] = fret;
                this.drawChord(this.modalState.chordProperties.capo, currentNotes, this.modalState.chordProperties.fingers);
            }
        });
        this.drawChordPreset('C', 'maj');
    }

    private computeNotesFromFretAndCapo(frets: number[], capo: number) {
        const notes = [];
        for (let i = 0; i < 6; i += 1) {
            notes[5 - i] = frets[i];
            if (frets[i] > 0) {
                notes[5 - i] -= (capo - 1);
            }
        }
        return notes;
    }

    fillChordsPresets(trackId: number) {
        const usedChordSelection = document.getElementById('usedChordSelection') as HTMLSelectElement;
        Helper.removeAllChildren(usedChordSelection);
        for (const chord of Song.chordsMap[trackId].values()) {
            const chordOption = document.createElement('option');
            chordOption.setAttribute('value', chord.name);
            chordOption.textContent = chord.name;
            usedChordSelection.appendChild(chordOption);
        }
        usedChordSelection.onfocus = () => {
            usedChordSelection.selectedIndex = -1;
        };
        usedChordSelection.onchange = () => {
            const chordName = usedChordSelection.options[usedChordSelection.selectedIndex].value;
            const chord = Song.chordsMap[trackId].get(chordName);
            if (chord != null) {
                (document.getElementById('chordRootSelection') as HTMLInputElement).value = chord.chordRoot;
                (document.getElementById('chordTypeSelection') as HTMLInputElement).value = chord.chordType;
                (document.getElementById('chordNameInput') as HTMLInputElement).value = chord.name;
                this.modalState.chordModalData.chordRoot = chord.chordRoot;
                this.modalState.chordModalData.chordType = chord.chordType;
                this.modalState.chordProperties.name = chord.name;

                const notes = this.computeNotesFromFretAndCapo(chord.frets, chord.capo);
                this.drawChord(chord.capo, notes, chord.fingers);
            }
        };
    }

    public setupGlobalChordSelectButton(trackId: number) {
        this.setupSelectButton('chordSelectButton', () => {
            const chordObj = {
                capo: this.modalState.chordProperties.capo,
                name: this.modalState.chordProperties.name,
                chordRoot: this.modalState.chordModalData.chordRoot,
                chordType: this.modalState.chordModalData.chordType,
                frets: [] as number[],
                fingers: this.modalState.chordProperties.fingers,
                display: true,
            };

            chordObj.frets = this.computeFretsFromNotesAndCapo(
                this.modalState.chordProperties.currentNotes,
                chordObj.capo
            );

            if (Song.chordsMap[trackId] == null) {
                Song.chordsMap[trackId] = new Map();
            }

            if (!Song.chordsMap[trackId].has(chordObj.name)) {
                Song.chordsMap[trackId].set(chordObj.name, chordObj);
                this.fillChordsPresets(trackId);
                this.createChordManager(trackId);
                svgDrawer.redrawChordDiagrams();
            }
        });
    }

    private setupChordSelectButton(
        trackId: number, 
        blockId: number, 
        voiceId: number, 
        beatId: number, 
        beat: Measure
    ) {
        this.setupSelectButton('chordSelectButton', () => {
            const chordPresentBefore = beat.chordPresent;
            const chordObj = {
                capo: this.modalState.chordProperties.capo,
                name: this.modalState.chordProperties.name,
                chordRoot: this.modalState.chordModalData.chordRoot,
                chordType: this.modalState.chordModalData.chordType,
                frets: [] as number[],
                fingers: [],
                display: false,
            };

            if (!beat.chordPresent) {
                beat.chordPresent = true;
                EventBus.emit("menu.activateEffectsForBeat", beat);
            }

            chordObj.frets = this.computeFretsFromNotesAndCapo(
                this.modalState.chordProperties.currentNotes,
                chordObj.capo
            );

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
                    display: true,
                });
                this.fillChordsPresets(trackId);
                this.createChordManager(trackId);
                trackRerendered = svgDrawer.redrawChordDiagrams();
            }

            if (!trackRerendered) {
                svgDrawer.rerenderBlock(trackId, blockId, voiceId);
            }

            if (previousChord != null) {
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
        });
    }

    private computeFretsFromNotesAndCapo(notes: number[], capo: number): number[] {
        return notes.map(note => note === -1 ? -1 : note === 0 ? 0 : note + (capo - 1));
    }

    createChordManager(trackId: number) {
        const container = document.getElementById('chordsContainer')!;
        Helper.removeAllChildren(container);
        
        Array.from(Song.chordsMap[trackId].entries())
            .forEach(([chordName, chord], index) => {
                const chordBox = this.createChordBox(trackId, chordName, chord, index);
                container.appendChild(chordBox);
            });
        document.getElementById('addChordDiagram')?.addEventListener('click', () => {
            this.openChordModalGlobal(trackId);
        });
    }

    openChordManager(trackId: number) {
        this.createChordManager(trackId);
        document.getElementById('chordDiagramSelectButton')!.onclick = null;
        document.getElementById('chordDiagramSelectButton')!.onclick = () => {
          svgDrawer.redrawChordDiagrams();
          this.closeModal();
        };
        this.showModal();
    }

    private createChordBox(trackId: number, chordName: string, chord: Chord, chordCounter: number): HTMLElement {
        const box = document.createElement('div');
        box.className = 'chordBox';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('id', `chordOverview${chordCounter}`);
        if (!chord.display) {
          svg.classList.add('hideChord');
        }
        const chordDia = svgDrawer.createChordDiagram(chord);
        chordDia.setAttribute('transform', 'translate(20, 40)');
        svg.appendChild(chordDia);
        box.appendChild(svg);
        const removeChord = document.createElement('div');
        const removeImg = document.createElement('img');
        removeImg.setAttribute('src', './images/trashCan.svg');
        removeChord.appendChild(removeImg);
        removeChord.setAttribute('class', 'removeChord');
        const displayChord = document.createElement('div');
        displayChord.textContent = 'Hide';
        displayChord.setAttribute('class', 'displayChord');
        box.appendChild(displayChord);
        box.appendChild(removeChord);

  
        const chordOvDom = document.getElementById(`chordOverview${chordCounter}`);
        displayChord.addEventListener('click', () => {
          if (!chord.display) {
            displayChord.textContent = 'Hide';
            chord.display = true;
          } else {
            displayChord.textContent = 'Show';
            chord.display = false;
          }
          // console.log(`chordOverview${chordCounter}`);
          chordOvDom?.classList.toggle('hideChord');
        });
  
        removeChord.addEventListener('click', () => {
          Song.chordsMap[trackId].delete(chordName);
          this.createChordManager(trackId);
        });
        return box;
    }

    public getChordRoot(): string {
        return this.modalState.chordModalData.chordRoot;
    }

    public setChordRoot(value: string): void {
        this.modalState.chordModalData.chordRoot = value;
    }

    public getChordType(): string {
        return this.modalState.chordModalData.chordType;
    }

    public setChordType(value: string): void {
        this.modalState.chordModalData.chordType = value;
    }
} 