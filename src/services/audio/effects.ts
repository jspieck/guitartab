/**
 * Per-track effects of the audio engine: a stereo chorus and a small Freeverb.
 * Each has an `input` and an `output` gain to wire into the bus chain.
 */

class EffectNode {
  readonly input: GainNode
  readonly output: GainNode

  constructor(protected readonly ctx: BaseAudioContext) {
    this.input = ctx.createGain()
    this.output = ctx.createGain()
  }

  /** Detaches the effect so the old graph can be garbage-collected. */
  dispose(): void {
    this.input.disconnect()
    this.output.disconnect()
  }
}

/** Feedback comb filter with a low-pass in the loop (one Freeverb voice). */
class LowpassCombFilter extends EffectNode {
  constructor(ctx: BaseAudioContext, options: { delayTime: number; resonance: number; dampening: number }) {
    super(ctx)
    const lowPass = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: options.dampening })
    const delay = new DelayNode(ctx, { delayTime: options.delayTime })
    const feedback = new GainNode(ctx, { gain: options.resonance })
    this.input.connect(delay).connect(lowPass).connect(feedback).connect(this.input).connect(this.output)
  }
}

const COMB_TUNINGS = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((samples) => samples / 44100)
const ALLPASS_FREQUENCIES = [225, 556, 441, 341]

/**
 * Freeverb with one comb filter per side instead of four, which is cheap
 * enough for one instance per track.
 */
export class Freeverb extends EffectNode {
  private readonly wet: GainNode
  private readonly dry: GainNode

  constructor(ctx: BaseAudioContext, options: { roomSize: number; dampening: number; wetGain: number }) {
    super(ctx)
    this.wet = new GainNode(ctx, { gain: options.wetGain })
    this.dry = new GainNode(ctx, { gain: 1 - options.wetGain })
    const splitter = ctx.createChannelSplitter(2)
    const merger = ctx.createChannelMerger(2)
    const comb = (delayTime: number) =>
      new LowpassCombFilter(ctx, { delayTime, resonance: options.roomSize, dampening: options.dampening })
    const left = comb(COMB_TUNINGS[0])
    const right = comb(COMB_TUNINGS[7])

    this.input.connect(this.wet).connect(splitter)
    this.input.connect(this.dry).connect(this.output)
    splitter.connect(left.input, 0)
    splitter.connect(right.input, 1)
    left.output.connect(merger, 0, 0)
    right.output.connect(merger, 0, 1)
    ALLPASS_FREQUENCIES.reduce<AudioNode>(
      (previous, frequency) => previous.connect(new BiquadFilterNode(ctx, { type: 'allpass', frequency })),
      merger,
    ).connect(this.output)
  }

  /** Reverb amount 0–1; the dry signal makes up the rest. */
  set wetGain(value: number) {
    this.wet.gain.value = value
    this.dry.gain.value = 1 - value
  }
}

/** Base delay in seconds and the LFO swing as a share of it (4.5 ± 1.35 ms). */
const CHORUS_DELAY = 0.0045
const CHORUS_DEPTH = 0.3
const CHORUS_FEEDBACK = 0.4
const CHORUS_RATE = 1.5
// 1 / (10 ^ (((20 * log10(3)) / 3) / 20)): keeps the summed delay lines at unity.
const CHORUS_ATTENUATION = 0.6934

/** Stereo chorus: two cross-fed delay lines, each modulated by its own LFO. */
export class Chorus extends EffectNode {
  private readonly wet: GainNode
  private readonly dryGain: GainNode
  private readonly lfos: OscillatorNode[]
  private started = false

  constructor(ctx: BaseAudioContext, options: { wetGain: number }) {
    super(ctx)
    this.wet = new GainNode(ctx, { gain: options.wetGain })
    this.dryGain = new GainNode(ctx, { gain: 1 - options.wetGain })
    const attenuator = new GainNode(ctx, { gain: CHORUS_ATTENUATION })
    const splitter = ctx.createChannelSplitter(2)
    const merger = ctx.createChannelMerger(2)
    const delayL = ctx.createDelay()
    const delayR = ctx.createDelay()
    const crossLR = new GainNode(ctx, { gain: CHORUS_FEEDBACK })
    const crossRL = new GainNode(ctx, { gain: CHORUS_FEEDBACK })

    // delayTime = base + sin(rate · t) · depth: an AudioParam adds its inputs to its own value.
    // The delays sit in a feedback loop, where Web Audio needs at least one render quantum
    // (128 samples, ~2.9 ms), so the swing stays above that. Slightly different rates per
    // side make it stereo.
    this.lfos = [delayL, delayR].map((delay, side) => {
      delay.delayTime.value = CHORUS_DELAY
      const lfo = new OscillatorNode(ctx, { type: 'sine', frequency: CHORUS_RATE * (side === 0 ? 1 : 1.13) })
      lfo.connect(new GainNode(ctx, { gain: CHORUS_DELAY * CHORUS_DEPTH })).connect(delay.delayTime)
      return lfo
    })

    this.input.connect(this.wet).connect(attenuator).connect(splitter)
    splitter.connect(delayL, 0)
    splitter.connect(delayR, 1)
    delayL.connect(crossLR).connect(delayR)
    delayR.connect(crossRL).connect(delayL)
    delayL.connect(merger, 0, 0)
    delayR.connect(merger, 0, 1)
    merger.connect(this.output)
    this.input.connect(this.dryGain).connect(this.output)
    if (ctx.state === 'running') this.ensureStarted()
  }

  /** Oscillators can only start once the context runs (after a user gesture). */
  ensureStarted(): void {
    if (this.started || this.ctx.state === 'closed') return
    for (const lfo of this.lfos) lfo.start()
    this.started = true
  }

  /** Dry share 0–1; the chorus makes up the rest. */
  set dry(value: number) {
    this.dryGain.gain.setValueAtTime(value, this.ctx.currentTime)
    this.wet.gain.setValueAtTime(1 - value, this.ctx.currentTime)
  }

  override dispose(): void {
    if (this.started) for (const lfo of this.lfos) lfo.stop()
    super.dispose()
  }
}
