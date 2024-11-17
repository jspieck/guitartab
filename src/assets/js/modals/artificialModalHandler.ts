import { BaseModalHandler } from './baseModalHandler';
import { Note, Measure } from '../songData';
import fastdom from 'fastdom';
import EventBus from '../eventBus';
import { revertHandler } from '../revertHandler';
import { svgDrawer } from '../svgDrawer';

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
    beat: Measure;
}

interface ArtificialState {
    notes: NoteData[];
    blocks: number[];
    beats: BeatData[];
    artificialPresentBefore: { [noteStr: string]: boolean };
}

export class ArtificialModalHandler extends BaseModalHandler {
    private artificialStyle: string = 'N.H.';
    private currentState?: ArtificialState;

    constructor() {
        super('addHarmonicModal', 'Artificial');
    }

    openModal(params: { 
        notes: NoteData[],
        blocks: number[],
        beats: BeatData[]
    }) {
        this.currentState = {
            notes: params.notes,
            blocks: params.blocks,
            beats: params.beats,
            artificialPresentBefore: {}
        };

        // Store initial artificial states
        for (const no of params.notes) {
            const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
            this.currentState.artificialPresentBefore[noteStr] = no.note.artificialPresent;
        }

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
                const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
                const artificialBefore = noteInArr.artificialStyle;

                if (!noteInArr.artificialPresent) {
                    noteInArr.artificialPresent = true;
                    EventBus.emit("menu.activateEffectsForNote", noteInArr);
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
                    this.currentState!.artificialPresentBefore[noteStr],
                    noteInArr.artificialPresent
                );
            }

            const { trackId, voiceId } = this.currentState!.notes[0];
            svgDrawer.rerenderBlocks(trackId, this.currentState!.blocks, voiceId);
        });
    }
}