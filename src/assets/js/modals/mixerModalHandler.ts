import { BaseModalHandler } from './baseModalHandler';

export class MixerModalHandler extends BaseModalHandler {
    constructor() {
        super('mixerModal', 'Mixer');
    }

    openModal(params?: any): void {
        this.showModal();
    }

    protected setupModalContent(): void {
        // Add any specific setup needed for mixer modal
    }
} 