/** The formats "Save as" offers, in menu order (`services/songExport.ts` writes them). */
export type ExportFormat = 'gt' | 'gp' | 'gpx' | 'gp5' | 'musicxml' | 'midi' | 'midi-bars'

export const EXPORT_OPTIONS: readonly { format: ExportFormat; label: string; hint: string }[] = [
  { format: 'gt', label: 'GuitarTab (.gt)', hint: 'Everything, opens here again' },
  { format: 'gp', label: 'Guitar Pro 7/8 (.gp)', hint: 'For Guitar Pro 7 and 8' },
  { format: 'gpx', label: 'Guitar Pro 6 (.gpx)', hint: 'For Guitar Pro 6, 7 and 8' },
  { format: 'gp5', label: 'Guitar Pro 5 (.gp5)', hint: 'For Guitar Pro, TuxGuitar, Songsterr' },
  { format: 'musicxml', label: 'MusicXML (.musicxml)', hint: 'For MuseScore, Finale, Sibelius, Dorico' },
  { format: 'midi', label: 'MIDI (.mid)', hint: 'As it plays: repeats and jumps played out' },
  {
    format: 'midi-bars',
    label: 'MIDI, bars as written (.mid)',
    hint: 'Every bar once, for editing in a DAW',
  },
]

/** Writes the song in `format` and downloads it (the exporters load on first use). */
export function exportSongAs(format: ExportFormat): void {
  void import('../services/songExport').then(({ exportSong }) => exportSong(format))
}
