import { BaseModalHandler } from './baseModalHandler';
import Song from '../songData';
import { svgDrawer } from '../svgDrawer';
import { revertHandler } from '../revertHandler';
import { sequencerHandler } from '../sequencerHandler';
import { tab } from '../tab';
import AppManager from '../appManager';
import fastdom from 'fastdom';

export class DeleteTrackModalHandler extends BaseModalHandler {
    readonly modalType = 'DeleteTrackModal' as const;
    private trackToDelete?: number;

    constructor() {
        super('reallyDeleteModal', 'Delete');
    }

    openModal(params: { trackId: number }) {
        this.trackToDelete = params.trackId;
        this.showModal();
    }

    protected setupModalContent(): void {
        if (this.trackToDelete === undefined) return;

        this.setupSelectButton('yesDelete', () => {
            this.handleTrackDeletion(this.trackToDelete!);
        });

        this.setupSelectButton('noDelete', () => {
            this.closeModal();
        });
    }

    private handleTrackDeletion(trackId: number) {
        // Update song data
        Song.measures.splice(trackId, 1);
        Song.tracks.splice(trackId, 1);
        Song.playBackInstrument.splice(trackId, 1);
        
        // Update handlers and UI
        revertHandler.adaptStackToTrackRemove(trackId);
        svgDrawer.deleteTrack(trackId);
        sequencerHandler.drawBeat();
        
        this.updateMarkedNote(trackId);
        this.updateCurrentTrack(trackId);
    }

    private updateMarkedNote(trackId: number) {
        if (tab.markedNoteObj.trackId >= trackId) {
            tab.markedNoteObj.trackId = Math.max(0, tab.markedNoteObj.trackId - 1);
        }
    }

    private updateCurrentTrack(trackId: number) {
        if (Song.currentTrackId === trackId) {
            AppManager.changeTrack(Math.max(0, trackId - 1), 0, true, null);
        }
        if (Song.currentTrackId > trackId) {
            Song.currentTrackId -= 1;
        }
    }
} 