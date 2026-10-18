import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Beat, Stroke } from '../songData';
import fastdom from 'fastdom';
import { typedEventBus } from '../../../utils/typedEventBus';
import { revertHandler } from '../revertHandler';
import { MODALS } from './modalTypes';
import { requestBlocksRender } from '../../../services/editor/renderCommands';

interface StrokeModalState extends ModalState {
    strokeData: Stroke;
    beats: {
        trackId: number;
        blockId: number;
        voiceId: number;
        beatId: number;
        beat: Beat;
    }[];
    blocks: number[];
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
        beat: Beat;
    }[];
}

export class StrokeModalHandler extends BaseModalHandler {
    readonly modalType = 'StrokeModal' as const;

    constructor() {
        super(MODALS.STROKE.id, MODALS.STROKE.name);
        this.modalState = {
            ...this.modalState,
            strokeData: { strokeLength: 8, strokeType: 'down' },
            beats: [],
            blocks: []
        } as StrokeModalState;
    }

    openModal(params: StrokeModalParams) {
        this.modalState.beats = params.beats;
        this.modalState.blocks = params.blocks;
        this.setInitialStrokeState(params.beats[0].beat);
        this.showModal();
    }

    protected setupModalContent(): void {
        this.updateStrokeSelections();
        this.setupEventListeners();
    }

    private setInitialStrokeState(beat: Beat) {
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
                const strokeBefore = beat.effects.stroke;
                
                beat.effects.stroke = {
                    strokeType: this.modalState.strokeData.strokeType,
                    strokeLength: this.modalState.strokeData.strokeLength,
                };

                if (strokeBefore == null) {
                    typedEventBus.emit("menu.activateEffectsForBeat", beat);
                }

                revertHandler.addStroke(
                    be.trackId,
                    be.blockId,
                    be.voiceId,
                    be.beatId,
                    strokeBefore,
                    beat.effects.stroke,
                );
            }

            const { trackId, voiceId } = this.modalState.beats[0];
            requestBlocksRender(trackId, this.modalState.blocks, voiceId);
        });
    }
}