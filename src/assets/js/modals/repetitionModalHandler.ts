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
        
        this.showModal();
        this.setRepetitionState(blockId);
        this.setupRepetitionButton(trackId, blockId, voiceId);
    }

    protected setupModalContent(): void {
        const { trackId, blockId, voiceId } = this.modalState;
        if (!blockId || !trackId || voiceId === undefined) return;
        
        this.setRepetitionState(blockId);
        this.setupRepetitionButton(trackId, blockId, voiceId);
    }

    private setRepetitionState(blockId: number) {
        this.modalState.numRepetitions = Song.measureMeta[blockId].repeatClose ?? 1;
        
        const input = document.getElementById('numberOfRepetitionsInput') as HTMLInputElement;
        if (input) {
            input.value = this.modalState.numRepetitions.toString();
        }
    }

    private setupRepetitionButton(trackId: number, blockId: number, voiceId: number) {
        const input = document.getElementById('numberOfRepetitionsInput') as HTMLInputElement;
        if (input) {
            input.onchange = () => {
                this.modalState.numRepetitions = parseInt(input.value, 10);
            };
        }

        this.setupSelectButton('repetitionSelectButton', () => {
            const meta = Song.measureMeta[blockId];
            const repeatClosePresentBefore = meta.repeatClosePresent;
            
            if (!repeatClosePresentBefore) {
                meta.repeatClosePresent = true;
                EventBus.emit("menu.activateEffectsForBlock");
            }
            
            const repeatCloseBefore = meta.repeatClose;
            meta.repeatClose = this.modalState.numRepetitions;
            
            revertHandler.addRepeatClose(
                trackId, 
                blockId, 
                repeatCloseBefore,
                meta.repeatClose, 
                repeatClosePresentBefore,
                meta.repeatClosePresent
            );
            
            svgDrawer.rerenderBlock(trackId, blockId, voiceId);
            this.closeModal();
        });
    }
} 