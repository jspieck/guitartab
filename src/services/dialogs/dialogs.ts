import { hideAllDialogs, hideDialog, isDialogOpen, showDialog } from '../../stores/dialogState'
import type { BaseModalHandler } from './baseModalHandler'

/**
 * Every dialog window by id and footer name, and how editor code opens one. The handlers
 * (what a dialog reads and writes) are a lazy chunk (`dialogHandlers.ts`), loaded with the
 * first dialog that opens; the dialog components mount when they are first shown
 * (`ModalsContainer`). Nothing here touches the DOM.
 */
export interface DialogDefinition {
  readonly id: string
  readonly name: string
}

export const DIALOGS = {
  INSTRUMENT_SETTINGS: { id: 'instrumentSettingsModal', name: 'Instrument Settings' },
  MIXER: { id: 'mixerModal', name: 'Drum Mixer' },
  ADD_TRACK: { id: 'addTrackModal', name: 'Add Track' },
  GRACE: { id: 'graceModal', name: 'Grace' },
  MARKER: { id: 'markerModal', name: 'Marker' },
  DIRECTION: { id: 'directionModal', name: 'Navigation signs' },
  TEXT: { id: 'textModal', name: 'Text' },
  STROKE: { id: 'strokeModal', name: 'Stroke' },
  EQUALIZER: { id: 'equalizerModal', name: 'Equalizer' },
  COMPRESSOR: { id: 'compressorModal', name: 'Compressor' },
  TEMPO: { id: 'tempoModal', name: 'Tempo' },
  KEY_SIGNATURE: { id: 'keySignatureModal', name: 'Key signature' },
  CLEF: { id: 'clefModal', name: 'Clef' },
  TUNER: { id: 'tunerModal', name: 'Tuner' },
  ARTIFICIAL: { id: 'artificialModal', name: 'Artificial' },
  BEND: { id: 'bendModal', name: 'Bend' },
  DELETE_TRACK: { id: 'deleteTrackModal', name: 'Delete Track' },
  GUITAR: { id: 'guitarModal', name: 'Guitar' },
  MIDI: { id: 'midiModal', name: 'MIDI' },
  PIANO: { id: 'pianoModal', name: 'Piano' },
  REPETITION: { id: 'repetitionModal', name: 'Repetition' },
  TIME_METER: { id: 'timeMeterModal', name: 'Time Meter' },
  TREMOLO_BAR: { id: 'tremoloBarModal', name: 'Tremolo Bar' },
  TREMOLO_PICKING: { id: 'tremoloPickingModal', name: 'Tremolo Picking' },
  INFO: { id: 'infoModal', name: 'Info' },
  DRUM_INFO: { id: 'drumInfoModal', name: 'Drum map' },
  DRUM_GRID: { id: 'drumGridModal', name: 'Step grid' },
  REPEAT_ALTERNATIVE: { id: 'repeatAlternativeModal', name: 'Repeat Alternative' },
  ADD_CHORD: { id: 'addChordModal', name: 'Add Chord' },
  CHORD_MANAGER: { id: 'chordManagerModal', name: 'Chord Manager' },
  COPYRIGHT: { id: 'copyrightModal', name: 'About' },
  EXAMPLE_SONGS: { id: 'exampleSongsModal', name: 'Example songs' },
  CLOUD_SONGS: { id: 'cloudSongsModal', name: 'Cloud songs' },
} as const satisfies Record<string, DialogDefinition>

type DialogHandlers = typeof import('./dialogHandlers')

let handlers: DialogHandlers | null = null

/** The handler registry (loaded once; later calls resolve at once). */
export async function loadDialogHandlers(): Promise<DialogHandlers> {
  handlers ??= await import('./dialogHandlers')
  return handlers
}

/** The dialog's handler, loading the registry first if needed. */
export async function dialogHandler<T extends BaseModalHandler>(dialog: DialogDefinition): Promise<T> {
  return (await loadDialogHandlers()).getDialogHandler<T>(dialog.id)
}

/**
 * Opens a dialog: its handler reads the song for `params` and shows the window. Dialogs
 * without a handler (example songs, cloud songs) just show.
 */
export async function openDialog(dialog: DialogDefinition, params?: unknown): Promise<void> {
  const registry = await loadDialogHandlers()
  const handler = registry.findDialogHandler(dialog.id)
  if (handler == null) showDialog(dialog.id, dialog.name)
  else handler.openModal(params)
}

/** Closes the dialog if it is open, else opens it as `openDialog` does. */
export function toggleDialog(dialog: DialogDefinition, params?: unknown): Promise<void> {
  if (isDialogOpen(dialog.id)) {
    hideDialog(dialog.id)
    return Promise.resolve()
  }
  return openDialog(dialog, params)
}

export function closeDialog(dialog: DialogDefinition | string): void {
  hideDialog(typeof dialog === 'string' ? dialog : dialog.id)
}

export function closeAllDialogs(): void {
  hideAllDialogs()
}

export { anyDialogOpen, isDialogOpen } from '../../stores/dialogState'
