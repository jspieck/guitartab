/**
 * The drum kit: one entry per General MIDI percussion note (35–81). Each piece has its own
 * bus in the audio graph (`audioGraph.drumBusses[note - FIRST_DRUM_NOTE]`), and the Drum
 * Mixer edits volume, pan, mute and solo here. `.gt` files save and restore the table.
 */

/** name, sample slot (from the old sample sets; kept for `.gt` files), volume, pan, active, short name */
export type DrumInfo = [
  name: string,
  slot: number,
  volume: number,
  pan: number,
  active: boolean,
  short: string,
]

export const FIRST_DRUM_NOTE = 35

export const noteToDrum = new Map<number, DrumInfo>([
  [35, ['Kick 1', 0, 2, 0, true, 'K1']],
  [36, ['Kick 2', 0, 2, 0, true, 'K2']],
  [37, ['Stick', 5, 1, 0, true, 'St']],
  [38, ['Snare 1', 2, 2, 0, true, 'S1']],
  [39, ['Clap', 7, 1, 0, true, 'Cl']],
  [40, ['Snare 2', 2, 2, 0, true, 'S2']],
  [41, ['Low Tom 2', 10, 1, 0, true, 'LT2']],
  [42, ['Closed Hi-hat', 1, 0.6, 0, true, 'CH']],
  [43, ['Low Tom 1', 10, 1, 0, true, 'LT1']],
  [44, ['Pedal Hi-hat', 1, 0.6, 0, true, 'PH']],
  [45, ['Mid Tom 1', 11, 1, 0, true, 'MT1']],
  [46, ['Open Hi-hat', 3, 1, 0, true, 'OH']],
  [47, ['Mid Tom 2', 12, 1, 0, true, 'MT2']],
  [48, ['High Tom 2', 13, 1, 0, true, 'HT2']],
  [49, ['Crash 1', 4, 1, 0, true, 'Cr1']],
  [50, ['High Tom 1', 13, 1, 0, true, 'HT1']],
  [51, ['Ride 1', 9, 1, 0, true, 'R1']],
  [52, ['Chinese Cymbal', 14, 1, 0, true, 'CC']],
  [53, ['Ride Bell', 15, 1, 0, true, 'RB']],
  [54, ['Tambourine', 8, 1, 0, true, 'T']],
  [55, ['Splash Cymbal', 16, 1, 0, true, 'SC']],
  [56, ['Cowbell', 17, 1, 0, true, 'Co']],
  [57, ['Crash 2', 4, 1, 0, true, 'Cr2']],
  [58, ['Vibra Slap', 18, 1, 0, true, 'VS']],
  [59, ['Ride 2', 9, 1, 0, true, 'R2']],
  [60, ['High Bongo', 19, 1, 0, true, 'HB']],
  [61, ['Low Bongo', 19, 1, 0, true, 'LB']],
  [62, ['Mute High Conga', 20, 1, 0, true, 'MHC']],
  [63, ['Open High Conga', 20, 1, 0, true, 'OHC']],
  [64, ['Low Conga', 20, 1, 0, true, 'LC']],
  [65, ['High Timbale', 21, 1, 0, true, 'HT']],
  [66, ['Low Timbale', 21, 1, 0, true, 'LT']],
  [67, ['High Agogo', 22, 1, 0, true, 'HA']],
  [68, ['Low Agogo', 22, 1, 0, true, 'LA']],
  [69, ['Cabasa', 6, 1, 0, true, 'Ca']],
  [70, ['Maracas', 23, 1, 0, true, 'M']],
  [71, ['Short Whistle', 24, 1, 0, true, 'SW']],
  [72, ['Long Whistle', 24, 1, 0, true, 'LW']],
  [73, ['Short Guiro', 25, 1, 0, true, 'SG']],
  [74, ['Long Guiro', 25, 1, 0, true, 'LG']],
  [75, ['Claves', 26, 1, 0, true, 'Cl']],
  [76, ['High Wood Block', 27, 1, 0, true, 'HWB']],
  [77, ['Low Wood Block', 27, 1, 0, true, 'LWB']],
  [78, ['Mute Cuica', 28, 1, 0, true, 'MCu']],
  [79, ['Open Cuica', 28, 1, 0, true, 'OCu']],
  [80, ['Mute Triangle', 29, 1, 0, true, 'MT']],
  [81, ['Open Triangle', 29, 1, 0, true, 'OT']],
])

/** Drum pieces (MIDI notes) soloed in the Drum Mixer; when any are, only those play. */
export const drumSolo = new Set<number>()

export function isDrumAudible(note: number): boolean {
  const drumInfo = noteToDrum.get(note)
  if (drumInfo == null) return true
  if (drumSolo.size > 0) return drumSolo.has(note)
  return drumInfo[4] !== false
}
