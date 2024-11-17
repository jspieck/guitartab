import { BaseModalHandler } from './baseModalHandler';
import { ref, computed } from 'vue';
import Song from '../songData';

export class GuitarModalHandler extends BaseModalHandler {
    readonly modalType = 'GuitarModal' as const;
    
    // State
    public numStrings = ref(6);
    public numFrets = ref(25);
    public capo = ref(0);
    public dotPositions = ref([3, 5, 7, 9, 15, 17, 19, 21]);
    public noteMarkersVisibility = ref(
        Array.from({ length: this.numStrings.value }, 
        () => Array.from({ length: this.numFrets.value }, () => true))
    );

    // Computed
    public halfStrings = computed(() => Math.ceil(this.numStrings.value / 2));
    public capoStyleRight = computed(() => {
        const fretPercentage = (this.capo.value - 1) / (this.numFrets.value + 1) * 100;
        return this.capo.value > 0 ? fretPercentage - 1.3 : 0;
    });
    
    constructor() {
        super('guitarModal', 'Guitar');
    }

    openModal(params?: { capo?: number }) {
        if (params?.capo !== undefined) {
            this.setCapo(params.capo);
        }
        this.showModal();
    }

    setCapo(newCapo: number) {
        this.capo.value = newCapo;
    }

    isNoteMarkerVisible(string: number, fret: number) {
        return this.noteMarkersVisibility.value[string][fret];
    }

    markNoteOnGuitar(string: number, fretWithCapo: number, stringDomElement: HTMLElement) {
        const { capo } = Song.tracks[Song.currentTrackId];
        if (fretWithCapo !== capo) {
            this.noteMarkersVisibility.value[string][fretWithCapo - 1] = true;
        }
        if (stringDomElement != null) {
            stringDomElement.style.borderBottom = '3px solid #cfbf89';
        }
    }

    unmarkNoteOnGuitar(string: number, fretWithCapo: number, stringDomElement: HTMLElement) {
        this.noteMarkersVisibility.value[string][fretWithCapo - 1] = false;
        if (stringDomElement != null) {
            stringDomElement.style.borderBottom = '2px solid #958963';
        }
    }

    setupModalContent() {
        // Handled by Vue
    }
} 