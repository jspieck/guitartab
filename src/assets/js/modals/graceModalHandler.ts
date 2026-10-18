import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Note, Beat } from '../songData';
import { revertHandler } from '../revertHandler';
import { classicalNotation } from '../../../services/editor/classicalNotationAdapter';
import { typedEventBus } from '../../../utils/typedEventBus';
import { MODALS } from './modalTypes';
import { requestBlocksRender } from '../../../services/editor/renderCommands';

interface GraceModalState extends ModalState {
    graceData: {
        fret: number;
        duration: string;
        dynamic: string;
        transition: string;
        setOnBeat: string;
        string: number;
        height: number;
        dead: boolean;
    };
    notes: {
        trackId: number;
        blockId: number;
        voiceId: number;
        beatId: number;
        string: number;
        note: Note;
    }[];
    blocks: number[];
}

export class GraceModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.GRACE.id, MODALS.GRACE.name);
        this.modalState = {
            ...this.modalState,
            graceData: {
                fret: 0,
                duration: 's',
                dynamic: 'f',
                transition: 'none',
                setOnBeat: 'before',
                string: 0,
                height: 0,
                dead: false
            },
            notes: [],
            blocks: []
        } as GraceModalState;
    }

    updateGraceData(data: {
        fret: number;
        duration: string;
        dynamic: string;
        transition: string;
        setOnBeat: string;
    }) {
        this.modalState.graceData = {
            ...this.modalState.graceData,
            ...data
        };
    }

    getModalState(): GraceModalState {
        return this.modalState as GraceModalState;
    }

    openModal(params: {
        notes: {
            trackId: number;
            blockId: number;
            voiceId: number;
            beatId: number;
            string: number;
            note: Note;
        }[];
        blocks: number[];
        beats: {
            trackId: number;
            blockId: number;
            voiceId: number;
            beatId: number;
            beat: Beat;
        }[];
    }) {
        this.modalState.notes = params.notes;
        this.modalState.blocks = params.blocks;
        this.setInitialGraceState(params.notes[0].note);
        this.showModal();
    }

    private setInitialGraceState(note: Note) {
        if (note.graceObj) {
            this.modalState.graceData = {
                ...this.modalState.graceData,
                ...note.graceObj
            };
        }
    }

    protected setupModalContent(): void {
        // Vue handles the content setup
    }

    applyGrace() {
        for (const no of this.modalState.notes) {
            const noteInArr = no.note;
            const graceObjBefore = noteInArr.graceObj;

            noteInArr.graceObj = { ...this.modalState.graceData };

            if (graceObjBefore == null) {
                typedEventBus.emit("menu.activateEffectsForNote", noteInArr);
            }

            revertHandler.addGrace(
                no.trackId,
                no.blockId,
                no.voiceId,
                no.beatId,
                no.string,
                graceObjBefore,
                noteInArr.graceObj,
            );
        }

        const { trackId, voiceId } = this.modalState.notes[0];
        classicalNotation.computeVexFlowDataStructures(trackId, voiceId);
        requestBlocksRender(trackId, this.modalState.blocks, voiceId);
    }
} 