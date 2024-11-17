import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Song, Marker } from '../songData';
import Picker from 'vanilla-picker';
import EventBus from '../eventBus';
import { revertHandler } from '../revertHandler';
import { svgDrawer } from '../svgDrawer';
import { Sequencer } from '../sequencer';

interface MarkerModalState extends ModalState {
    markerData: Marker;
    trackId: number;
    blockId: number;
    voiceId: number;
}

export class MarkerModalHandler extends BaseModalHandler {
    readonly modalType = 'MarkerModal' as const;

    constructor() {
        super('markerModal', 'Marker');
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

    openModal(params: { trackId: number; blockId: number; voiceId: number }) {
        const { trackId, blockId, voiceId } = params;
        this.modalState.trackId = trackId;
        this.modalState.blockId = blockId;
        this.modalState.voiceId = voiceId;
        this.setMarkerState();
        this.showModal();
    }

    protected setupModalContent(): void {
        this.updateMarkerInput();
        this.setupMarkerColorPicker();
        this.setupEventListeners();
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

    private updateMarkerInput() {
        const input = document.getElementById('markerSelection') as HTMLInputElement;
        input.value = this.modalState.markerData.text;
    }

    private setupMarkerColorPicker() {
        const { color } = this.modalState.markerData;
        const pickerParent = document.getElementById('markerColorPicker')!;
        
        const picker = new Picker({
            parent: pickerParent,
            color: `rgb(${color.red},${color.green},${color.blue})`,
            popup: false
        });

        picker.onChange = (color: {rgba: number[]}) => {
            this.modalState.markerData.color = {
                red: color.rgba[0],
                green: color.rgba[1],
                blue: color.rgba[2]
            };
        };
    }

    private setupEventListeners() {
        const { blockId, trackId, voiceId } = this.modalState;

        this.setupSelect('markerSelection', (value) => {
            this.modalState.markerData.text = value;
        });

        this.setupSelectButton('markerSelectButton', () => {
            const markerPresentBefore = Song.measureMeta[blockId].markerPresent != null
                && Song.measureMeta[blockId].markerPresent;

            if (!Song.measureMeta[blockId].markerPresent) {
                Song.measureMeta[blockId].markerPresent = true;
                EventBus.emit("menu.activateEffectsForBlock");
            }

            const markerBefore = Song.measureMeta[blockId].marker;
            Song.measureMeta[blockId].marker = {
                text: this.modalState.markerData.text,
                color: this.modalState.markerData.color,
            };

            revertHandler.addMarker(
                trackId, 
                blockId, 
                markerBefore, 
                Song.measureMeta[blockId].marker,
                markerPresentBefore, 
                Song.measureMeta[blockId].markerPresent
            );

            Sequencer.setMarker(blockId);
            svgDrawer.rerenderBlock(trackId, blockId, voiceId);
        });
    }
} 