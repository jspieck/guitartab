import { FILTER_OPEN, type Lfo, type SynthNote } from './synth'

/**
 * A SoundFont note's volume and filter envelopes as Web Audio automation
 * (SoundFont 2.04, 8.1.2 and 9.1.7). The volume envelope falls in decibels: decay and
 * release are exponential gain curves that drop the full 100 dB range in their time.
 * Only what fits Web Audio without reading a value back: the note-off level comes from
 * `volumeEnvelopeAt`, the same curve computed in JS.
 */

const RANGE_DB = 100
/** time constants in one decay/release time (e^-x = -100 dB) */
const TIME_CONSTANTS = Math.log(10 ** (RANGE_DB / 20))
const MIN_RELEASE = 0.015
/** caps a release, so a pad doesn't keep a stopped note alive for many seconds */
const MAX_RELEASE = 2

/** The release the player uses (seconds). */
export function releaseOf(note: SynthNote): number {
  return Math.min(MAX_RELEASE, Math.max(MIN_RELEASE, note.volRelease))
}

/** Gain level for an attenuation as 0–1 of the 100 dB range. */
function levelOf(attenuation: number): number {
  return 10 ** ((-attenuation * RANGE_DB) / 20)
}

/** The volume envelope `t` seconds after the note starts, 0–1 of its peak (before note-off). */
export function volumeEnvelopeAt(note: SynthNote, t: number): number {
  if (t <= 0) return 0
  if (t < note.volAttack) return t / note.volAttack
  const decayStart = note.volAttack + note.volHold
  if (t <= decayStart || note.volSustain <= 0) return 1
  return Math.max(levelOf(note.volSustain), levelOf((t - decayStart) / note.volDecay))
}

/**
 * Schedules attack, hold, decay to sustain and, at `start + length`, the release.
 * Returns when the release has faded the note out.
 */
export function scheduleVolumeEnvelope(
  param: AudioParam,
  note: SynthNote,
  peak: number,
  start: number,
  length: number,
): number {
  const attackEnd = start + note.volAttack
  const decayStart = attackEnd + note.volHold
  const noteOff = start + length
  const offLevel = peak * volumeEnvelopeAt(note, length)
  param.setValueAtTime(0, start)
  if (noteOff <= attackEnd) {
    param.linearRampToValueAtTime(offLevel, noteOff)
  } else {
    param.linearRampToValueAtTime(peak, attackEnd)
    if (noteOff > decayStart && note.volSustain > 0) {
      param.setValueAtTime(peak, decayStart)
      param.setTargetAtTime(0, decayStart, note.volDecay / TIME_CONSTANTS)
      const sustainAt = decayStart + note.volDecay * note.volSustain
      if (note.volSustain < 1 && sustainAt < noteOff)
        param.setValueAtTime(peak * levelOf(note.volSustain), sustainAt)
    }
    param.setValueAtTime(offLevel, noteOff)
  }
  const release = releaseOf(note)
  param.setTargetAtTime(0, noteOff, release / TIME_CONSTANTS)
  return noteOff + release
}

/**
 * The modulation envelope on the pitch (`source.detune`, cents): up by `modEnvToPitch`
 * over the attack, hold, then down to the sustain share.
 */
function schedulePitchEnvelope(detune: AudioParam, note: SynthNote, start: number): void {
  if (!note.modEnvToPitch) return
  const attackEnd = start + note.modAttack
  const decayStart = attackEnd + note.modHold
  detune.setValueAtTime(0, start)
  detune.linearRampToValueAtTime(note.modEnvToPitch, attackEnd)
  detune.setValueAtTime(note.modEnvToPitch, decayStart)
  detune.linearRampToValueAtTime(
    note.modEnvToPitch * (1 - note.modSustain),
    decayStart + note.modDecay * note.modSustain + 0.001,
  )
}

/** A sine LFO from `start + delay` to `end`, scaled into each target (cents or gain). */
function startLfo(
  context: BaseAudioContext,
  lfo: Lfo,
  start: number,
  end: number,
  targets: [AudioParam | null | undefined, number][],
): void {
  const used = targets.filter(([param, depth]) => param != null && depth !== 0)
  if (!used.length || start + lfo.delay >= end) return
  const oscillator = context.createOscillator()
  oscillator.frequency.value = lfo.frequency
  for (const [param, depth] of used) {
    const scale = context.createGain()
    scale.gain.value = depth
    oscillator.connect(scale).connect(param!)
  }
  oscillator.start(start + lfo.delay)
  oscillator.stop(end)
}

/**
 * Pitch envelope and LFOs of a voice, from `start` until the voice ends: vibrato and the
 * modulation LFO move the pitch (`source.detune`) and the cutoff (`filter.detune`); the
 * modulation LFO's volume swing needs `tremolo`, a gain in the voice's chain at 1.
 */
export function scheduleModulation(
  context: BaseAudioContext,
  note: SynthNote,
  nodes: { source: AudioBufferSourceNode; filter: BiquadFilterNode | null; tremolo: GainNode | null },
  start: number,
  end: number,
): void {
  schedulePitchEnvelope(nodes.source.detune, note, start)
  if (note.vibLfo) startLfo(context, note.vibLfo, start, end, [[nodes.source.detune, note.vibLfo.toPitch]])
  if (note.modLfo) {
    startLfo(context, note.modLfo, start, end, [
      [nodes.source.detune, note.modLfo.toPitch],
      [nodes.filter?.detune, note.modLfo.toFilterFc],
      // ± centibels as a share of the gain around 1
      [nodes.tremolo?.gain, 1 - levelOf(Math.abs(note.modLfo.toVolume) / 1000)],
    ])
  }
}

/** True when the modulation LFO swings the volume (the voice then needs a tremolo gain). */
export function needsTremolo(note: SynthNote): boolean {
  return (note.modLfo?.toVolume ?? 0) !== 0
}

/** True when the modulation LFO moves the cutoff (the voice then needs a filter even if open). */
export function needsFilter(note: SynthNote): boolean {
  return (note.modLfo?.toFilterFc ?? 0) !== 0
}

const centsToHz = (cents: number) => 8.176 * 2 ** (cents / 1200)

/**
 * A low-pass filter following the note's cutoff and modulation envelope (attack to the
 * peak, hold, decay to sustain), or null when the note is unfiltered.
 */
export function createNoteFilter(
  context: BaseAudioContext,
  note: SynthNote,
  start: number,
): BiquadFilterNode | null {
  const swept = needsFilter(note)
  if (note.filterFc >= FILTER_OPEN && note.modEnvToFilterFc <= 0 && !swept) return null
  const ceiling = context.sampleRate * 0.45
  const hz = (cents: number) => Math.min(ceiling, Math.max(20, centsToHz(cents)))
  const base = hz(note.filterFc)
  const peak = hz(note.filterFc + note.modEnvToFilterFc)
  const sustain = hz(note.filterFc + note.modEnvToFilterFc * (1 - note.modSustain))
  if (!swept && note.filterFc >= FILTER_OPEN && Math.min(base, peak, sustain) >= ceiling) return null
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  // Web Audio's low-pass Q is the resonance peak in dB; the SoundFont gives centibels
  filter.Q.value = note.filterQ / 10
  filter.frequency.setValueAtTime(base, start)
  if (peak !== base || sustain !== base) {
    // the envelope moves linearly in cents, i.e. exponentially in Hz
    const attackEnd = start + note.modAttack
    filter.frequency.exponentialRampToValueAtTime(peak, attackEnd)
    const decayStart = attackEnd + note.modHold
    filter.frequency.setValueAtTime(peak, decayStart)
    filter.frequency.exponentialRampToValueAtTime(
      sustain,
      decayStart + note.modDecay * note.modSustain + 0.001,
    )
  }
  return filter
}
