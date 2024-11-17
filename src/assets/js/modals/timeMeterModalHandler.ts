import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Song } from '../songData';
import AppManager from '../appManager';
import { revertHandler } from '../revertHandler';
import { tab } from '../tab';

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
        super('timeMeterModal', 'Time Meter');
        this.modalState = {
            ...this.modalState,
            numerator: 4,
            denominator: 4,
            trackId: 0,
            blockId: 0,
            voiceId: 0
        } as TimeMeterModalState;
    }

    openModal(params: { trackId: number; blockId: number; voiceId: number }) {
        const { trackId, blockId, voiceId } = params;
        this.modalState.trackId = trackId;
        this.modalState.blockId = blockId;
        this.modalState.voiceId = voiceId;

        if (Song.measureMeta[blockId].denominator != null) {
            this.modalState.denominator = Song.measureMeta[blockId].denominator;
        }
        if (Song.measureMeta[blockId].numerator != null) {
            this.modalState.numerator = Song.measureMeta[blockId].numerator;
        }

        this.showModal();
    }

    protected setupModalContent(): void {
        // Vue handles the UI updates
    }

    public setTimeMeterState() {
        const { blockId } = this.modalState;
        if (!Song.measureMeta?.[blockId]) {
            console.warn(`No measure meta data found for block ${blockId}`);
            return;
        }

        if (Song.measureMeta[blockId].denominator != null) {
            this.modalState.denominator = Song.measureMeta[blockId].denominator;
        }
        if (Song.measureMeta[blockId].numerator != null) {
            this.modalState.numerator = Song.measureMeta[blockId].numerator;
        }
    }

    public handleSubmit(numerator: number, denominator: number) {
        const { blockId, trackId, voiceId } = this.modalState;
        
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
            Song.measureMeta[bId].numerator = Song.measureMeta[blockId].numerator;
            Song.measureMeta[bId].denominator = Song.measureMeta[blockId].denominator;
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
} 