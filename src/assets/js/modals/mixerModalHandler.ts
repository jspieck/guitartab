import { BaseModalHandler } from './baseModalHandler';

export class MixerModalHandler extends BaseModalHandler {
    constructor() {
        super('mixerModal', 'Drum Mixer');
    }

    openModal(): void {
        this.showModal();
    }

    protected setupModalContent(): void {
        // The Vue component renders everything and drives its own meters.
    }
}
