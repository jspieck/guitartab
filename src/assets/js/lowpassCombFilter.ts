import CompositeAudioNode from './compositeAudioNode';

class LowpassCombFilter extends CompositeAudioNode {
  lowPass: BiquadFilterNode;

  delay: DelayNode;

  gain: GainNode;

  constructor(audioCtx: AudioContext, options: any) {
    super(audioCtx);
    const { delayTime, resonance: gainValue, dampening: frequency } = options;
    this.lowPass = new BiquadFilterNode(audioCtx, { type: 'lowpass', frequency });
    this.delay = new DelayNode(audioCtx, { delayTime });
    this.gain = audioCtx.createGain();
    this.gain.gain.setValueAtTime(gainValue, audioCtx.currentTime);

    this.input
      .connect(this.delay)
      .connect(this.lowPass)
      .connect(this.gain)
      .connect(this.input)
      .connect(this.output);
  }

  get resonance() {
    return this.gain.gain;
  }

  get dampening() {
    return this.lowPass.frequency;
  }

  get delayTime() {
    return this.delay.delayTime;
  }
}

export default LowpassCombFilter;
