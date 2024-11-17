import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Measure } from '../songData';
import { svgDrawer } from '../svgDrawer';
import { revertHandler } from '../revertHandler';
import EventBus from '../eventBus';
import fastdom from 'fastdom';
import { MODALS } from './modalTypes';

interface TextModalState extends ModalState {
    text: string;
    trackId: number;
    blockId: number;
    voiceId: number;
    beatId: number;
    beat: Measure | null;
}

export class TextModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.TEXT.id, MODALS.TEXT.name);
        this.modalState = {
            ...this.modalState,
            text: '',
            trackId: 0,
            blockId: 0,
            voiceId: 0,
            beatId: 0,
            beat: null
        } as TextModalState;
    }

    openModal(params: { 
        trackId: number; 
        blockId: number; 
        voiceId: number; 
        beatId: number; 
        beat: Measure 
    }) {
        const { trackId, blockId, voiceId, beatId, beat } = params;
        this.modalState.trackId = trackId;
        this.modalState.blockId = blockId;
        this.modalState.voiceId = voiceId;
        this.modalState.beatId = beatId;
        this.modalState.beat = beat;
        this.modalState.text = beat.text ?? '';
        this.showModal();
    }

    protected setupModalContent(): void {
        this.updateTextInput();
        this.setupEventListeners();
    }

    private updateTextInput() {
        const textSelection = document.getElementById('textSelection') as HTMLInputElement;
        textSelection.value = this.modalState.text;
    }

    private setupEventListeners() {
        this.setupSelect('textSelection', (value) => {
            this.modalState.text = value;
        });

        this.setupSelectButton('textSelectButton', () => {
            this.applyText();
        });
    }

    private applyText() {
        const { trackId, blockId, voiceId, beatId, beat, text } = this.modalState;
        
        if (!beat) return;

        fastdom.mutate(() => {
            const textPresentBefore = beat.textPresent;
            const textBefore = beat.text;

            if (!beat.textPresent) {
                beat.textPresent = true;
                EventBus.emit("menu.activateEffectsForBeat", beat);
            }

            beat.text = text;
            
            svgDrawer.rerenderBlock(trackId, blockId, voiceId);
            revertHandler.addText(
                trackId, 
                blockId, 
                voiceId, 
                beatId,
                textBefore, 
                beat.text, 
                textPresentBefore, 
                beat.textPresent
            );
        });
    }
} 