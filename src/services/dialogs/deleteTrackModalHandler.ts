import { resetScoreTracks } from '../../stores/scoreViewState'
import { selectionState } from '../../stores/selectionState'
import { BaseModalHandler } from './baseModalHandler'
import Song from '../../stores/song'
import { undoHistory } from '../editor/editCommands'
import { requestTrackDeleteRender } from '../editor/renderCommands'
import { notifySongDataChanged } from '../appEvents'
import { switchTrack } from '../editor/trackLoading'
import { DIALOGS } from './dialogs'

export class DeleteTrackModalHandler extends BaseModalHandler {
  private trackToDelete?: number

  constructor() {
    super(DIALOGS.DELETE_TRACK.id, 'Delete')
  }

  openModal(params: { trackId: number }) {
    this.trackToDelete = params.trackId
    this.showModal()
  }

  /** The dialog's Delete button. */
  confirm(): void {
    if (this.trackToDelete !== undefined) this.handleTrackDeletion(this.trackToDelete)
    this.closeModal()
  }

  private handleTrackDeletion(trackId: number) {
    // Update song data
    Song.measures.splice(trackId, 1)
    Song.tracks.splice(trackId, 1)
    Song.playBackInstrument.splice(trackId, 1)

    // Update handlers and UI
    undoHistory.adaptToTrackRemove(trackId)
    // the score's track choice holds track numbers: show all again
    resetScoreTracks()
    requestTrackDeleteRender(trackId)

    this.updateMarkedNote(trackId)
    this.updateCurrentTrack(trackId)
    notifySongDataChanged()
  }

  private updateMarkedNote(trackId: number) {
    if (selectionState.cursor.trackId >= trackId) {
      selectionState.cursor.trackId = Math.max(0, selectionState.cursor.trackId - 1)
    }
  }

  private updateCurrentTrack(trackId: number) {
    if (Song.currentTrackId === trackId) {
      switchTrack(Math.max(0, trackId - 1), 0, true, null)
    }
    if (Song.currentTrackId > trackId) {
      Song.currentTrackId -= 1
    }
  }
}
