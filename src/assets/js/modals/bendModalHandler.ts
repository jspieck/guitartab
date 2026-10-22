import { BaseModalHandler } from './baseModalHandler';
import { Note, Beat } from '../songData';
import {
  connectPoints,
  drawPoint,
} from '../../../utils/svgPrimitives';
import fastdom from 'fastdom';
import { toggleNoteEffect } from '../../../services/editor/effectToggles';
import { recordBarEdit } from '../../../services/editor/editCommands';
import { Song } from '../songData';
import { MODALS } from './modalTypes';
import { requestBlocksRender } from '../../../services/editor/renderCommands';

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
        beat: Beat;
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
            beat: Beat
        }[]
    };
    private isVariableSet: boolean = false;
    private pointsLayer: SVGGElement | null = null;

    constructor() {
        super(MODALS.BEND.id, MODALS.BEND.name);
    }

    /** Vue owns the grid; interactive points/lines go in this layer. */
    setPointsLayer(layer: SVGGElement) {
        this.pointsLayer = layer;
    }

    private getPointsTarget(): SVGElement {
        return this.pointsLayer
          ?? (document.querySelector('#bendEditor .bend-points') as SVGGElement | null)
          ?? (document.getElementById('bendEditor') as unknown as SVGElement);
    }

    openModal(params: BendModalParams) {
        this.currentNotes = {
            notes: params.notes,
            blocks: params.blocks,
            beats: params.beats
        };
        this.isVariableSet = params.isVariableSet;

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

    private handleBendEditorClick(paddingTop: number, paddingLeft: number, width: number, height: number, _bendEditor: HTMLElement) {
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
            const point = drawPoint(xNearest, yNearest, paddingTop,
                paddingLeft, 7, this.getPointsTarget(), '');
            this.editorProps.pointsOnLine[xIndex] = [point, this.editorProps.VERTICAL_STEPS - yIndex, xIndex];
        }
        this.connectAllBendPoints(this.getPointsTarget());
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
            const { notes, blocks } = this.currentNotes;
            const blockIds = [...blocks, ...notes.map((no) => no.blockId)];
            recordBarEdit('Bend', { trackId: notes[0].trackId, blockIds }, () => {
                toggleNoteEffect(notes, 'bend', this.isVariableSet);
                this.applyBendToNotes(bendObjs);
            });
            requestBlocksRender(
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
                beat: Beat
            }[]
        },
        paddingTop: number,
        paddingLeft: number,
        width: number,
        height: number,
    ) {
        fastdom.mutate(() => {
            this.setupBendEditor();

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

            this.connectAllBendPoints(this.getPointsTarget());
        });
    }

    private setupBendEditor() {
        const layer = this.getPointsTarget();
        layer?.replaceChildren();
        this.editorProps.bendPointsArr = [];
        this.editorProps.pointsOnLine = new Array(this.editorProps.HORIZONTAL_STEPS + 1).fill(null);
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
        const bendEditor = this.getPointsTarget();

        let bendPreset = bendPresets[index];
        if (preset != null && preset.length > 0) {
            bendPreset = preset;
        }
        for (let i = 0; i < bendPreset.length; i += 1) {
            const xVal = bendPreset[i].x;
            const yVal = bendPreset[i].y; // 0,0 is at the upper-left
            this.editorProps.pointsOnLine[xVal] = [
                drawPoint(
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

    private connectAllBendPoints(svgElem: SVGElement) {
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
                    this.editorProps.bendPointsArr.push(connectPoints(
                        firstPoint[0].childNodes[0] as SVGElement,
                        this.editorProps.pointsOnLine[i]![0].childNodes[0] as SVGElement,
                        svgElem,
                    ));
                    firstPoint = this.editorProps.pointsOnLine[i];
                }
            }
        }
    }

    private createBendObjects(): { bendPosition: number, bendValue: number, vibrato: number }[] {
        const bendObjs: { bendPosition: number, bendValue: number, vibrato: number }[] = [];
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

    private applyBendToNotes(bendObjs: { bendPosition: number, bendValue: number, vibrato: number }[]) {
        if (!this.currentNotes) return;

        for (const { trackId, blockId, voiceId, beatId, string } of this.currentNotes.notes) {
            const note = Song.getBeat({ trackId, blockId, voiceId, beatId }).notes[string];
            if (note) {
                note.bendObj = bendObjs.map((point) => ({ ...point }));
            }
        }
    }
}
