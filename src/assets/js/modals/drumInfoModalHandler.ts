import { BaseModalHandler, ModalState } from './baseModalHandler';
import { MODALS } from './modalTypes';
import audioEngine from '../audioEngine';
import AppManager from '../appManager';
import { tab } from '../tab';

interface DrumInfoState extends ModalState {
    selectedNote?: number;
}

export class DrumInfoModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.DRUM_INFO.id, MODALS.DRUM_INFO.name);
        this.modalState = {
            ...this.modalState,
            selectedNote: undefined
        } as DrumInfoState;
    }

    openModal(params?: any): void {
        this.showModal();
        if (params) {
            this.modalState.selectedNote = params.note;
        }
    }

    protected setupModalContent(): void {
        this.initializeIfNeeded(() => {
            this.setupDrumInfoDisplay();
        });
    }

    private setupDrumInfoDisplay(): void {
        const drumInfoContainer = document.getElementById('drumInfo');
        if (!drumInfoContainer) return;

        // Clear existing event listeners if any
        const oldContainer = drumInfoContainer.cloneNode(true);
        drumInfoContainer.parentNode?.replaceChild(oldContainer, drumInfoContainer);

        // Add click handlers for drum info items
        (oldContainer as Element).querySelectorAll('div').forEach((div: Element) => {
            div.addEventListener('click', () => {
                const key = parseInt(div.querySelector('.sp3')?.textContent || '0', 10);
                const { trackId, blockId, voiceId, beatId, string } = tab.markedNoteObj;
                AppManager.placeNote(trackId, blockId, voiceId, beatId, string, key);
            });
        });
    }

    // Helper method to get drum info
    getDrumInfo(noteNumber: number): [string, number, number, number, boolean, string] {
        return audioEngine.noteToDrum.get(noteNumber) || ['', 0, 0, 0, false, ''];
    }
} 