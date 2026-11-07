import { DIALOGS, dialogHandler, openDialog } from '../dialogs/dialogs'
import type { AddTrackModalHandler } from '../dialogs/addTrackModalHandler'
import { showUserError } from '../userNotifications'
import editorCore from './editorCore'

/**
 * Track actions shared by the sequencer and the phone's ⋯ menu: settings (name, strings,
 * capo, tuning, colour), changing the instrument, adding and deleting a track.
 */

function addTrackHandler(): Promise<AddTrackModalHandler> {
  return dialogHandler<AddTrackModalHandler>(DIALOGS.ADD_TRACK)
}

export async function openTrackSettings(trackId: number): Promise<void> {
  // The settings dialog reads the track the instrument dialog would change.
  ;(await addTrackHandler()).setNumberOfTrackToAdd(trackId)
  await openDialog(DIALOGS.INSTRUMENT_SETTINGS, { trackId })
}

/** The instrument picker, changing the instrument of `trackId`. */
export async function openChangeInstrument(trackId: number): Promise<void> {
  // openModal sets the target track itself; without an argument it adds a track.
  ;(await addTrackHandler()).openModal(trackId)
}

export async function openAddTrack(): Promise<void> {
  ;(await addTrackHandler()).openModal()
}

/** Asks before deleting; the last track can't be deleted. */
export function requestDeleteTrack(trackId: number): void {
  if (!editorCore.canDeleteTrack()) {
    showUserError('A song needs at least one track.')
    return
  }
  void openDialog(DIALOGS.DELETE_TRACK, { trackId })
}
