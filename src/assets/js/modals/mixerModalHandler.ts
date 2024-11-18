import { Ref } from 'vue';
import { BaseModalHandler } from './baseModalHandler';

export class MixerModalHandler extends BaseModalHandler {
    private slotVolume: Ref<Array<HTMLCanvasElement> | null> | null = null;

    constructor() {
        super('mixerModal', 'Mixer');
    }

    openModal(params?: any): void {
        this.showModal();
    }

    public getMixerVolumeContext(number: number) {
        if (!this.slotVolume) return null;
        return this.slotVolume.value![number].getContext('2d');
    }

    protected setupModalContent(): void {
        // Add any specific setup needed for mixer modal
    }

    public setSlotVolume(slotVolume: Ref<Array<HTMLCanvasElement> | null>) {
        this.slotVolume = slotVolume;
    }
} 