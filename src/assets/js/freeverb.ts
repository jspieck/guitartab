import CompositeAudioNode from './compositeAudioNode';
import LowpassCombFilter from './lowpassCombFilter';

class Freeverb extends CompositeAudioNode {
  wet: GainNode;

  dry: GainNode;

  merger: ChannelMergerNode;

  splitter: ChannelSplitterNode;

  combFilters: LowpassCombFilter[];

  allPassFilters: BiquadFilterNode[];

  constructor(audioCtx: AudioContext, options?: any) {
    super(audioCtx);
    const {
      roomSize: resonance, dampening, wetGain, dryGain,
    } = options;
    const sampleRate = 44100;
    const COMB_FILTER_TUNINGS = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116]
      .map((delayPerSecond) => delayPerSecond / sampleRate);
    const ALLPASS_FREQUENCES = [225, 556, 441, 341];

    this.wet = audioCtx.createGain();
    this.wet.gain.setValueAtTime(wetGain, audioCtx.currentTime);
    this.dry = audioCtx.createGain();
    this.dry.gain.setValueAtTime(dryGain, audioCtx.currentTime);
    this.merger = audioCtx.createChannelMerger(2);
    this.splitter = audioCtx.createChannelSplitter(2);

    this.combFilters = COMB_FILTER_TUNINGS
      .map((delayTime) => new LowpassCombFilter(audioCtx, { dampening, resonance, delayTime }));
    const combLeft = this.combFilters.slice(0, 1);
    const combRight = this.combFilters.slice(7);
    this.allPassFilters = ALLPASS_FREQUENCES
      .map((frequency) => new BiquadFilterNode(audioCtx, { type: 'allpass', frequency }));

    this.input.connect(this.wet).connect(this.splitter);
    this.input.connect(this.dry).connect(this.output);
    combLeft.forEach((comb) => {
      this.splitter.connect(comb.input, 0);
      comb.output.connect(this.merger, 0, 0);
    });
    combRight.forEach((comb) => {
      this.splitter.connect(comb.input, 1);
      comb.output.connect(this.merger, 0, 1);
    });

    this.merger
      .connect(this.allPassFilters[0])
      .connect(this.allPassFilters[1])
      .connect(this.allPassFilters[2])
      .connect(this.allPassFilters[3])
      .connect(this.output);
  }

  get wetGain(): number {
    return this.wet.gain.value;
  }

  set wetGain(value: number) {
    this.wet.gain.value = value;
  }

  get dryGain() {
    return this.dry.gain;
  }

  get roomSize() {
    return this.combFilters.map((comb) => comb.resonance);
  }

  get dampening() {
    return this.combFilters.map((comb) => comb.dampening);
  }
}

export default Freeverb;
