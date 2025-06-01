import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Song } from '../songData';
import { svgDrawer } from '../svgDrawer';
import { revertHandler } from '../revertHandler';
import EventBus from '../eventBus';
import { MODALS } from './modalTypes';

interface RepeatAlternativeState extends ModalState {
    trackId?: number;
    blockId?: number;
    voiceId?: number;
}

export class RepeatAlternativeModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.REPEAT_ALTERNATIVE.id, MODALS.REPEAT_ALTERNATIVE.name);
        this.modalState = {
            ...this.modalState
        } as RepeatAlternativeState;
    }

    openModal(params?: { trackId: number; blockId: number; voiceId: number }): void {
        if (!params) return;
        
        const { trackId, blockId, voiceId } = params;
        this.modalState = { ...this.modalState, trackId, blockId, voiceId };
        
        this.showModal();
        this.setRepeatAlternativeState(blockId);
        this.setupRepeatAlternativeButton(trackId, blockId, voiceId);
    }

    protected setupModalContent(): void {
        const { trackId, blockId, voiceId } = this.modalState;
        if (!blockId || !trackId || voiceId === undefined) return;
        
        this.setRepeatAlternativeState(blockId);
        this.setupRepeatAlternativeButton(trackId, blockId, voiceId);
    }

    private setRepeatAlternativeState(blockId: number) {
        let number = Song.measureMeta[blockId].repeatAlternative ?? 0;
        
        for (let u = 0; u < 8; u++) {
            const checkBox = document.getElementById(`styled-checkbox-${u + 1}`) as HTMLInputElement;
            if (checkBox) {
                checkBox.checked = ((number >> u) & 1) === 1;
            }
        }
    }

    private setupRepeatAlternativeButton(trackId: number, blockId: number, voiceId: number) {
        this.setupSelectButton(
            'repeatAlternativeSelectButton',
            () => this.handleRepeatAlternativeSelection(trackId, blockId, voiceId)
        );
    }

    private handleRepeatAlternativeSelection(trackId: number, blockId: number, voiceId: number) {
        this.closeModal();
        
        const meta = Song.measureMeta[blockId];
        const repeatAlternativePresentBefore = meta.repeatAlternativePresent;
        const repeatAlternativeBefore = meta.repeatAlternative;

        if (!meta.repeatAlternativePresent) {
            meta.repeatAlternativePresent = true;
            EventBus.emit("menu.activateEffectsForMarkedPos");
        }

        meta.repeatAlternative = this.calculateRepeatAlternative();

        if (repeatAlternativeBefore !== meta.repeatAlternative) {
            revertHandler.addRepeatAlternative(
                trackId, 
                blockId, 
                repeatAlternativeBefore,
                meta.repeatAlternative, 
                repeatAlternativePresentBefore,
                meta.repeatAlternativePresent
            );
        }

        svgDrawer.rerenderBlock(trackId, blockId, voiceId);
    }

    private calculateRepeatAlternative(): number {
        let value = 0;
        for (let i = 0; i < 7; i++) {
            const checkBox = document.getElementById(`styled-checkbox-${i + 1}`) as HTMLInputElement;
            if (checkBox?.checked) {
                value += 2 ** i;
            }
        }
        return value || -1;
    }
} 