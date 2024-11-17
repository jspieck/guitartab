import { BaseModalHandler } from './baseModalHandler';
import { Note, Measure } from '../songData';
import { SvgDrawer, svgDrawer } from '../svgDrawer';
import Helper from '../helper';
import fastdom from 'fastdom';
import menuHandler from '../menuHandler';
import { revertHandler } from '../revertHandler';
import EventBus from '../eventBus';
import { Song } from '../songData';
import { tab } from '../tab';

interface BendEditorProps {
    HORIZONTAL_STEPS: number;
    VERTICAL_STEPS: number;
    pointsOnLine: ([SVGElement, number, number] | null)[];
    bendPointsArr: SVGPathElement[];
}

interface BendModalParams {
    notes: {
        trackId: number;
        blockId: number;
        voiceId: number;
        beatId: number;
        string: number;
        note: Note;
    }[];
    blocks: number[];
    beats: {
        trackId: number;
        blockId: number;
        voiceId: number;
        beatId: number;
        beat: Measure;
    }[];
    isVariableSet: boolean;
}

export class BendModalHandler extends BaseModalHandler {
    private editorProps: BendEditorProps = {
        HORIZONTAL_STEPS: 12,
        VERTICAL_STEPS: 12,
        pointsOnLine: [],
        bendPointsArr: []
    };
    private mouseOffsetX: number = 0;
    private mouseOffsetY: number = 0;
    private currentNotes?: {
        notes: {
            trackId: number, blockId: number, voiceId: number, beatId: number,
            string: number, note: Note
        }[],
        blocks: number[],
        beats: {
            trackId: number, blockId: number, voiceId: number, beatId: number,
            beat: Measure
        }[]
    };
    private isVariableSet: boolean = false;
    private bendPresentBefore: { [a: string]: boolean } = {};

    constructor() {
        super('modalEditor', 'Bend Editor');
    }

    openModal(params: BendModalParams) {
        this.currentNotes = {
            notes: params.notes,
            blocks: params.blocks,
            beats: params.beats
        };
        this.isVariableSet = params.isVariableSet;

        // Store initial bend states
        this.bendPresentBefore = {};
        for (const no of params.notes) {
            const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
            this.bendPresentBefore[noteStr] = no.note.bendPresent;
        }

        this.showModal();
    }

    protected setupModalContent(): void {
        if (!this.currentNotes) return;

        const paddingTop = 20;
        const paddingLeft = 25;
        const bendEditorClientWidth = 501;
        const width = bendEditorClientWidth - 2 * paddingLeft;
        const height = 200 - 2 * paddingTop;

        this.drawBendEditor(this.currentNotes, paddingTop, paddingLeft, width, height);
        this.setupBendEditorListeners(paddingTop, paddingLeft, width, height);
        this.setupBendSelectionListener(paddingTop, paddingLeft, width, height);
        this.setupBendSelectButton();
    }

    private setupBendEditorListeners(paddingTop: number, paddingLeft: number, width: number, height: number) {
        const bendEditor = document.getElementById('bendEditor')!;

        bendEditor.addEventListener('mousedown', (e) => {
            fastdom.measure(() => {
                const t = document.getElementById('bendEditor')!.getBoundingClientRect();
                this.mouseOffsetX = e.clientX - t.left;
                this.mouseOffsetY = e.clientY - t.top;
            });

            fastdom.mutate(() => {
                this.handleBendEditorClick(paddingTop, paddingLeft, width, height, bendEditor);
            });
        });
    }

    private handleBendEditorClick(paddingTop: number, paddingLeft: number, width: number, height: number, bendEditor: HTMLElement) {
        const xPos = Math.min(Math.max(this.mouseOffsetX - paddingLeft, 0), width);
        const yPos = Math.min(Math.max(this.mouseOffsetY - paddingTop, 0), height);
        const oneXPort = width / this.editorProps.HORIZONTAL_STEPS;
        const oneYPort = height / this.editorProps.VERTICAL_STEPS;
        const xIndex = Math.round(xPos / oneXPort);
        const yIndex = Math.round(yPos / oneYPort);
        const xNearest = xIndex * oneXPort;
        const yNearest = yIndex * oneYPort;

        let samePoint = false;
        const currentPoint = this.editorProps.pointsOnLine[xIndex];
        if (currentPoint != null) {
            if (currentPoint[0].parentNode != null) {
                currentPoint[0].parentNode.removeChild(currentPoint[0]);
            }
            samePoint = (this.editorProps.VERTICAL_STEPS - yIndex === currentPoint[1]);
            this.editorProps.pointsOnLine[xIndex] = null;
        }
        if (!samePoint) {
            const point = SvgDrawer.drawPoint(xNearest, yNearest, paddingTop,
                paddingLeft, 7, bendEditor, '');
            this.editorProps.pointsOnLine[xIndex] = [point, this.editorProps.VERTICAL_STEPS - yIndex, xIndex];
        }
        this.connectAllBendPoints(bendEditor);
    }

    private setupBendSelectionListener(paddingTop: number, paddingLeft: number, width: number, height: number) {
        const bendSelection = document.getElementById('bendSelection') as HTMLSelectElement;
        bendSelection.onchange = () => {
            fastdom.mutate(() => {
                const val = bendSelection.options[bendSelection.selectedIndex].value;
                this.applyBendPreset(parseInt(val, 10), paddingTop, paddingLeft, width, height, []);
            });
        };
    }

    private setupBendSelectButton() {
        this.setupSelectButton('selectButton', () => {
            if (!this.currentNotes) return;

            const bendObjs = this.createBendObjects();
            const notesBefore = menuHandler.handleEffectGroupCollision(
                this.currentNotes.notes,
                'bend',
                this.isVariableSet
            );

            this.applyBendToNotes(bendObjs, notesBefore);
            svgDrawer.rerenderBlocks(
                this.currentNotes.notes[0].trackId,
                this.currentNotes.blocks,
                this.currentNotes.notes[0].voiceId
            );
        });
    }

    drawBendEditor(
        arr: {
            notes: {
                trackId: number,
                blockId: number,
                voiceId: number,
                beatId: number,
                string: number,
                note: Note
            }[],
            blocks: number[],
            beats: {
                trackId: number,
                blockId: number,
                voiceId: number,
                beatId: number,
                beat: Measure
            }[]
        },
        paddingTop: number,
        paddingLeft: number,
        width: number,
        height: number,
    ) {
        fastdom.mutate(() => {
            const bendEditor = document.getElementById('bendEditor')!;
            this.setupBendEditor(bendEditor, paddingTop, paddingLeft, width, height);

            const { note } = arr.notes[0];
            if (note.bendObj == null) {
                this.applyBendPreset(0, paddingTop, paddingLeft, width, height, []);
            } else {
                const preset = note.bendObj.map(bend => ({
                    x: bend.bendPosition / 5,
                    y: bend.bendValue / 25
                }));
                this.applyBendPreset(0, paddingTop, paddingLeft, width, height, preset);
            }

            this.connectAllBendPoints(bendEditor);
        });
    }

    private setupBendEditor(
        bendEditor: HTMLElement,
        paddingTop: number,
        paddingLeft: number,
        width: number,
        height: number
    ) {
        Helper.removeAllChildren(bendEditor);
        this.editorProps.bendPointsArr = [];

        // Setup basic elements
        const rect = SvgDrawer.createRect(paddingLeft, paddingTop, width, height, '', '1', '');
        bendEditor.appendChild(rect);

        // Add axis labels
        this.drawAxisLabels(bendEditor, height, paddingTop);

        // Draw grid
        this.drawGrid(bendEditor, width, height, paddingTop, paddingLeft);

        // Initialize points array
        this.editorProps.pointsOnLine = new Array(this.editorProps.HORIZONTAL_STEPS + 1).fill(null);
    }

    private drawAxisLabels(bendEditor: HTMLElement, height: number, paddingTop: number) {
        const labels = [
            { text: '0', y: height + paddingTop },
            { text: 'Half', y: (height * 2) / 3 + paddingTop },
            { text: 'Full', y: paddingTop + height / 3 },
            { text: '1.5', y: paddingTop }
        ];

        labels.forEach(label => {
            bendEditor.appendChild(
                SvgDrawer.createText(0, label.y, label.text, '12px', '')
            );
        });
    }

    private drawGrid(
        bendEditor: HTMLElement,
        width: number,
        height: number,
        paddingTop: number,
        paddingLeft: number
    ) {
        // Draw vertical lines
        this.drawVerticalGridLines(bendEditor, width, height, paddingTop, paddingLeft);
        // Draw horizontal lines
        this.drawHorizontalGridLines(bendEditor, width, height, paddingTop, paddingLeft);
    }

    private drawVerticalGridLines(bendEditor: HTMLElement, width: number, height: number, paddingTop: number, paddingLeft: number) {
        for (let i = 0; i < this.editorProps.HORIZONTAL_STEPS - 1; i += 1) {
            const xPos = (width / this.editorProps.HORIZONTAL_STEPS) * (i + 1) + paddingLeft;
            const pathStr = `M${xPos} ${paddingTop}L${xPos} ${height + paddingTop}`;
            let stroke = '#4a4a4a';
            if ((i + 1) % 3 !== 0) stroke = '#d6d6d6';
            const pathEl = SvgDrawer.createPath(pathStr, stroke, '1', 'none');
            if ((i + 1) % 3 !== 0) {
                pathEl.setAttribute('class', 'gridLine');
            } else {
                pathEl.setAttribute('class', 'strongGridLine');
            }
            bendEditor?.appendChild(pathEl);
        }
    }

    private drawHorizontalGridLines(bendEditor: HTMLElement, width: number, height: number, paddingTop: number, paddingLeft: number) {
        for (let i = 0; i < this.editorProps.VERTICAL_STEPS - 1; i += 1) {
            const yPos = (height / this.editorProps.VERTICAL_STEPS) * (i + 1) + paddingTop;
            const pathStr = `M${paddingLeft} ${yPos}L${width + paddingLeft} ${yPos}`;
            let stroke = '#4a4a4a';
            if ((i + 1) % 4 !== 0) {
                stroke = '#d6d6d6';
            }
            const pathEl = SvgDrawer.createPath(pathStr, stroke, '1', 'none');
            if ((i + 1) % 4 !== 0) {
                pathEl.setAttribute('strokeDasharray', '5, 5');
                pathEl.setAttribute('class', 'gridLine');
            } else {
                pathEl.setAttribute('class', 'strongGridLine');
            }
            bendEditor?.appendChild(pathEl);
        }
    }

    private applyBendPreset(
        index: number, paddingTop: number, paddingLeft: number, widthTotal: number,
        heightTotal: number, preset: { x: number, y: number }[],
    ) {
        const width = widthTotal / this.editorProps.HORIZONTAL_STEPS;
        const height = heightTotal / this.editorProps.VERTICAL_STEPS;
        for (let i = 0; i <= this.editorProps.HORIZONTAL_STEPS; i += 1) {
            const currentPoint = this.editorProps.pointsOnLine[i];
            if (currentPoint != null && currentPoint[0].parentNode != null) {
                currentPoint[0].parentNode.removeChild(currentPoint[0]);
                this.editorProps.pointsOnLine[i] = null;
            }
        }
        // local to not waste RAM for an array not needed in most cases
        const bendPresets = [
            [{ x: 0, y: 0 }, { x: 6, y: 4 }, { x: 12, y: 4 }],
            [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 4 }, { x: 9, y: 0 }, { x: 12, y: 0 }],
            [{ x: 0, y: 0 }, { x: 2, y: 4 }, { x: 4, y: 4 }, { x: 6, y: 0 }, { x: 8, y: 0 },
            { x: 10, y: 4 }, { x: 12, y: 4 }],
            [{ x: 0, y: 4 }, { x: 12, y: 4 }],
            [{ x: 0, y: 4 }, { x: 4, y: 4 }, { x: 8, y: 0 }, { x: 12, y: 0 }],
        ];
        const bendEditor = document.getElementById('bendEditor')!;

        let bendPreset = bendPresets[index];
        if (preset != null && preset.length > 0) {
            bendPreset = preset;
        }
        console.log('Bend Preset', bendPreset);
        for (let i = 0; i < bendPreset.length; i += 1) {
            const xVal = bendPreset[i].x;
            const yVal = bendPreset[i].y; // 0,0 is at the upper-left
            this.editorProps.pointsOnLine[xVal] = [
                SvgDrawer.drawPoint(
                    width * xVal,
                    height * (this.editorProps.VERTICAL_STEPS - yVal),
                    paddingTop,
                    paddingLeft,
                    7,
                    bendEditor,
                    '',
                ),
                yVal,
                xVal,
            ];
        }
        this.connectAllBendPoints(bendEditor);
    }

    private connectAllBendPoints(svgElem: HTMLElement) {
        for (let i = 0; i < this.editorProps.bendPointsArr.length; i += 1) {
            const bendPointDom = this.editorProps.bendPointsArr[i];
            if (bendPointDom != null && bendPointDom.parentNode != null) {
                bendPointDom.parentNode.removeChild(bendPointDom);
            }
        }
        this.editorProps.bendPointsArr.length = 0;
        let firstPoint = null;
        for (let i = 0; i < this.editorProps.pointsOnLine.length; i += 1) {
            if (this.editorProps.pointsOnLine[i] != null) {
                if (firstPoint == null) {
                    firstPoint = this.editorProps.pointsOnLine[i];
                } else {
                    this.editorProps.bendPointsArr.push(SvgDrawer.connectPoints(
                        firstPoint[0].childNodes[0] as HTMLElement,
                        this.editorProps.pointsOnLine[i]![0].childNodes[0] as HTMLElement,
                        svgElem,
                    ));
                    firstPoint = this.editorProps.pointsOnLine[i];
                }
            }
        }
    }

    private createBendObjects() {
        const bendObjs = [];
        for (let i = 0; i < this.editorProps.pointsOnLine.length; i += 1) {
            const currentPoint = this.editorProps.pointsOnLine[i];
            if (currentPoint != null) {
                bendObjs.push({
                    bendPosition: currentPoint[2] * 5,
                    bendValue: currentPoint[1] * 25,
                    vibrato: 0,
                });
            }
        }
        return bendObjs;
    }

    private applyBendToNotes(bendObjs: any[], notesBefore: any) {
        if (!this.currentNotes) return;

        for (const no of this.currentNotes.notes) {
            const { trackId, blockId, voiceId, beatId, string } = no;
            const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];

            if (!note) {
                console.error('Note is null');
                continue;
            }

            const bendBefore = note.bendObj;
            if (!note.bendPresent) {
                note.bendPresent = true;
                if (tab.markedNoteObj.blockId === blockId && tab.markedNoteObj.beatId === beatId) {
                    EventBus.emit("menu.activateEffectsForNote", note);
                }
            }

            note.bendObj = bendObjs;
            const noteStr = `${trackId}_${blockId}_${voiceId}_${beatId}_${string}`;
            revertHandler.addBend(
                trackId, blockId, voiceId, beatId, string,
                bendBefore, note.bendObj,
                this.bendPresentBefore[noteStr], note.bendPresent,
                notesBefore[noteStr]
            );
        }
    }
} 