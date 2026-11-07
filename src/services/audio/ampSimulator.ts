import type { AmpCabinet, TrackAmp } from '../../types/song'

/**
 * Guitar amp and cabinet on a track bus (a lazy chunk, loaded by the first track that turns
 * its amp on): pre-EQ (low cut, mid push) → drive → waveshaper (4× oversampled soft clipping
 * with a small expander at the bottom, which acts like a noise gate on release tails) → tone
 * (mid scoop, treble shelf, fizz low-pass) → cabinet convolver → level. One per track, not per
 * note, and mono like a real amp (the bus pans it afterwards).
 *
 * The cabinet impulse responses are computed here from a few filters (a resonant low end,
 * presence peaks and the speaker's steep roll-off above ~5 kHz), so no IR files with their
 * own licence are needed.
 */

/** How far the curve's input range reaches into saturation: input ±1 maps to tanh(±SPAN). */
const SPAN = 8
/** Asymmetry of the clipping (even harmonics, like a tube stage). */
const BIAS = 0.25
/** Below this (in the curve's input range) the expander pulls the signal down to silence. */
const GATE = 0.04
const CURVE_LENGTH = 8192
/** Drive 0 … 1 adds 0 … 28 dB in front of the shaper. */
const DRIVE_DB = 28
/**
 * Output level at drive 0. Measured with SoundFont chords: a little above GeneralUser's own
 * distortion guitar, which is about where a distorted guitar sits in a mix.
 */
const OUTPUT_LEVEL = 0.12

/** The waveshaper curve over input −1 … 1 (pure, for tests). */
export function driveCurve(length = CURVE_LENGTH): Float32Array {
  const curve = new Float32Array(length)
  const offset = Math.tanh(BIAS)
  const peak = Math.max(Math.tanh(SPAN + BIAS) - offset, offset - Math.tanh(-SPAN + BIAS))
  for (let i = 0; i < length; i += 1) {
    const u = ((i / (length - 1)) * 2 - 1) * SPAN
    const shaped = (Math.tanh(u + BIAS) - offset) / peak
    const level = Math.min(1, Math.abs(u) / GATE)
    curve[i] = shaped * level * level * (3 - 2 * level)
  }
  return curve
}

interface Biquad {
  type: 'lowpass' | 'highpass' | 'peaking'
  frequency: number
  q: number
  gain?: number
}

/** RBJ cookbook biquad run over `samples` in place. */
function runBiquad(
  samples: Float32Array,
  { type, frequency, q, gain = 0 }: Biquad,
  sampleRate: number,
): void {
  const w0 = (2 * Math.PI * frequency) / sampleRate
  const cos = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * q)
  const a = 10 ** (gain / 40)
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number
  if (type === 'peaking') {
    ;[b0, b1, b2] = [1 + alpha * a, -2 * cos, 1 - alpha * a]
    ;[a0, a1, a2] = [1 + alpha / a, -2 * cos, 1 - alpha / a]
  } else {
    b1 = type === 'lowpass' ? 1 - cos : -(1 + cos)
    b0 = Math.abs(b1) / 2
    b2 = b0
    ;[a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha]
  }
  let [x1, x2, y1, y2] = [0, 0, 0, 0]
  for (let i = 0; i < samples.length; i += 1) {
    const x0 = samples[i]
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
    ;[x2, x1, y2, y1] = [x1, x0, y1, y0]
    samples[i] = y0
  }
}

const CABINETS: Record<Exclude<AmpCabinet, 'none'>, { filters: Biquad[]; reflection: number }> = {
  // open-back 1×12: less low end, bright and boxy
  small: {
    reflection: 0.3,
    filters: [
      { type: 'highpass', frequency: 110, q: 0.7 },
      { type: 'peaking', frequency: 700, q: 1, gain: 2 },
      { type: 'peaking', frequency: 2800, q: 2, gain: 5 },
      { type: 'lowpass', frequency: 5500, q: 0.9 },
      { type: 'lowpass', frequency: 7500, q: 0.6 },
    ],
  },
  medium: {
    reflection: 0.2,
    filters: [
      { type: 'highpass', frequency: 80, q: 0.7 },
      { type: 'peaking', frequency: 130, q: 1, gain: 2 },
      { type: 'peaking', frequency: 1800, q: 1.4, gain: 3 },
      { type: 'lowpass', frequency: 5200, q: 0.8 },
      { type: 'lowpass', frequency: 7000, q: 0.6 },
    ],
  },
  // closed 4×12: tight thump around 110 Hz, scooped low mids, early roll-off
  large: {
    reflection: 0.15,
    filters: [
      { type: 'highpass', frequency: 70, q: 0.8 },
      { type: 'peaking', frequency: 110, q: 1.2, gain: 4 },
      { type: 'peaking', frequency: 400, q: 1, gain: -3 },
      { type: 'peaking', frequency: 2400, q: 2, gain: 4 },
      { type: 'lowpass', frequency: 4800, q: 0.8 },
      { type: 'lowpass', frequency: 6000, q: 0.6 },
    ],
  },
}

const IR_SECONDS = 0.04
const REFLECTION_DELAY = 0.00045

/** A cabinet's impulse response at `sampleRate` (pure, for tests). */
export function cabinetImpulse(cabinet: Exclude<AmpCabinet, 'none'>, sampleRate: number): Float32Array {
  const { filters, reflection } = CABINETS[cabinet]
  const length = Math.round(IR_SECONDS * sampleRate)
  const response = new Float32Array(length)
  response[0] = 1
  // a second, quieter arrival (the sound bouncing inside the box) gives the comb colouring
  response[Math.round(REFLECTION_DELAY * sampleRate)] = reflection
  for (const filter of filters) runBiquad(response, filter, sampleRate)
  const fadeStart = Math.floor(length * 0.6)
  for (let i = fadeStart; i < length; i += 1) {
    response[i] *= 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeStart)) / (length - fadeStart))
  }
  // unit gain on average over the guitar's range, so switching cabinets keeps the level
  const bandGain =
    BAND.reduce((sum, frequency) => sum + gainAt(response, frequency, sampleRate), 0) / BAND.length
  for (let i = 0; i < length; i += 1) response[i] /= bandGain
  return response
}

const BAND = [200, 300, 450, 700, 1000, 1500, 2200, 3200]

/** Magnitude of an impulse response at `frequency`. */
export function gainAt(response: Float32Array, frequency: number, sampleRate: number): number {
  let re = 0
  let im = 0
  for (let n = 0; n < response.length; n += 1) {
    const phase = (2 * Math.PI * frequency * n) / sampleRate
    re += response[n] * Math.cos(phase)
    im -= response[n] * Math.sin(phase)
  }
  return Math.hypot(re, im)
}

const curveCache: { curve?: Float32Array } = {}
const impulseCache = new Map<string, AudioBuffer>()

function impulseBuffer(ctx: BaseAudioContext, cabinet: Exclude<AmpCabinet, 'none'>): AudioBuffer {
  const key = `${cabinet}@${ctx.sampleRate}`
  let buffer = impulseCache.get(key)
  if (buffer == null) {
    const samples = cabinetImpulse(cabinet, ctx.sampleRate)
    buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
    buffer.copyToChannel(samples, 0)
    impulseCache.set(key, buffer)
  }
  return buffer
}

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

export class AmpSimulator {
  readonly input: GainNode
  readonly output: GainNode
  private readonly midPush: BiquadFilterNode
  private readonly drive: GainNode
  private readonly treble: BiquadFilterNode
  private readonly fizz: BiquadFilterNode
  private readonly cabinet: ConvolverNode
  private cabinetType: AmpCabinet | null = null

  constructor(private readonly ctx: BaseAudioContext) {
    // a real amp is mono: the bus's stereo voices are summed here
    this.input = new GainNode(ctx, {
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    })
    const lowCut = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 100, Q: 0.7 })
    this.midPush = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 900, Q: 0.9 })
    this.drive = new GainNode(ctx)
    curveCache.curve ??= driveCurve()
    const shaper = new WaveShaperNode(ctx, { curve: curveCache.curve, oversample: '4x' })
    const dcBlock = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 40, Q: 0.7 })
    const scoop = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 450, Q: 0.8, gain: -3 })
    this.treble = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 2800 })
    this.fizz = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 0.7 })
    this.cabinet = new ConvolverNode(ctx, { disableNormalization: true })
    this.output = new GainNode(ctx, { gain: OUTPUT_LEVEL })
    this.input.connect(lowCut).connect(this.midPush).connect(this.drive).connect(shaper)
    shaper.connect(dcBlock).connect(scoop).connect(this.treble).connect(this.fizz)
  }

  /** Drive, tone and cabinet (`enabled` is the bus's business: it routes around the amp). */
  set({ drive, tone, cabinet }: TrackAmp): void {
    const now = this.ctx.currentTime
    // short glides, so turning a knob while playing doesn't click
    this.drive.gain.setTargetAtTime(10 ** ((drive * DRIVE_DB) / 20), now, 0.01)
    this.midPush.gain.setTargetAtTime(3 + drive * 5, now, 0.01)
    this.treble.gain.setTargetAtTime(lerp(-9, 6, tone), now, 0.01)
    this.fizz.frequency.setTargetAtTime(lerp(4500, 11000, tone), now, 0.01)
    // more drive makes it denser, not much louder (measured: twice the RMS from drive 0 to 1)
    this.output.gain.setTargetAtTime(OUTPUT_LEVEL / (1 + drive), now, 0.01)
    if (cabinet === this.cabinetType) return
    this.fizz.disconnect()
    this.cabinet.disconnect()
    if (cabinet === 'none') {
      this.fizz.connect(this.output)
    } else {
      this.cabinet.buffer = impulseBuffer(this.ctx, cabinet)
      this.fizz.connect(this.cabinet).connect(this.output)
    }
    this.cabinetType = cabinet
  }

  dispose(): void {
    this.input.disconnect()
    this.output.disconnect()
  }
}
