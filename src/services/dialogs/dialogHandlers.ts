import { AddTrackModalHandler } from './addTrackModalHandler'
import { BaseModalHandler, definePlainModal } from './baseModalHandler'
import {
  ArtificialModalHandler,
  GraceModalHandler,
  MarkerModalHandler,
  DirectionModalHandler,
  RepeatAlternativeModalHandler,
  RepetitionModalHandler,
  StrokeModalHandler,
  TempoModalHandler,
  KeySignatureModalHandler,
  ClefModalHandler,
  TextModalHandler,
  TremoloPickingModalHandler,
} from './effectModals'
import { BendModalHandler } from './bendModalHandler'
import { DeleteTrackModalHandler } from './deleteTrackModalHandler'
import { InfoModalHandler } from './infoModalHandler'
import { InstrumentSettingsModalHandler } from './instrumentSettingsModalHandler'
import { TimeMeterModalHandler } from './timeMeterModalHandler'
import { TremoloBarModalHandler } from './tremoloBarModalHandler'
import { AddChordModalHandler } from './addChordModalHandler'
import { DIALOGS } from './dialogs'

/**
 * The dialog handlers, one per dialog that has one (a lazy chunk: `dialogs.ts` loads it
 * when the first dialog opens; the dialog components import it directly, as they are lazy too).
 */
const HANDLER_CLASSES: Record<string, new () => BaseModalHandler> = {
  [DIALOGS.INSTRUMENT_SETTINGS.id]: InstrumentSettingsModalHandler,
  [DIALOGS.MIXER.id]: definePlainModal(DIALOGS.MIXER),
  [DIALOGS.ADD_TRACK.id]: AddTrackModalHandler,
  [DIALOGS.GRACE.id]: GraceModalHandler,
  [DIALOGS.MARKER.id]: MarkerModalHandler,
  [DIALOGS.DIRECTION.id]: DirectionModalHandler,
  [DIALOGS.TEXT.id]: TextModalHandler,
  [DIALOGS.STROKE.id]: StrokeModalHandler,
  [DIALOGS.EQUALIZER.id]: definePlainModal(DIALOGS.EQUALIZER),
  [DIALOGS.COMPRESSOR.id]: definePlainModal(DIALOGS.COMPRESSOR),
  [DIALOGS.TEMPO.id]: TempoModalHandler,
  [DIALOGS.KEY_SIGNATURE.id]: KeySignatureModalHandler,
  [DIALOGS.CLEF.id]: ClefModalHandler,
  [DIALOGS.TUNER.id]: definePlainModal(DIALOGS.TUNER),
  [DIALOGS.PRACTICE.id]: definePlainModal(DIALOGS.PRACTICE),
  [DIALOGS.ARTIFICIAL.id]: ArtificialModalHandler,
  [DIALOGS.BEND.id]: BendModalHandler,
  [DIALOGS.DELETE_TRACK.id]: DeleteTrackModalHandler,
  [DIALOGS.GUITAR.id]: definePlainModal(DIALOGS.GUITAR),
  [DIALOGS.MIDI.id]: definePlainModal(DIALOGS.MIDI),
  [DIALOGS.PIANO.id]: definePlainModal(DIALOGS.PIANO),
  [DIALOGS.REPETITION.id]: RepetitionModalHandler,
  [DIALOGS.TIME_METER.id]: TimeMeterModalHandler,
  [DIALOGS.TREMOLO_BAR.id]: TremoloBarModalHandler,
  [DIALOGS.TREMOLO_PICKING.id]: TremoloPickingModalHandler,
  [DIALOGS.INFO.id]: InfoModalHandler,
  [DIALOGS.DRUM_INFO.id]: definePlainModal(DIALOGS.DRUM_INFO),
  [DIALOGS.DRUM_GRID.id]: definePlainModal(DIALOGS.DRUM_GRID),
  [DIALOGS.REPEAT_ALTERNATIVE.id]: RepeatAlternativeModalHandler,
  [DIALOGS.ADD_CHORD.id]: AddChordModalHandler,
  [DIALOGS.CHORD_MANAGER.id]: definePlainModal<{ trackId: number }>(DIALOGS.CHORD_MANAGER),
  [DIALOGS.COPYRIGHT.id]: definePlainModal(DIALOGS.COPYRIGHT),
}

const handlers = new Map<string, BaseModalHandler>()

/** The dialog's handler (made on first use), or null for a dialog without one. */
export function findDialogHandler<T extends BaseModalHandler>(id: string): T | null {
  let handler = handlers.get(id)
  if (handler == null) {
    const HandlerClass = HANDLER_CLASSES[id]
    if (HandlerClass == null) return null
    handler = new HandlerClass()
    handlers.set(id, handler)
  }
  return handler as T
}

export function getDialogHandler<T extends BaseModalHandler>(id: string): T {
  const handler = findDialogHandler<T>(id)
  if (handler == null) throw new Error(`No handler for dialog ${id}`)
  return handler
}
