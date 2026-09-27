import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Note, Measure, TremoloBar } from '../songData';
import { typedEventBus } from '../../../utils/typedEventBus';
import { revertHandler } from '../revertHandler';
import {
  connectPoints,
  drawPoint,
} from '../../../utils/svgPrimitives';
import Helper from '../helper';
import menuHandler from '../menuHandler';
import { MODALS } from './modalTypes';
import { requestBlocksRender } from '../../../services/editor/renderCommands';

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
    private tremoloEditor: SVGElement | null = null;
    private pointsLayer: SVGGElement | null = null;

    constructor() {
        super(MODALS.TREMOLO_BAR.id, MODALS.TREMOLO_BAR.name);
        this.modalState = {
            ...this.modalState,
            tremoloEditorClientWidth: 300,
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
        this.setupEventListeners();
    }

    private setTremoloPresentState() {
        this.modalState.strokePresentBefore = {};
        for (const be of this.modalState.beats) {
            const beatStr = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
            this.modalState.strokePresentBefore[beatStr] = be.beat.effects.tremoloBarPresent;
        }
    }

    public handleMouseDown(e: MouseEvent, tremoloEditor: SVGElement) {
        const rect = tremoloEditor.getBoundingClientRect();
        const width = rect.width - 2 * this.padding;
        const height = rect.height - 2 * this.padding;

        const mouseOffsetX = e.clientX - rect.left;
        const mouseOffsetY = e.clientY - rect.top;

        const xPos = Math.min(Math.max(mouseOffsetX - this.padding, 0), width);
        const yPos = Math.min(Math.max(mouseOffsetY - this.padding, 0), height);
        
        const oneXPort = width / this.NUM_COLUMNS_TREMOLO;
        const oneYPort = height / this.NUM_ROWS_TREMOLO;
        const xIndex = Math.round(xPos / oneXPort);
        const yIndex = Math.round(yPos / oneYPort);
        const xNearest = xIndex * oneXPort;
        const yNearest = yIndex * oneYPort;

        const layer = this.pointsLayer ?? tremoloEditor;
        this.updateTremoloPoint(xIndex, yIndex, xNearest, yNearest, layer);
    }

    public initializeTremoloEditor(tremoloEditor: SVGElement, pointsLayer?: SVGGElement) {
        this.tremoloEditor = tremoloEditor;
        this.pointsLayer = pointsLayer
          ?? (tremoloEditor.querySelector('.tremolo-points') as SVGGElement | null)
          ?? tremoloEditor as unknown as SVGGElement;
        this.drawTremoloEditor();
    }

    private drawTremoloEditor() {
        const layer = this.pointsLayer ?? this.tremoloEditor;
        if (layer == null) {
            return;
        }
        // Clear interactive points only — Vue owns the grid/frame/labels.
        Helper.removeAllChildren(layer);
        this.modalState.tremoloPointsArr = [];

        const width = this.modalState.tremoloEditorClientWidth - 2 * this.padding;
        const height = 300 - 2 * this.padding;

        this.initializeTremoloPoints(this.padding, width, height, layer);
    }

    private setupEventListeners() {        
        this.tremoloEditor!.onmousedown = (e: MouseEvent) => {
            this.handleMouseDown(e, this.tremoloEditor!);
        };

        this.setupSelect('tremoloSelection', (value) => {
            this.applyTremoloPreset(parseInt(value, 10));
        });

        this.setupSelectButton('tremoloSelectButton', () => {
            this.applyTremoloChanges();
        });
    }

    private updateTremoloPoint(xIndex: number, yIndex: number, xNearest: number, yNearest: number, tremoloEditor: SVGElement) {
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
            const point = drawPoint(
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

    applyTremoloPreset(presetIndex: number) {
        const width = (this.modalState.tremoloEditorClientWidth - 2 * this.padding) / this.NUM_COLUMNS_TREMOLO;
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
        for (const path of this.modalState.tremoloPointsArr) {
            path.parentNode?.removeChild(path);
        }
        this.modalState.tremoloPointsArr = [];
        const tremoloPresets = [
            [{ x: 0, y: 16 }, { x: 9, y: 14 }, { x: 12, y: 14 }], // Dive
            [{ x: 0, y: 16 }, { x: 6, y: 14 }, { x: 12, y: 16 }], // DIP
            [{ x: 0, y: 14 }, { x: 9, y: 14 }, { x: 12, y: 16 }], // Release Up
            [{ x: 0, y: 16 }, { x: 6, y: 18 }, { x: 12, y: 16 }], // Inverted Dip
            [{ x: 0, y: 16 }, { x: 9, y: 18 }, { x: 12, y: 18 }], // return
            [{ x: 0, y: 18 }, { x: 9, y: 18 }, { x: 12, y: 16 }], // release Down
        ];
        const layer = this.pointsLayer ?? this.tremoloEditor!;
        const tremoloPreset = tremoloPresets[presetIndex];
        for (const { x, y } of tremoloPreset) {
            this.modalState.tremoloPointsOnLine[x] = [drawPoint(width * x, height
                * (this.NUM_ROWS_TREMOLO - y), this.padding, this.padding, 7, layer, ''), y, x];
        }
        this.connectAllTremoloPoints(layer);
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
                typedEventBus.emit("menu.activateEffectsForBeat", beat);
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

        requestBlocksRender(beats[0].trackId, blocks, beats[0].voiceId);
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

    private connectAllTremoloPoints(svgElem: SVGElement) {
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
                        connectPoints(
                            firstPoint[0].childNodes[0],
                            currentTremoloPoint[0].childNodes[0], svgElem,
                        ),
                    );
                    firstPoint = currentTremoloPoint;
                }
            }
        }
    }

    private initializeTremoloPoints(padding: number, width: number, height: number, layer: SVGElement) {
        this.modalState.tremoloPointsOnLine = new Array(this.NUM_COLUMNS_TREMOLO + 1).fill(null);
        
        // If there is existing tremolo data in the first beat, initialize points
        const firstBeat = this.modalState.beats[0]?.beat;
        if (firstBeat?.effects?.tremoloBar) {
            const tremoloBar = firstBeat.effects.tremoloBar;
            
            tremoloBar.forEach((point: { position: number; value: number }) => {
                const xIndex = Math.round(point.position / 5);
                const yValue = (point.value + 800) / 50;
                const xPos = (width * xIndex) / this.NUM_COLUMNS_TREMOLO;
                const yPos = height * (1 - yValue / this.NUM_ROWS_TREMOLO);

                const svgPoint = drawPoint(
                    xPos,
                    yPos,
                    padding,
                    padding,
                    7,
                    layer,
                    ''
                );

                this.modalState.tremoloPointsOnLine[xIndex] = [svgPoint, yValue, xIndex];
            });

            this.connectAllTremoloPoints(layer);
        }
    }
}
