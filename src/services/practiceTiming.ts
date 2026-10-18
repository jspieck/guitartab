/**
 * Pure timing math for playback speed, metronome, count-in and speed trainer.
 * Musical time is measured in whole notes (a 4/4 bar has length 1).
 */

/** Seconds per whole note at `bpm` (quarter notes per minute) played at `rate`. */
export function secondsPerWhole(bpm: number, rate = 1): number {
  return 240 / (bpm * rate)
}

/** Whole notes per second at `bpm` played at `rate`. */
export function wholesPerSecond(bpm: number, rate = 1): number {
  return (bpm * rate) / 240
}

export interface Click {
  /** Audio-clock time in seconds. */
  time: number
  /** First beat of the bar. */
  accent: boolean
}

/**
 * One bar of clicks ending exactly at `startTime`, for a bar of
 * `numerator`/`denominator` at `bpm` (quarter notes per minute) and `rate`.
 */
export function computeCountIn(
  numerator: number,
  denominator: number,
  bpm: number,
  rate: number,
  startTime: number,
): { clicks: Click[], duration: number } {
  const beatSeconds = secondsPerWhole(bpm, rate) / denominator
  const duration = beatSeconds * numerator
  const clicks = Array.from({ length: numerator }, (_, beat) => ({
    time: startTime - duration + beat * beatSeconds,
    accent: beat === 0,
  }))
  return { clicks, duration }
}

/**
 * Beat positions (in whole notes from the bar start) of a `numerator`/`denominator`
 * bar, limited to `playedLength` when a loop ends inside the bar.
 */
export function getBarBeatPositions(numerator: number, denominator: number, playedLength: number): number[] {
  const positions: number[] = []
  for (let beat = 0; beat < numerator; beat += 1) {
    const position = beat / denominator
    if (position >= playedLength - 1e-6) {
      break
    }
    positions.push(position)
  }
  return positions
}

/** Speed after one more pass through the loop, never beyond `target`. */
export function nextTrainerRate(rate: number, step: number, target: number): number {
  if (rate >= target) {
    return rate
  }
  return Math.min(target, Math.round((rate + step) * 100) / 100)
}
