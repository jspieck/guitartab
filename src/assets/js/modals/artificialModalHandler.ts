import { BaseModalHandler } from './baseModalHandler';
import { Note, Beat } from '../songData';
import fastdom from 'fastdom';
import { typedEventBus } from '../../../utils/typedEventBus';
import { revertHandler } from '../revertHandler';
import { MODALS } from './modalTypes';
import { requestBlocksRender } from '../../../services/editor/renderCommands';

interface NoteData {
    trackId: number;
    blockId: number;
    voiceId: number;
    beatId: number;
    string: number;
    note: Note;
}

interface BeatData {
    trackId: number;
    blockId: number;
    voiceId: number;
    beatId: number;
    beat: Beat;
}

interface ArtificialState {
    notes: NoteData[];
    blocks: number[];
    beats: BeatData[];
}

export class ArtificialModalHandler extends BaseModalHandler {
    private artificialStyle: string = 'N.H.';
    private currentState?: ArtificialState;

    constructor() {
        super(MODALS.ARTIFICIAL.id, MODALS.ARTIFICIAL.name);
    }

    openModal(params: { 
        notes: NoteData[],
        blocks: number[],
        beats: BeatData[]
    }) {
        this.currentState = {
            notes: params.notes,
            blocks: params.blocks,
            beats: params.beats
        };

        // Set initial artificial style from first note
        if (params.notes[0].note.artificialStyle != null) {
            this.artificialStyle = params.notes[0].note.artificialStyle;
        }

        this.showModal();
    }

    protected setupModalContent(): void {
        if (!this.currentState) return;

        // Setup harmonic selection
        const harmonicSelection = document.getElementById('harmonicSelection') as HTMLInputElement;
        harmonicSelection.value = this.artificialStyle;
        
        harmonicSelection.onchange = () => {
            this.artificialStyle = harmonicSelection.value;
        };

        // Setup select button
        this.setupSelectButton('harmonicSelectButton', () => {
            this.applyArtificialToNotes();
        });
    }

    private applyArtificialToNotes() {
        if (!this.currentState) return;

        fastdom.mutate(() => {
            for (const no of this.currentState!.notes) {
                const noteInArr = no.note;
                const artificialBefore = noteInArr.artificialStyle;

                if (artificialBefore == null) {
                    typedEventBus.emit("menu.activateEffectsForNote", noteInArr);
                }

                noteInArr.artificialStyle = this.artificialStyle;

                revertHandler.addArtificial(
                    no.trackId,
                    no.blockId,
                    no.voiceId,
                    no.beatId,
                    no.string,
                    artificialBefore,
                    noteInArr.artificialStyle,
                );
            }

            const { trackId, voiceId } = this.currentState!.notes[0];
            requestBlocksRender(trackId, this.currentState!.blocks, voiceId);
        });
    }
}