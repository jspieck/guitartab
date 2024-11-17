import { BaseModalHandler } from './baseModalHandler';

export class EqualizerModalHandler extends BaseModalHandler {
    constructor() {
        super('equalizerModal', 'Equalizer');
    }

    openModal(params?: any): void {
        this.showModal();
    }

    protected setupModalContent(): void {
        // Add any specific setup needed for equalizer modal
    }
} 