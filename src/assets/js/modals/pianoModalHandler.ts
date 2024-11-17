import { BaseModalHandler } from './baseModalHandler';
import { ref, computed } from 'vue';
import midiEngine from '../midiReceiver';

export class PianoModalHandler extends BaseModalHandler {
    readonly modalType = 'PianoModal' as const;
    
    // State
    public numTasten = ref(56);
    public clickedKeyOnPiano = ref(0);
    
    // Computed
    public keys = computed(() => {
        const keys = [];
        let keyNumber = 0;
        for (let i = 0; i < this.numTasten.value; i += 1) {
            const startKeyNumber = keyNumber;
            const hasUpperKey = i % 7 !== 2 && i % 7 !== 6;
            keys.push({ startKeyNumber, hasUpperKey });
            keyNumber += hasUpperKey ? 2 : 1;
        }
        return keys;
    });
    
    constructor() {
        super('pianoModal', 'Piano');
    }

    openModal() {
        this.showModal();
    }

    onKeyMouseDown(keyNumber: number) {
        midiEngine.noteOn(keyNumber, 80);
        this.clickedKeyOnPiano.value = keyNumber;
    }

    setupModalContent() {
        // Handled by Vue
    }
} 