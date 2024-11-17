import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Measure, Stroke } from '../songData';
import fastdom from 'fastdom';
import EventBus from '../eventBus';
import { revertHandler } from '../revertHandler';
import { svgDrawer } from '../svgDrawer';

interface StrokeModalState extends ModalState {
    strokeData: Stroke;
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

interface StrokeModalParams {
    notes: {
        trackId: number;
        blockId: number;
        voiceId: number;
        beatId: number;
        string: number;
        note: any;
    }[];
    blocks: number[];
    beats: {
        trackId: number;
        blockId: number;
        voiceId: number;
        beatId: number;
        beat: Measure;
    }[];
}

export class StrokeModalHandler extends BaseModalHandler {
    readonly modalType = 'StrokeModal' as const;

    constructor() {
        super('addStrokeModal', 'Stroke');
        this.modalState = {
            ...this.modalState,
            strokeData: { strokeLength: 8, strokeType: 'down' },
            beats: [],
            blocks: [],
            strokePresentBefore: {}
        } as StrokeModalState;
    }

    openModal(params: StrokeModalParams) {
        this.modalState.beats = params.beats;
        this.modalState.blocks = params.blocks;
        this.setStrokePresentState();
        this.setInitialStrokeState(params.beats[0].beat);
        this.showModal();
    }

    protected setupModalContent(): void {
        this.updateStrokeSelections();
        this.setupEventListeners();
    }

    private setStrokePresentState() {
        this.modalState.strokePresentBefore = {};
        for (const be of this.modalState.beats) {
            const beatStr = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
            this.modalState.strokePresentBefore[beatStr] = be.beat.effects.strokePresent;
        }
    }

    private setInitialStrokeState(beat: Measure) {
        this.modalState.strokeData = {
            strokeLength: beat.effects.stroke?.strokeLength ?? 8,
            strokeType: beat.effects.stroke?.strokeType ?? 'up'
        };
    }

    private updateStrokeSelections() {
        const strokeDirectionSelection = document.getElementById('strokeDirectionSelection') as HTMLSelectElement;
        const strokeLengthSelection = document.getElementById('strokeLengthSelection') as HTMLSelectElement;
        
        strokeDirectionSelection.value = this.modalState.strokeData.strokeType;
        strokeLengthSelection.value = this.modalState.strokeData.strokeLength.toString();
    }

    private setupEventListeners() {
        this.setupSelect('strokeDirectionSelection', (value) => {
            this.modalState.strokeData.strokeType = value as 'up' | 'down';
        });

        this.setupSelect('strokeLengthSelection', (value) => {
            this.modalState.strokeData.strokeLength = parseInt(value, 10);
        });

        this.setupSelectButton('strokeSelectButton', () => {
            this.applyStroke();
        });
    }

    private applyStroke() {
        fastdom.mutate(() => {
            for (const be of this.modalState.beats) {
                const { beat } = be;
                const beatStr = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
                const strokeBefore = beat.effects.stroke;
                
                beat.effects.stroke = {
                    strokeType: this.modalState.strokeData.strokeType,
                    strokeLength: this.modalState.strokeData.strokeLength,
                };

                if (!beat.effects.strokePresent) {
                    beat.effects.strokePresent = true;
                    EventBus.emit("menu.activateEffectsForBeat", beat);
                }

                revertHandler.addStroke(
                    be.trackId,
                    be.blockId,
                    be.voiceId,
                    be.beatId,
                    strokeBefore,
                    beat.effects.stroke,
                    this.modalState.strokePresentBefore[beatStr],
                    beat.effects.strokePresent
                );
            }

            const { trackId, voiceId } = this.modalState.beats[0];
            svgDrawer.rerenderBlocks(trackId, this.modalState.blocks, voiceId);
        });
    }
}