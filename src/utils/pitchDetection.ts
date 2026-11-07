/**
 * Pitch detection for the tuner (YIN, de Cheveigné & Kawahara 2002): the period whose
 * cumulative-mean-normalised difference first drops under a threshold, refined by parabolic
 * interpolation. Pure, so it is tested with synthetic tones.
 */

/** Lowest and highest frequencies looked for: below a drop-D bass's low string, above a high e at fret 24. */
const MIN_FREQUENCY = 30
const MAX_FREQUENCY = 1400
const THRESHOLD = 0.12
/** Quieter input (RMS) is treated as silence. */
const MIN_RMS = 0.01

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

/** The fundamental of `samples` in Hz, or null for silence or no clear pitch. */
export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  let sum = 0
  for (const sample of samples) sum += sample * sample
  if (Math.sqrt(sum / samples.length) < MIN_RMS) return null

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY))
  const maxLag = Math.min(Math.floor(samples.length / 2), Math.ceil(sampleRate / MIN_FREQUENCY))
  if (maxLag <= minLag) return null
  const window = samples.length - maxLag

  // d'(τ): the difference function normalised by its running mean
  const normalised = new Float32Array(maxLag + 1)
  normalised[0] = 1
  let runningSum = 0
  for (let lag = 1; lag <= maxLag; lag += 1) {
    let difference = 0
    for (let i = 0; i < window; i += 1) {
      const delta = samples[i] - samples[i + lag]
      difference += delta * delta
    }
    runningSum += difference
    normalised[lag] = runningSum > 0 ? (difference * lag) / runningSum : 1
  }

  let lag = -1
  for (let tau = minLag; tau <= maxLag; tau += 1) {
    if (normalised[tau] < THRESHOLD) {
      // walk down to the local minimum
      while (tau + 1 <= maxLag && normalised[tau + 1] < normalised[tau]) tau += 1
      lag = tau
      break
    }
  }
  if (lag < 0) return null

  // parabolic interpolation around the minimum
  const before = normalised[lag - 1] ?? normalised[lag]
  const after = normalised[lag + 1] ?? normalised[lag]
  const curvature = before + after - 2 * normalised[lag]
  const shift = curvature > 0 ? (before - after) / (2 * curvature) : 0
  return sampleRate / (lag + shift)
}

/** MIDI pitch (fractional) of a frequency; A4 = 440 Hz = 69. */
export function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440)
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** "E2", "A♯3". */
export function noteName(midi: number): string {
  const rounded = Math.round(midi)
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`
}

export interface TunerReading {
  frequency: number
  /** the nearest note and how far off it is, in cents (−50…50) */
  note: string
  cents: number
  /** the string of the tuning closest to the pitch (data index, 0 = lowest), and its offset in cents */
  string: number
  stringNote: string
  stringCents: number
}

/** What the tuner shows for a detected frequency against a tuning (MIDI pitches, lowest string first). */
export function tunerReading(frequency: number, tuning: readonly number[]): TunerReading {
  const midi = frequencyToMidi(frequency)
  const nearest = Math.round(midi)
  let string = 0
  tuning.forEach((pitch, index) => {
    if (Math.abs(pitch - midi) < Math.abs(tuning[string] - midi)) string = index
  })
  return {
    frequency,
    note: noteName(nearest),
    cents: Math.round((midi - nearest) * 100),
    string,
    stringNote: noteName(tuning[string] ?? nearest),
    stringCents: Math.round((midi - (tuning[string] ?? nearest)) * 100),
  }
}
