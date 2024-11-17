import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Song } from '../songData';
import EventBus from '../eventBus';
import { revertHandler } from '../revertHandler';
import { svgDrawer } from '../svgDrawer';
import { MODALS } from './modalTypes';

interface TempoModalState extends ModalState {
    bpm: number;
    oldBpm: number;
    initYPos: number;
    trackId: number;
    blockId: number;
    voiceId: number;
}

export class TempoModalHandler extends BaseModalHandler {
    private tempoFuncBinded: (e: MouseEvent) => void;
    private remTempoBinded: (e: MouseEvent) => void;

    constructor() {
        super(MODALS.TEMPO.id, MODALS.TEMPO.name);
        this.modalState = {
            ...this.modalState,
            bpm: 90,
            oldBpm: 0,
            initYPos: 0,
            trackId: 0,
            blockId: 0,
            voiceId: 0
        } as TempoModalState;

        this.tempoFuncBinded = this.changeTempoFunc.bind(this);
        this.remTempoBinded = this.removeEventListenersTempo.bind(this);
    }

    openModal(params: { trackId: number; blockId: number; voiceId: number }) {
        const { trackId, blockId, voiceId } = params;
        this.modalState.trackId = trackId;
        this.modalState.blockId = blockId;
        this.modalState.voiceId = voiceId;
        this.modalState.bpm = 90;
        this.showModal();
    }

    protected setupModalContent(): void {
        this.updateTempoDisplay();
        this.setupDragHandling();
        this.setupEventListeners();
    }

    private updateTempoDisplay() {
        const tempoMeter = document.getElementById('tempoMeterModal')!;
        tempoMeter.textContent = this.modalState.bpm.toString();
    }

    private setupDragHandling() {
        const tempoMeter = document.getElementById('tempoMeterModal')!;
        tempoMeter.onmousedown = (e: MouseEvent) => {
            this.modalState.initYPos = e.pageY;
            this.modalState.oldBpm = this.modalState.bpm;

            document.body.classList.add('disableMouseEffects');
            document.addEventListener('mousemove', this.tempoFuncBinded);
            document.addEventListener('mouseup', this.remTempoBinded);
        };
    }

    private setupEventListeners() {
        this.setupSelectButton('bpmSelectButton', () => {
            this.applyTempoChange();
        });
    }

    private removeEventListenersTempo() {
        document.body.classList.remove('disableMouseEffects');
        document.removeEventListener('mousemove', this.tempoFuncBinded);
        document.removeEventListener('mouseup', this.remTempoBinded);
    }

    private changeTempoFunc(event: MouseEvent) {
        const tempoMeter = document.getElementById('tempoMeterModal')!;
        const mouseYnew = event.pageY;

        this.modalState.bpm = this.modalState.oldBpm + 
            this.modalState.initYPos - mouseYnew;
        this.modalState.bpm = Math.max(10, Math.min(this.modalState.bpm, 180));

        tempoMeter.textContent = this.modalState.bpm.toString();
    }

    private applyTempoChange() {
        const { blockId, trackId, voiceId } = this.modalState;
        const { bpmPresent } = Song.measureMeta[blockId];
        
        if (!bpmPresent) {
            Song.measureMeta[blockId].bpmPresent = true;
            EventBus.emit("menu.activateEffectsForBlock");
        }

        const bpmBefore = Song.measureMeta[blockId].bpm;
        Song.measureMeta[blockId].bpm = this.modalState.bpm;

        revertHandler.addBpmMeter(
            trackId, 
            blockId, 
            voiceId, 
            bpmPresent,
            Song.measureMeta[blockId].bpmPresent, 
            bpmBefore, 
            Song.measureMeta[blockId].bpm
        );

        if (trackId === Song.currentTrackId && voiceId === Song.currentVoiceId) {
            svgDrawer.rerenderBlock(trackId, blockId, voiceId);
        }
    }
} 