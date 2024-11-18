import { BaseModalHandler, ModalState } from './baseModalHandler';
import { Note, Measure } from '../songData';
import { svgDrawer } from '../svgDrawer';
import { revertHandler } from '../revertHandler';
import { menuHandler } from '../menuHandler';
import { tab } from '../tab';
import EventBus from '../eventBus';
import fastdom from 'fastdom';
import { MODALS } from './modalTypes';

interface NoteInfo {
    trackId: number;
    blockId: number;
    voiceId: number;
    beatId: number;
    string: number;
    note: Note;
}

interface TremoloPickingModalState extends ModalState {
    tremoloPickingLength: string;
    notes: NoteInfo[];
    blocks: number[];
    presentBefore: { [key: string]: boolean };
    isVariableSet: boolean;
}

export class TremoloPickingModalHandler extends BaseModalHandler {
    constructor() {
        super(MODALS.TREMOLO_PICKING.id, MODALS.TREMOLO_PICKING.name);
        this.modalState = {
            ...this.modalState,
            tremoloPickingLength: 'e',
            notes: [],
            blocks: [],
            presentBefore: {},
            isVariableSet: false
        } as TremoloPickingModalState;
    }

    setupModalContent(): void {}

    openModal(params: {
        notes: Note[];
        blocks: number[];
        beats: { trackId: number; blockId: number; voiceId: number; beatId: number; beat: Measure }[];
        isVariableSet: boolean;
    }) {
        this.modalState.notes = params.notes;
        this.modalState.blocks = params.blocks;
        this.modalState.isVariableSet = params.isVariableSet;
        this.recordPresentState();
        this.setTremoloPickingState();
        this.showModal();
    }

    private recordPresentState() {
        this.modalState.presentBefore = {};
        for (const noteInfo of this.modalState.notes) {
            const noteStr = this.getNoteString(noteInfo);
            this.modalState.presentBefore[noteStr] = noteInfo.note.tremoloPicking;
        }
    }

    private setTremoloPickingState() {
        const firstNote = this.modalState.notes[0]?.note;
        if (firstNote?.tremoloPickingLength) {
            this.modalState.tremoloPickingLength = firstNote.tremoloPickingLength;
        }
    }

    public updateTremoloPickingLength(length: string): void {
        this.modalState.tremoloPickingLength = length;
    }

    public getModalState(): TremoloPickingModalState {
        return this.modalState as TremoloPickingModalState;
    }

    public applyTremoloPicking(): void {
        const { notes, blocks, isVariableSet } = this.modalState;
        const notesBefore = menuHandler.handleEffectGroupCollision(notes, 'tremoloPicking', isVariableSet);

        fastdom.mutate(() => {
            for (const noteInfo of notes) {
                this.processNoteSelection(noteInfo, notesBefore as { [key: string]: Note });
            }

            svgDrawer.rerenderBlocks(notes[0].trackId, blocks, notes[0].voiceId);
        });
    }

    private processNoteSelection(noteInfo: NoteInfo, notesBefore: { [key: string]: Note }) {
        const { note } = noteInfo;
        const noteStr = this.getNoteString(noteInfo);

        if (!note.tremoloPicking) {
            note.tremoloPicking = true;
            if (this.isMarkedNote(noteInfo)) {
                EventBus.emit("menu.activateEffectsForNote", note);
            }
        }

        const lengthBefore = note.tremoloPickingLength;
        note.tremoloPickingLength = this.modalState.tremoloPickingLength;

        revertHandler.addTremoloPicking(
            noteInfo.trackId,
            noteInfo.blockId,
            noteInfo.voiceId,
            noteInfo.beatId,
            noteInfo.string,
            lengthBefore,
            note.tremoloPickingLength,
            this.modalState.presentBefore[noteStr],
            note.tremoloPicking,
            notesBefore[noteStr]
        );
    }

    private getNoteString(noteInfo: NoteInfo): string {
        return `${noteInfo.trackId}_${noteInfo.blockId}_${noteInfo.voiceId}_${noteInfo.beatId}_${noteInfo.string}`;
    }

    private isMarkedNote(noteInfo: NoteInfo): boolean {
        return noteInfo.blockId === tab.markedNoteObj.blockId && 
               noteInfo.beatId === tab.markedNoteObj.beatId;
    }
} 