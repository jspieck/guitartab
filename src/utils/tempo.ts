/** Tempo range the editor accepts when dragging a tempo meter (BPM). */
export const TEMPO_MIN = 10
export const TEMPO_MAX = 300

export function clampTempo(bpm: number): number {
  return Math.max(TEMPO_MIN, Math.min(bpm, TEMPO_MAX))
}
