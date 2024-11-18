import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Song } from '../songData';
import { svgDrawer } from '../svgDrawer';
import { revertHandler } from '../revertHandler';
import EventBus from '../eventBus';
import { MODALS } from './modalTypes';

interface RepetitionState extends ModalState {
    numRepetitions: number;
    trackId?: number;
    blockId?: number;
    voiceId?: number;
}

export class RepetitionModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.REPETITION.id, MODALS.REPETITION.name);
        this.modalState = {
            ...this.modalState,
            numRepetitions: 1
        } as RepetitionState;
    }

    openModal(params?: { trackId: number; blockId: number; voiceId: number }): void {
        if (!params) return;
        
        const { trackId, blockId, voiceId } = params;
        this.modalState = { 
            ...this.modalState, 
            trackId, 
            blockId, 
            voiceId 
        };
        
        this.setRepetitionState();
        this.showModal();
    }

    setupModalContent(): void {}

    private setRepetitionState() {
        if (!this.modalState.blockId) return;
        this.modalState.numRepetitions = Song.measureMeta[this.modalState.blockId].repeatClose ?? 1;
    }

    public updateRepetitions(value: number): void {
        this.modalState.numRepetitions = Math.max(1, value);
    }

    public getModalState(): RepetitionState {
        return this.modalState as RepetitionState;
    }

    public applyRepetitions(): void {
        const { trackId, blockId, voiceId, numRepetitions } = this.modalState;
        if (blockId === undefined || trackId === undefined || voiceId === undefined) return;

        const meta = Song.measureMeta[blockId];
        const repeatClosePresentBefore = meta.repeatClosePresent;
        
        if (!repeatClosePresentBefore) {
            meta.repeatClosePresent = true;
            EventBus.emit("menu.activateEffectsForBlock");
        }
        
        const repeatCloseBefore = meta.repeatClose;
        meta.repeatClose = numRepetitions;
        
        revertHandler.addRepeatClose(
            trackId, 
            blockId, 
            repeatCloseBefore,
            meta.repeatClose, 
            repeatClosePresentBefore,
            meta.repeatClosePresent
        );
        
        svgDrawer.rerenderBlock(trackId, blockId, voiceId);
    }
} 