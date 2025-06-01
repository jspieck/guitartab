import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Song, Marker } from '../songData';
import EventBus from '../eventBus';
import { revertHandler } from '../revertHandler';
import { svgDrawer } from '../svgDrawer';
import { SequencerHandler } from '../sequencerHandler';
import { MODALS } from './modalTypes';

interface MarkerModalState extends ModalState {
    markerData: Marker;
    trackId: number;
    blockId: number;
    voiceId: number;
}

export class MarkerModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.MARKER.id, MODALS.MARKER.name);
        this.modalState = {
            ...this.modalState,
            markerData: {
                text: '',
                color: { red: 255, blue: 0, green: 0 }
            },
            trackId: 0,
            blockId: 0,
            voiceId: 0
        } as MarkerModalState;
    }

    setupModalContent(): void {}

    openModal(params: { trackId: number; blockId: number; voiceId: number }) {
        const { trackId, blockId, voiceId } = params;
        this.modalState.trackId = trackId;
        this.modalState.blockId = blockId;
        this.modalState.voiceId = voiceId;
        this.setMarkerState();
        this.showModal();
    }

    private setMarkerState() {
        this.resetMarkerData();
        
        const { marker } = Song.measureMeta[this.modalState.blockId];
        if (marker) {
            this.modalState.markerData = { ...marker };
        }
    }

    private resetMarkerData() {
        this.modalState.markerData = {
            text: '',
            color: { red: 255, blue: 0, green: 0 }
        };
    }

    public updateMarkerText(text: string): void {
        this.modalState.markerData.text = text;
    }

    public updateMarkerColor(color: { red: number; green: number; blue: number }): void {
        this.modalState.markerData.color = color;
    }

    public getModalState(): MarkerModalState {
        return this.modalState as MarkerModalState;
    }

    public applyMarker(): void {
        const { blockId, trackId, voiceId, markerData } = this.modalState;

        const markerPresentBefore = Song.measureMeta[blockId].markerPresent != null
            && Song.measureMeta[blockId].markerPresent;

        if (!Song.measureMeta[blockId].markerPresent) {
            Song.measureMeta[blockId].markerPresent = true;
            EventBus.emit("menu.activateEffectsForBlock");
        }

        const markerBefore = Song.measureMeta[blockId].marker;
        Song.measureMeta[blockId].marker = {
            text: markerData.text,
            color: markerData.color,
        };

        revertHandler.addMarker(
            trackId, 
            blockId, 
            markerBefore, 
            Song.measureMeta[blockId].marker,
            markerPresentBefore, 
            Song.measureMeta[blockId].markerPresent
        );

        SequencerHandler.setMarker(blockId);
        svgDrawer.rerenderBlock(trackId, blockId, voiceId);
    }
} 