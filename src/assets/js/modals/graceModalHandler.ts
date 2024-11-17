import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Note, Measure } from '../songData';
import { svgDrawer } from '../svgDrawer';
import { revertHandler } from '../revertHandler';
import { classicalNotation } from '../vexflowClassical';
import EventBus from '../eventBus';
import { MODALS } from './modalTypes';

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
    gracePresentBefore: { [noteStr: string]: boolean };
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
            blocks: [],
            gracePresentBefore: {}
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
            beat: Measure;
        }[];
    }) {
        this.modalState.notes = params.notes;
        this.modalState.blocks = params.blocks;
        this.setGracePresentState();
        this.setInitialGraceState(params.notes[0].note);
        this.showModal();
    }

    private setGracePresentState() {
        this.modalState.gracePresentBefore = {};
        for (const no of this.modalState.notes) {
            const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
            this.modalState.gracePresentBefore[noteStr] = no.note.gracePresent;
        }
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

            if (!noteInArr.gracePresent) {
                noteInArr.gracePresent = true;
                EventBus.emit("menu.activateEffectsForNote", noteInArr);
            }

            const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
            revertHandler.addGrace(
                no.trackId,
                no.blockId,
                no.voiceId,
                no.beatId,
                no.string,
                graceObjBefore,
                noteInArr.graceObj,
                this.modalState.gracePresentBefore[noteStr],
                noteInArr.gracePresent
            );
        }

        const { trackId, voiceId } = this.modalState.notes[0];
        classicalNotation.computeVexFlowDataStructures(trackId, voiceId);
        svgDrawer.rerenderBlocks(trackId, this.modalState.blocks, voiceId);
    }
} 