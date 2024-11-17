import { BaseModalHandler } from './baseModalHandler';

export class CompressorModalHandler extends BaseModalHandler {
    constructor() {
        super('compressorModal', 'Compressor');
    }

    openModal(params?: any): void {
        this.showModal();
    }

    protected setupModalContent(): void {
        // Add any specific setup needed for compressor modal
    }
} 