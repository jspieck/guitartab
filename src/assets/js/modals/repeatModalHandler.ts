import { BaseModalHandler } from './baseModalHandler';
import { Song } from '../songData';
import { svgDrawer } from '../svgDrawer';
import { revertHandler } from '../revertHandler';
import EventBus from '../eventBus';

export class RepeatModalHandler extends BaseModalHandler {
    private repititionData = {
        numRepititions: 1
    };
    private currentTrackId?: number;
    private currentBlockId?: number;
    private currentVoiceId?: number;

    constructor() {
        super('addRepeatAlternativeModal', 'Repeat Alt');
    }

    openModal(params?: { trackId: number; blockId: number; voiceId: number; isRepetition?: boolean }) {
        if (!params) return;
        
        this.currentTrackId = params.trackId;
        this.currentBlockId = params.blockId;
        this.currentVoiceId = params.voiceId;

        if (params.isRepetition) {
            // Handle repetition modal
            this.modalState.modalId = 'repititionNumberModal';
            this.modalState.modalName = 'Repetition';
            this.setRepititionState(params.blockId);
            this.setupRepititionButton(params.trackId, params.blockId, params.voiceId);
        } else {
            // Handle repeat alternative modal
            this.modalState.modalId = 'addRepeatAlternativeModal';
            this.modalState.modalName = 'Repeat Alt';
            this.setRepeatAlternativeState(params.blockId);
            this.setupRepeatAlternativeButton(params.trackId, params.blockId, params.voiceId);
        }

        this.showModal();
    }

    protected setupModalContent(): void {
        if (!this.currentBlockId) return;
        
        this.setRepeatAlternativeState(this.currentBlockId);
        this.setupRepeatAlternativeButton(
            this.currentTrackId!, 
            this.currentBlockId, 
            this.currentVoiceId!
        );
    }

    private setRepeatAlternativeState(blockId: number) {
        let number = Song.measureMeta[blockId].repeatAlternative ?? 0;
        
        for (let u = 0; u < 8; u++) {
            const checkBox = document.getElementById(`styled-checkbox-${u + 1}`) as HTMLInputElement;
            checkBox.checked = ((number >> u) & 1) === 1;
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
            if (checkBox.checked) {
                value += 2 ** i;
            }
        }
        return value || -1;
    }

    private setRepititionState(blockId: number) {
        this.repititionData.numRepititions = Song.measureMeta[blockId].repeatClose ?? 1;
        
        const input = document.getElementById('numberOfRepititionsInput') as HTMLInputElement;
        input.value = this.repititionData.numRepititions.toString();
    }

    private setupRepititionButton(trackId: number, blockId: number, voiceId: number) {
        const numberOfRepititionsInputDom = document.getElementById('numberOfRepititionsInput') as HTMLInputElement;
        numberOfRepititionsInputDom.onchange = null;
        numberOfRepititionsInputDom.onchange = () => {
          this.repititionData.numRepititions = parseInt(numberOfRepititionsInputDom.value, 10);
        };
        document.getElementById('repititionSelectButton')!.onclick = null;
        document.getElementById('repititionSelectButton')!.onclick = () => {
          const repeatClosePresentBefore = Song.measureMeta[blockId].repeatClosePresent;
          if (!repeatClosePresentBefore) {
            Song.measureMeta[blockId].repeatClosePresent = true;
            EventBus.emit("menu.activateEffectsForBlock")
          }
          this.closeModal();
          const repeatCloseBefore = Song.measureMeta[blockId].repeatClose;
          Song.measureMeta[blockId].repeatClose = this.repititionData.numRepititions;
          revertHandler.addRepeatClose(trackId, blockId, repeatCloseBefore,
            Song.measureMeta[blockId].repeatClose, repeatClosePresentBefore,
            Song.measureMeta[blockId].repeatClosePresent);
          svgDrawer.rerenderBlock(trackId, blockId, voiceId);
        };
    }
} 