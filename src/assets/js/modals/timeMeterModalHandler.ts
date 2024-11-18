import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Song } from '../songData';
import AppManager from '../appManager';
import { revertHandler } from '../revertHandler';
import { tab } from '../tab';
import { MODALS } from "./modalTypes";

interface TimeMeterModalState extends ModalState {
    numerator: number;
    denominator: number;
    trackId: number;
    blockId: number;
    voiceId: number;
}

export class TimeMeterModalHandler extends BaseModalHandler {
    readonly modalType = 'TimeMeterModal' as const;

    constructor() {
        super(MODALS.TIME_METER.id, MODALS.TIME_METER.name);
        this.modalState = {
            ...this.modalState,
            numerator: 4,
            denominator: 4,
            trackId: 0,
            blockId: 0,
            voiceId: 0
        } as TimeMeterModalState;
    }

    public getModalState(): TimeMeterModalState {
        return this.modalState as TimeMeterModalState;
    }

    public updateNumerator(value: number): void {
        console.log('Updating numerator', this.modalState);
        this.modalState.numerator = value;
        console.log('Updating numerator', this.modalState);
    }

    public updateDenominator(value: number): void {
        this.modalState.denominator = value;
        console.log('Updating denominator', this.modalState);
    }

    openModal(params: { trackId: number; blockId: number; voiceId: number }) {
        const { trackId, blockId, voiceId } = params;
        this.modalState.trackId = trackId;
        this.modalState.blockId = blockId;
        this.modalState.voiceId = voiceId;
        console.log('Opening time meter modal', trackId, blockId, voiceId, this.modalState.blockId);

        this.setTimeMeterState();
        this.showModal();
        console.log('Modal state', this.modalState);
    }

    public setTimeMeterState(): void {
        const { blockId } = this.modalState;
        if (!Song.measureMeta?.[blockId]) {
            console.warn(`No measure meta data found for block ${blockId}`);
            return;
        }
        console.log('Setting time meter state', blockId);

        if (Song.measureMeta[blockId].denominator != null) {
            this.modalState.denominator = Song.measureMeta[blockId].denominator;
        }
        if (Song.measureMeta[blockId].numerator != null) {
            this.modalState.numerator = Song.measureMeta[blockId].numerator;
        }
    }

    public handleSubmit(): boolean {
        console.log('Handling submit', this.modalState);
        const { blockId, trackId, voiceId, numerator, denominator } = this.modalState;

        console.log('Handling submit', blockId, trackId, voiceId, numerator, denominator);
        
        Song.measureMeta[blockId].timeMeterPresent = true;
        
        const numeratorBefore = Song.measureMeta[blockId].numerator;
        const denominatorBefore = Song.measureMeta[blockId].denominator;

        Song.measureMeta[blockId].numerator = numerator;
        Song.measureMeta[blockId].denominator = denominator;

        const notesBefore = AppManager.checkAndAdaptTimeMeter(blockId);
        if (notesBefore == null) {
            Song.measureMeta[blockId].numerator = numeratorBefore;
            Song.measureMeta[blockId].denominator = denominatorBefore;
            Song.measureMeta[blockId].timeMeterPresent = false;
            return false;
        }

        // Set until the end of track/ next timeMeter
        for (let bId = blockId + 1; bId < Song.measureMeta.length; bId += 1) {
            if (Song.measureMeta[bId].timeMeterPresent) break;
            Song.measureMeta[bId].numerator = numerator;
            Song.measureMeta[bId].denominator = denominator;
        }

        revertHandler.addTimeMeter(
            trackId,
            blockId,
            voiceId,
            numeratorBefore,
            numerator,
            denominatorBefore,
            denominator,
            false,
            true,
            notesBefore
        );

        tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
        return true;
    }

    setupModalContent() {
        this.setTimeMeterState();
    }
} 