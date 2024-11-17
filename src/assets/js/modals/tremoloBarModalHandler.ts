import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Note, Measure, TremoloBar } from '../songData';
import fastdom from 'fastdom';
import EventBus from '../eventBus';
import { revertHandler } from '../revertHandler';
import { svgDrawer, SvgDrawer } from '../svgDrawer';
import Helper from '../helper';
import menuHandler from '../menuHandler';

interface TremoloBarModalState extends ModalState {
    tremoloEditorClientWidth: number;
    tremoloPointsArr: SVGPathElement[];
    tremoloPointsOnLine: ([SVGElement, number, number] | null)[];
    mouseOffsetX: number;
    mouseOffsetY: number;
    beats: {
        trackId: number;
        blockId: number;
        voiceId: number;
        beatId: number;
        beat: Measure;
    }[];
    blocks: number[];
    strokePresentBefore: { [beatStr: string]: boolean };
}

export class TremoloBarModalHandler extends BaseModalHandler {
    readonly modalType = 'TremoloBarModal' as const;
    private readonly NUM_ROWS_TREMOLO: number = 24;
    private readonly NUM_COLUMNS_TREMOLO: number = 12;
    private readonly padding: number = 20;

    constructor() {
        super('tremoloModalEditor', 'Tremolo');
        this.modalState = {
            ...this.modalState,
            tremoloEditorClientWidth: 0,
            tremoloPointsArr: [],
            tremoloPointsOnLine: [],
            mouseOffsetX: 0,
            mouseOffsetY: 0,
            beats: [],
            blocks: [],
            strokePresentBefore: {}
        } as TremoloBarModalState;
    }

    openModal(params: {
        notes: { trackId: number; blockId: number; voiceId: number; beatId: number; string: number; note: Note }[];
        blocks: number[];
        beats: { trackId: number; blockId: number; voiceId: number; beatId: number; beat: Measure }[];
        isVariableSet: boolean;
    }) {
        this.modalState.beats = params.beats;
        this.modalState.blocks = params.blocks;
        this.setTremoloPresentState();
        this.showModal();
    }

    protected setupModalContent(): void {
        this.initializeTremoloEditor();
        this.setupEventListeners();
    }

    private setTremoloPresentState() {
        this.modalState.strokePresentBefore = {};
        for (const be of this.modalState.beats) {
            const beatStr = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
            this.modalState.strokePresentBefore[beatStr] = be.beat.effects.tremoloBarPresent;
        }
    }

    private initializeTremoloEditor() {
        fastdom.measure(() => {
            const tremoloEditor = document.getElementById('tremoloEditor')!;
            this.modalState.tremoloEditorClientWidth = tremoloEditor.clientWidth;
            this.drawTremoloEditor();
        });
    }

    private drawTremoloEditor() {
        const tremoloEditor = document.getElementById('tremoloEditor')!;
        Helper.removeAllChildren(tremoloEditor);
        this.modalState.tremoloPointsArr = [];

        const padding = 20;
        const width = this.modalState.tremoloEditorClientWidth - 2 * padding;
        const height = 300 - 2 * padding;

        this.drawEditorFrame(tremoloEditor, padding, width, height);
        this.drawAxisLabels(tremoloEditor, padding, height);
        this.drawGrid(tremoloEditor, padding, width, height);
        this.initializeTremoloPoints(padding, width, height);
    }

    private setupEventListeners() {
        const tremoloEditor = document.getElementById('tremoloEditor')!;
        
        tremoloEditor.onmousedown = (e: MouseEvent) => {
            this.handleMouseDown(e);
        };

        this.setupSelect('tremoloSelection', (value) => {
            this.applyTremoloPreset(parseInt(value, 10));
        });

        this.setupSelectButton('tremoloSelectButton', () => {
            this.applyTremoloChanges();
        });
    }

    private handleMouseDown(e: MouseEvent) {
        const tremoloEditor = document.getElementById('tremoloEditor')!;
        const rect = tremoloEditor.getBoundingClientRect();
        const width = rect.width - 2 * this.padding;
        const height = rect.height - 2 * this.padding;

        fastdom.measure(() => {
            this.modalState.mouseOffsetX = e.clientX - rect.left;
            this.modalState.mouseOffsetY = e.clientY - rect.top;
        });

        fastdom.mutate(() => {
            const xPos = Math.min(Math.max(this.modalState.mouseOffsetX - this.padding, 0), width);
            const yPos = Math.min(Math.max(this.modalState.mouseOffsetY - this.padding, 0), height);
            
            const oneXPort = width / this.NUM_COLUMNS_TREMOLO;
            const oneYPort = height / this.NUM_ROWS_TREMOLO;
            const xIndex = Math.round(xPos / oneXPort);
            const yIndex = Math.round(yPos / oneYPort);
            const xNearest = xIndex * oneXPort;
            const yNearest = yIndex * oneYPort;

            this.updateTremoloPoint(xIndex, yIndex, xNearest, yNearest, tremoloEditor);
        });
    }

    private updateTremoloPoint(xIndex: number, yIndex: number, xNearest: number, yNearest: number, tremoloEditor: HTMLElement) {
        let samePoint = false;
        const pointToRemove = this.modalState.tremoloPointsOnLine[xIndex];

        if (pointToRemove != null) {
            if (pointToRemove[0].parentNode != null) {
                pointToRemove[0].parentNode.removeChild(pointToRemove[0]);
            }
            samePoint = (this.NUM_ROWS_TREMOLO - yIndex === pointToRemove[1]);
            this.modalState.tremoloPointsOnLine[xIndex] = null;
        }

        if (!samePoint) {
            const point = SvgDrawer.drawPoint(
                xNearest,
                yNearest,
                this.padding,
                this.padding,
                7,
                tremoloEditor,
                ''
            );
            this.modalState.tremoloPointsOnLine[xIndex] = [point, this.NUM_ROWS_TREMOLO - yIndex, xIndex];
        }

        this.connectAllTremoloPoints(tremoloEditor);
    }

    private applyTremoloPreset(presetIndex: number) {
        const width = this.modalState.tremoloEditorClientWidth / this.NUM_COLUMNS_TREMOLO;
        const height = 300 / this.NUM_ROWS_TREMOLO;
        for (let i = 0; i < this.modalState.tremoloPointsOnLine.length; i++) {
            const currentPoint = this.modalState.tremoloPointsOnLine[i];
            if (currentPoint != null && currentPoint[0] != null) {
                const { parentNode } = currentPoint[0];
                if (parentNode != null) {
                    parentNode.removeChild(currentPoint[0]);
                    this.modalState.tremoloPointsOnLine[i] = null;
                }
            }
        }
        const tremoloPresets = [
            [{ x: 0, y: 16 }, { x: 9, y: 14 }, { x: 12, y: 14 }], // Dive
            [{ x: 0, y: 16 }, { x: 6, y: 14 }, { x: 12, y: 16 }], // DIP
            [{ x: 0, y: 14 }, { x: 9, y: 14 }, { x: 12, y: 16 }], // Release Up
            [{ x: 0, y: 16 }, { x: 6, y: 18 }, { x: 12, y: 16 }], // Inverted Dip
            [{ x: 0, y: 16 }, { x: 9, y: 18 }, { x: 12, y: 18 }], // return
            [{ x: 0, y: 18 }, { x: 9, y: 18 }, { x: 12, y: 16 }], // release Down
        ];
        const tremoloEditor = document.getElementById('tremoloEditor')!;
        let tremoloPreset = tremoloPresets[presetIndex];
        for (let i = 0; i < tremoloPreset.length; i++) {
            const xVal = tremoloPreset[i].x;
            const yVal = tremoloPreset[i].y; // 0,0 is at the upper-left
            this.modalState.tremoloPointsOnLine[xVal] = [SvgDrawer.drawPoint(width * xVal, height
                * (this.NUM_ROWS_TREMOLO - yVal), this.padding, this.padding, 7, tremoloEditor, ''), yVal, xVal];
        }
        this.connectAllTremoloPoints(tremoloEditor);
    }

    public applyTremoloChanges() {
        const { beats, blocks } = this.modalState;
        const beatsBefore = menuHandler.handleEffectGroupCollisionBeat(beats, 'tremoloBar', this.modalState.isVariableSet);
        for (const be of beats) {
            const beat = be.beat;
            const beatStr = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
            const tremoloBarBefore = beat.effects.tremoloBar;
            
            const tremoloBarObj: TremoloBar = this.createTremoloBarFromPoints();
            beat.effects.tremoloBar = tremoloBarObj;

            if (!beat.effects.tremoloBarPresent) {
                beat.effects.tremoloBarPresent = true;
                EventBus.emit("menu.activateEffectsForBeat", beat);
            }

            revertHandler.addTremoloBar(
                be.trackId,
                be.blockId,
                be.voiceId,
                be.beatId,
                tremoloBarBefore,
                beat.effects.tremoloBar,
                this.modalState.strokePresentBefore[beatStr],
                beat.effects.tremoloBarPresent,
                beatsBefore[beatStr],
            );
        }

        svgDrawer.rerenderBlocks(beats[0].trackId, blocks, beats[0].voiceId);
        this.closeModal();
    }

    private createTremoloBarFromPoints(): TremoloBar {
        const tremoloBarObj: TremoloBar = [];
        for (let i = 0; i < this.modalState.tremoloPointsOnLine.length; i++) {
            const currentPoint = this.modalState.tremoloPointsOnLine[i];
            if (currentPoint != null) {
                tremoloBarObj.push({
                    position: currentPoint[2] * 5,
                    value: currentPoint[1] * 50 - 800,
                    vibrato: 0,
                });
            }
        }
        return tremoloBarObj;
    }

    private connectAllTremoloPoints(svgElem: HTMLElement) {
        for (let i = 0; i < this.modalState.tremoloPointsArr.length; i += 1) {
            const { parentNode } = this.modalState.tremoloPointsArr[i];
            if (parentNode != null) {
                parentNode.removeChild(this.modalState.tremoloPointsArr[i]);
            }
        }
        this.modalState.tremoloPointsArr = [];
        let firstPoint = null;
        for (let i = 0; i < this.modalState.tremoloPointsOnLine.length; i += 1) {
            const currentTremoloPoint = this.modalState.tremoloPointsOnLine[i];
            if (currentTremoloPoint != null) {
                if (firstPoint == null) {
                    firstPoint = currentTremoloPoint;
                } else {
                    this.modalState.tremoloPointsArr.push(
                        SvgDrawer.connectPoints(
                            firstPoint[0].childNodes[0] as HTMLElement,
                            currentTremoloPoint[0].childNodes[0] as HTMLElement, svgElem,
                        ),
                    );
                    firstPoint = currentTremoloPoint;
                }
            }
        }
    }

    private drawEditorFrame(tremoloEditor: HTMLElement, padding: number, width: number, height: number) {
        const frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        frame.setAttribute('x', padding.toString());
        frame.setAttribute('y', padding.toString());
        frame.setAttribute('width', width.toString());
        frame.setAttribute('height', height.toString());
        frame.setAttribute('fill', 'none');
        frame.setAttribute('stroke', 'black');
        frame.setAttribute('stroke-width', '1');
        tremoloEditor.appendChild(frame);
    }

    private drawAxisLabels(tremoloEditor: HTMLElement, padding: number, height: number) {
        const labels = [
            { text: '+16', y: padding },
            { text: '+8', y: height / 3 + padding },
            { text: '0', y: (2 * height) / 3 + padding },
            { text: '-8', y: height + padding }
        ];

        labels.forEach(label => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', (padding - 5).toString());
            text.setAttribute('y', label.y.toString());
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('alignment-baseline', 'middle');
            text.setAttribute('font-size', '12');
            text.textContent = label.text;
            tremoloEditor.appendChild(text);
        });
    }

    private drawGrid(tremoloEditor: HTMLElement, padding: number, width: number, height: number) {
        // Draw vertical lines
        for (let i = 0; i <= this.NUM_COLUMNS_TREMOLO; i++) {
            const x = (width * i) / this.NUM_COLUMNS_TREMOLO + padding;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x.toString());
            line.setAttribute('y1', padding.toString());
            line.setAttribute('x2', x.toString());
            line.setAttribute('y2', (height + padding).toString());
            line.setAttribute('stroke', '#ddd');
            line.setAttribute('stroke-width', '1');
            tremoloEditor.appendChild(line);
        }

        // Draw horizontal lines
        for (let i = 0; i <= this.NUM_ROWS_TREMOLO; i++) {
            const y = (height * i) / this.NUM_ROWS_TREMOLO + padding;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding.toString());
            line.setAttribute('y1', y.toString());
            line.setAttribute('x2', (width + padding).toString());
            line.setAttribute('y2', y.toString());
            line.setAttribute('stroke', '#ddd');
            line.setAttribute('stroke-width', '1');
            tremoloEditor.appendChild(line);
        }
    }

    private initializeTremoloPoints(padding: number, width: number, height: number) {
        this.modalState.tremoloPointsOnLine = new Array(this.NUM_COLUMNS_TREMOLO + 1).fill(null);
        
        // If there's existing tremolo data in the first beat, initialize points
        const firstBeat = this.modalState.beats[0]?.beat;
        if (firstBeat?.effects?.tremoloBar) {
            const tremoloBar = firstBeat.effects.tremoloBar;
            const tremoloEditor = document.getElementById('tremoloEditor')!;
            
            tremoloBar.forEach((point: { position: number; value: number }) => {
                const xIndex = Math.round(point.position / 5);
                const yValue = (point.value + 800) / 50;
                const xPos = (width * xIndex) / this.NUM_COLUMNS_TREMOLO;
                const yPos = height * (1 - yValue / this.NUM_ROWS_TREMOLO);

                const svgPoint = SvgDrawer.drawPoint(
                    xPos,
                    yPos,
                    padding,
                    padding,
                    7,
                    tremoloEditor,
                    ''
                );

                this.modalState.tremoloPointsOnLine[xIndex] = [svgPoint, yValue, xIndex];
            });

            this.connectAllTremoloPoints(tremoloEditor);
        }
    }
}