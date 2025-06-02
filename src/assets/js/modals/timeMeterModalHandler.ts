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
        
        // Ensure measureMeta exists and has proper structure
        if (!Song.measureMeta || !Array.isArray(Song.measureMeta)) {
            console.warn(`Song.measureMeta is not properly initialized`);
            // Set defaults
            this.modalState.denominator = 4;
            this.modalState.numerator = 4;
            return;
        }
        
        if (!Song.measureMeta[blockId]) {
            console.warn(`No measure meta data found for block ${blockId}, using defaults`);
            // Initialize with default values
            Song.measureMeta[blockId] = {
                denominator: 4,
                numerator: 4,
                timeMeterPresent: false,
                bpmPresent: false,
                bpm: 90,
                repeatClosePresent: false,
                repeatOpen: false,
                repeatClose: 0,
                repeatAlternativePresent: false,
                repeatAlternative: 0,
                markerPresent: false,
                marker: { text: '', color: { red: 255, green: 0, blue: 0 } },
                keySignature: 0,
                automations: [],
            };
        }
        
        console.log('Setting time meter state', blockId);

        // Set the modal state with defaults if values are missing
        this.modalState.denominator = Song.measureMeta[blockId].denominator ?? 4;
        this.modalState.numerator = Song.measureMeta[blockId].numerator ?? 4;
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