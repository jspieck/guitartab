import { reactive } from 'vue'
import { refreshTrack } from '../editor/barFilling'
import { redrawTrack } from '../editor/layoutInvalidation'
import { BaseModalHandler } from './baseModalHandler'
import { Song } from '../../stores/song'
import { recordTrackEdit } from '../editor/songSettingsCommands'
import { notifySongDataChanged } from '../appEvents'
import { DIALOGS } from './dialogs'
import { isDrumTrack } from '../drumMixer'

export const TUNING_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** Pitch number of a note name such as 'E3', in the numbering the tuning selects use (12 × octave + note). */
function tuningValue(note: string): number {
  const octave = Number(note.slice(-1))
  return 12 * octave + TUNING_NOTE_NAMES.indexOf(note.slice(0, -1))
}

/** Standard tuning per string count, lowest string first (as the data). */
const DEFAULT_TUNINGS: Record<number, number[]> = {
  4: ['E2', 'A2', 'D3', 'G3'].map(tuningValue),
  5: ['B1', 'E2', 'A2', 'D3', 'G3'].map(tuningValue),
  6: ['E3', 'A3', 'D4', 'G4', 'B4', 'E5'].map(tuningValue),
  7: ['B2', 'E3', 'A3', 'D4', 'G4', 'B4', 'E5'].map(tuningValue),
  8: ['E2', 'B2', 'E3', 'A3', 'D4', 'G4', 'B4', 'E5'].map(tuningValue),
  9: ['E2', 'B2', 'E3', 'A3', 'D4', 'G4', 'B4', 'E5', 'B5'].map(tuningValue),
}

export interface InstrumentSettingsForm {
  name: string
  color: { red: number; green: number; blue: number }
  numStrings: number
  capo: number
  letItRing: boolean
  /** Open-string pitch per string, lowest string first. */
  tuning: number[]
  /** A drum track: its lines come from the drum map, so strings, tuning and capo are not shown. */
  drums: boolean
}

/** The track settings dialog: name, colour, strings and tuning, capo, let ring. */
export class InstrumentSettingsModalHandler extends BaseModalHandler {
  readonly form: InstrumentSettingsForm = reactive({
    name: '',
    color: { red: 0, green: 0, blue: 0 },
    numStrings: 6,
    capo: 0,
    letItRing: false,
    tuning: [],
    drums: false,
  })

  private trackId = 0

  constructor() {
    super(DIALOGS.INSTRUMENT_SETTINGS.id, DIALOGS.INSTRUMENT_SETTINGS.name)
  }

  openModal(params?: { trackId: number }) {
    this.trackId = params?.trackId ?? Song.currentTrackId
    const track = Song.tracks[this.trackId]
    Object.assign(this.form, {
      name: track.name,
      color: { ...track.color },
      numStrings: track.numStrings,
      capo: track.capo,
      letItRing: track.letItRing,
      tuning: Array.from({ length: track.numStrings }, (_, string) => track.strings[string] ?? 0),
      drums: isDrumTrack(this.trackId),
    })
    this.showModal()
  }

  /** A new string count starts from that count's standard tuning. */
  setStringCount(numStrings: number): void {
    this.form.numStrings = numStrings
    this.form.tuning = [...(DEFAULT_TUNINGS[numStrings] ?? DEFAULT_TUNINGS[6])]
  }

  submit(): void {
    const { trackId, form } = this
    recordTrackEdit(
      'Track settings',
      trackId,
      () => {
        const track = Song.tracks[trackId]
        track.name = form.name
        track.color = { ...form.color }
        track.letItRing = form.letItRing
        if (form.drums) return
        track.numStrings = form.numStrings
        track.capo = form.capo
        track.strings.length = 0
        form.tuning.forEach((value, i) => {
          track.strings[i] = value
        })
      },
      refreshTrackSettings,
    )
    this.closeModal()
  }
}

/** Re-layout after a track-settings change, its undo and its redo. */
function refreshTrackSettings(trackId: number): void {
  // Labels and colours in the sequencer are reactive; the tab needs a new layout.
  refreshTrack(trackId)
  if (trackId === Song.currentTrackId) {
    redrawTrack(Song.currentTrackId, Song.currentVoiceId)
  }
  notifySongDataChanged()
}
