import { BaseModalHandler, ModalState } from './baseModalHandler';
import { MODALS } from './modalTypes';
import { typedEventBus } from '../../../utils/typedEventBus';

interface ChordManagerState extends ModalState {
    trackId: number;
}

export class ChordManagerModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.CHORD_MANAGER.id, MODALS.CHORD_MANAGER.name);
        this.modalState = {
            ...this.modalState,
            trackId: 0
        } as ChordManagerState;
    }

    protected setupModalContent(): void {}

    openModal(params: { trackId: number }): void {
        this.modalState.trackId = params.trackId;
        this.showModal();
        typedEventBus.emit('render.chordDiagrams');
    }

    public getTrackId(): number {
        return this.modalState.trackId;
    }
}
