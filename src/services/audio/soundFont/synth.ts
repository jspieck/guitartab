/*! Based on the JavaScript SoundFont 2 Parser. Copyright 2013-2015
imaya/GREE Inc and Colin Clark. Licensed under the MIT License. */

import { audioGraph } from '../audioGraph'

/** A low-frequency oscillator of a zone (SoundFont 2.04, 8.1.2): starts after `delay` seconds. */
export interface Lfo {
  delay: number
  /** Hz */
  frequency: number
  /** cents of pitch swing */
  toPitch: number
}

/** The modulation LFO also moves the filter cutoff (cents) and the volume (centibels). */
export interface ModLfo extends Lfo {
  toFilterFc: number
  toVolume: number
}

/** What a zone sets for every key it covers (key-scaled times are in `KeyInfo`). */
export interface ZoneParams {
  /** linear gain (initialAttenuation) */
  gain: number
  /** sampleModes 1 or 3: the sample loops while the note sounds */
  loop: boolean
  /** notes of the same class cut each other off (open/closed hi-hat); 0 = none */
  exclusiveClass: number
  /** -1 (left) … 1 (right) */
  pan: number
  /** 0–1 of the note sent to the track's reverb and chorus */
  reverbSend: number
  chorusSend: number
  /** volume envelope, SoundFont 2.04 8.1.2: seconds, sustain as 0–1 of the 100 dB range */
  volAttack: number
  volSustain: number
  volRelease: number
  modAttack: number
  /** 0–1: how far the modulation envelope falls after its peak */
  modSustain: number
  /** low-pass cutoff in absolute cents (13500 ≈ 20 kHz = open), resonance in centibels */
  filterFc: number
  filterQ: number
  /** how far (cents) the modulation envelope moves the cutoff and the pitch at its peak */
  modEnvToFilterFc: number
  modEnvToPitch: number
  vibLfo: Lfo | null
  modLfo: ModLfo | null
}

/** One zone on one key: the sample, its pitch and the key-scaled envelope times. */
export interface KeyInfo {
  sample: Int16Array | Float32Array
  sampleRate: number
  basePlaybackRate: number
  /** sample frames cut off at the start (startAddrs offsets) and added at the end (≤ 0) */
  start: number
  end: number
  loopStart: number
  loopEnd: number
  volHold: number
  volDecay: number
  modHold: number
  modDecay: number
  velLo: number
  velHi: number
  zone: ZoneParams
  /** the key's next zone (other velocities, stereo halves, stacked layers), if any */
  next?: KeyInfo
}

/** A preset's keys (sparse: only the keys its zones cover). */
export type PresetKeys = KeyInfo[] & { name?: string }

/** Banks by bank number (0 melodic, 128 drums), each preset by program number. */
export type Banks = PresetKeys[][]

/** What `noteOn` hands the sample player for one voice of a note. */
export interface SynthNote extends ZoneParams {
  buffer: AudioBuffer
  playBackRate: number
  loopStart: number
  loopEnd: number
  volHold: number
  volDecay: number
  modHold: number
  modDecay: number
}

const DRUM_PROGRAM = 9
const DRUM_BANK = 128
/** initialFilterFc at or above this (≈ 20 kHz) leaves the sound unfiltered */
export const FILTER_OPEN = 13500
/** cents the cutoff drops from velocity 127 to 0 (SoundFont 2.04, 8.4.2) */
const VELOCITY_TO_CUTOFF = 2400

/**
 * The zones that sound for a key at a velocity: all whose velocity range covers it (stereo
 * halves and stacked layers sound together); the first zone when none does.
 */
export function voicesFor(first: KeyInfo, velocity: number): KeyInfo[] {
  const voices: KeyInfo[] = []
  for (let layer: KeyInfo | undefined = first; layer; layer = layer.next) {
    if (velocity >= layer.velLo && velocity <= layer.velHi) voices.push(layer)
  }
  return voices.length ? voices : [first]
}

/** PCM (Int16 or already float) to the -1…1 floats an AudioBuffer holds. */
function toFloat32(sample: Int16Array | Float32Array): Float32Array {
  if (sample instanceof Float32Array) return sample
  const output = new Float32Array(sample.length)
  for (let i = 0; i < sample.length; i += 1) output[i] = sample[i] / 0x7fff
  return output
}

/** AudioBuffers per sample and cut (keys share samples; the cache lives as long as the samples). */
const sampleBuffers = new WeakMap<Int16Array | Float32Array, Map<string, AudioBuffer>>()

function keyBuffer(key: KeyInfo): AudioBuffer {
  // Converting the sample is the expensive part of a note; each sample's buffer is built once.
  let cuts = sampleBuffers.get(key.sample)
  if (cuts == null) {
    cuts = new Map()
    sampleBuffers.set(key.sample, cuts)
  }
  const cut = `${key.start}:${key.end}:${key.sampleRate}`
  let buffer = cuts.get(cut)
  if (buffer == null) {
    const sample = toFloat32(key.sample).subarray(
      Math.min(key.start, key.sample.length - 1),
      key.sample.length + key.end,
    )
    buffer = audioGraph.context.createBuffer(1, Math.max(1, sample.length), key.sampleRate)
    buffer.getChannelData(0).set(sample)
    cuts.set(cut, buffer)
  }
  return buffer
}

/** One voice of a note: a zone on a key at a velocity. */
function voiceOf(keyInfo: KeyInfo, velocity: number, drums: boolean): SynthNote {
  const zone = keyInfo.zone
  const filtered = zone.filterFc < FILTER_OPEN || zone.modEnvToFilterFc !== 0
  return {
    ...zone,
    buffer: keyBuffer(keyInfo),
    playBackRate: keyInfo.basePlaybackRate,
    loop: zone.loop && !drums,
    loopStart: keyInfo.loopStart / keyInfo.sampleRate,
    loopEnd: keyInfo.loopEnd / keyInfo.sampleRate,
    volHold: keyInfo.volHold,
    volDecay: keyInfo.volDecay,
    modHold: keyInfo.modHold,
    modDecay: keyInfo.modDecay,
    // SF2 default modulator: softer notes are darker (only where the zone uses its filter)
    filterFc: zone.filterFc - (filtered ? VELOCITY_TO_CUTOFF * (1 - velocity / 127) : 0),
  }
}

export const synth = {
  bank: 0,
  /** set by the loader (`banks.ts` builds it); presets fill in as their samples arrive */
  bankSet: [] as Banks,
  /** set while streaming: true when the preset is coming (and fetched first now) */
  onMissingPreset: null as ((bank: number, preset: number) => boolean) | null,

  /**
   * The voices for a key of a program (9 = drums: bank 128, preset 0): one per zone that
   * sounds, or null while the SoundFont isn't loaded or has no such key.
   */
  noteOn(program: number, key: number, velocity: number, channel = 0): SynthNote[] | null {
    const isDrums = program === DRUM_PROGRAM
    const bank = isDrums ? DRUM_BANK : this.bank
    const instrumentIndex = isDrums ? 0 : program
    const keys = this.bankSet[bank]?.[instrumentIndex]
    if (!keys) {
      // a streamed preset whose samples are still on their way: the loader fetches it next
      if (this.onMissingPreset?.(bank, instrumentIndex)) return null
      console.warn('Instrument not found! program:', program, 'bank:', bank, 'index:', instrumentIndex)
      return null
    }
    if (!keys[key]) {
      console.warn('Instrument key not found!', program, key)
      return null
    }
    return voicesFor(keys[key], velocity).map((keyInfo) =>
      voiceOf(keyInfo, velocity, channel === DRUM_PROGRAM),
    )
  },
}
