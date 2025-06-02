import { Ref, ref } from 'vue';
import Helper from './helper';
import Song from './songData';

class SequencerHandler {
    private static instance: SequencerHandler;
    private editModeActive: Ref<boolean> = ref(false); // Default value
    private faderContexts: Map<number, CanvasRenderingContext2D> = new Map();
    private sequencerRedrawCallback: (() => void) | null = null;
    private sequencerSetIndicatorCallback: ((trackId: number, blockId: number) => void) | null = null;

    private constructor() { }

    public static getInstance(): SequencerHandler {
        if (!SequencerHandler.instance) {
            SequencerHandler.instance = new SequencerHandler();
        }
        return SequencerHandler.instance;
    }

    public registerEditModeActiveRef(editModeRef: Ref<boolean>) {
        this.editModeActive = editModeRef;
    }

    public registerSequencerRedrawCallback(callback: () => void) {
        this.sequencerRedrawCallback = callback;
    }

    public registerSequencerSetIndicatorCallback(callback: (trackId: number, blockId: number) => void) {
        this.sequencerSetIndicatorCallback = callback;
    }

    public isEditModeActive(): boolean {
        return this.editModeActive.value;
    }

    public toggleEditMode() {
        this.editModeActive.value = !this.editModeActive.value;
    }

    public registerFaderContext(id: number, context: CanvasRenderingContext2D | null) {
        if (context) {
            this.faderContexts.set(id, context);
        } else {
            // If context is null, it implies it should be removed or was never valid
            this.faderContexts.delete(id);
        }
    }

    public unregisterFaderContext(id: number) {
        this.faderContexts.delete(id);
    }

    public getVolumeCanvasContext(id: number): CanvasRenderingContext2D | null {
        return this.faderContexts.get(id) || null;
    }

    public redrawSequencerMain() {
        // In Vue.js, the sequencer redraws automatically due to reactivity
        // However, we can provide a callback mechanism if needed for forced updates
        if (this.sequencerRedrawCallback) {
            this.sequencerRedrawCallback();
        }
        // Otherwise, the reactive system in Sequencer.vue handles this automatically
    }

    public drawBeat() {
        // In the old sequencer.ts, this method recreated the entire sequencer sidebar
        // In Vue.js, this is handled automatically by the reactive template system
        // For backward compatibility, we can trigger a redraw if needed
        this.redrawSequencerMain();
    }

    public setIndicator(trackId: number, blockId: number) {
        // In the old sequencer.ts, this method set the indicator position in the sequencer
        // In Sequencer.vue, this is handled by the setIndicator function
        // We can provide a callback mechanism for this as well
        if (this.sequencerSetIndicatorCallback) {
            this.sequencerSetIndicatorCallback(trackId, blockId);
        }
    }

    // Static methods for compatibility with old sequencer.ts
    public static setMarker(blockId: number) {
        const seqMaster = document.getElementById(`sequenceMaster_${blockId}`);
        Helper.removeAllChildren(seqMaster);
        if (Song.measureMeta[blockId].marker != null) {
            const beatText = document.createElement('div');
            beatText.textContent = Song.measureMeta[blockId].marker.text;
            beatText.setAttribute('class', 'beatText');
            seqMaster?.appendChild(beatText);
        }
    }

    public static removeMarker(blockId: number) {
        Helper.removeAllChildren(document.getElementById(`sequenceMaster_${blockId}`));
    }

    public static removeOverlay() {
        const intervalMarkerBody = document.getElementById('intervalMarkerBody');
        if (intervalMarkerBody != null) {
            intervalMarkerBody.parentNode?.removeChild(intervalMarkerBody);
        }
        const intervalMarkerHeader = document.getElementById('intervalMarkerHeader');
        if (intervalMarkerHeader != null) {
            intervalMarkerHeader.parentNode?.removeChild(intervalMarkerHeader);
        }
    }

    // TODO: Add other methods to interact with Sequencer.vue
}

export const sequencerHandler = SequencerHandler.getInstance();
export { SequencerHandler }; 