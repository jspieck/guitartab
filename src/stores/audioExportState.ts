import { reactive } from 'vue'

/**
 * The audio export (File → Export audio): its options and how far a running export got.
 * Kept here, not in the dialog, so a render goes on and stays visible when the dialog is
 * closed and opened again.
 */

export type AudioExportFormat = 'wav' | 'opus'

export type AudioExportPhase = 'idle' | 'waiting' | 'rendering' | 'encoding' | 'done' | 'failed'

export const audioExportState = reactive({
  range: 'song' as 'song' | 'loop',
  unrollRepeats: true,
  metronome: false,
  countIn: false,
  /** at the practice speed instead of as written */
  practiceSpeed: false,
  format: 'wav' as AudioExportFormat,
  phase: 'idle' as AudioExportPhase,
  /** 0…1 within the phase */
  progress: 0,
  /** the result or the error, for the dialog's status line */
  message: '',
})

export function audioExportRunning(): boolean {
  const { phase } = audioExportState
  return phase === 'waiting' || phase === 'rendering' || phase === 'encoding'
}
