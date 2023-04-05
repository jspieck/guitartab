import CompositeAudioNode from './compositeAudioNode';

class Chorus extends CompositeAudioNode {
  audioCtx: AudioContext;

  defaults: {feedback: number, delay: number, depth: number, rate: number};

  activateNode: GainNode;

  attenuator: GainNode;

  splitter: ChannelSplitterNode;

  delayL: DelayNode;

  delayR: DelayNode;

  feedbackGainNodeLR: GainNode;

  feedbackGainNodeRL: GainNode;

  merger: ChannelMergerNode;

  lfoL: OscillatorNode;

  lfoLDepth: GainNode;

  lfoLGain: GainNode;

  lfoR: OscillatorNode;

  lfoRDepth: GainNode;

  lfoRGain: GainNode;

  wet: GainNode;

  dryNode: GainNode;

  delayVal: number;

  depthVal: number;

  feedbackVal: number;

  rateVal: number;

  constructor(audioCtx: AudioContext, options: { wetGain: number, dryGain: number}) {
    super(audioCtx);
    this.audioCtx = audioCtx;
    const { wetGain, dryGain } = options;
    this.defaults = {
      feedback: 0.4, delay: 0.0045, depth: 0.7, rate: 1.5,
    };
    this.delayVal = 0.0045;
    this.depthVal = 0.7;
    this.feedbackVal = 0.4;
    this.rateVal = 1.5;
    this.activateNode = audioCtx.createGain();
    this.attenuator = this.activateNode;
    this.splitter = audioCtx.createChannelSplitter(2);
    this.delayL = audioCtx.createDelay();
    this.delayR = audioCtx.createDelay();
    this.feedbackGainNodeLR = audioCtx.createGain();
    this.feedbackGainNodeRL = audioCtx.createGain();
    this.merger = audioCtx.createChannelMerger(2);

    // delayVal = 0.85 + sin() * 0.3
    this.lfoL = this.audioCtx.createOscillator();
    this.lfoL.type = 'sine';
    this.lfoL.frequency.value = 1;
    this.lfoLDepth = this.audioCtx.createGain();
    this.lfoLDepth.gain.value = 0.3;
    this.lfoLGain = this.audioCtx.createGain();
    this.lfoLGain.gain.value = 0.85;
    this.lfoL.connect(this.lfoLDepth);
    this.lfoLDepth.connect(this.lfoLGain.gain); // Trick: this way a sum is computed
    this.lfoLGain.connect(this.delayL.delayTime);
    this.lfoL.start();

    this.lfoR = this.audioCtx.createOscillator();
    this.lfoR.type = 'sine';
    this.lfoR.frequency.value = 3.5;
    this.lfoRDepth = this.audioCtx.createGain();
    this.lfoRDepth.gain.value = 0.3;
    this.lfoRGain = this.audioCtx.createGain();
    this.lfoRGain.gain.value = 0.85;
    this.lfoR.connect(this.lfoLDepth);
    this.lfoRDepth.connect(this.lfoLGain.gain); // Trick: this way a sum is computed
    this.lfoRGain.connect(this.delayL.delayTime);
    this.lfoR.start();

    this.wet = audioCtx.createGain();
    this.wet.gain.setValueAtTime(wetGain, audioCtx.currentTime);
    this.input.connect(this.wet).connect(this.attenuator);
    // this.attenuator.connect(this.output);
    this.attenuator.connect(this.splitter);
    this.splitter.connect(this.delayL, 0);
    this.splitter.connect(this.delayR, 1);
    this.delayL.connect(this.feedbackGainNodeLR);
    this.delayR.connect(this.feedbackGainNodeRL);
    this.feedbackGainNodeLR.connect(this.delayR);
    this.feedbackGainNodeRL.connect(this.delayL);
    this.delayL.connect(this.merger, 0, 0);
    this.delayR.connect(this.merger, 0, 1);
    this.merger.connect(this.output);

    this.dryNode = audioCtx.createGain();
    this.dryNode.gain.setValueAtTime(dryGain, audioCtx.currentTime);
    this.input.connect(this.dryNode).connect(this.output);

    this.feedback = this.defaults.feedback;
    this.rate = this.defaults.rate;
    this.delay = this.defaults.delay;
    this.depth = this.defaults.depth;
    // this.lfoR.phase = Math.PI / 2;
    this.attenuator.gain.value = 0.6934; // 1 / (10 ^ (((20 * log10(3)) / 3) / 20))
  }

  set dry(value: number) {
    this.dryNode.gain.setValueAtTime(value, this.audioCtx.currentTime);
    this.wet.gain.setValueAtTime(1 - value, this.audioCtx.currentTime);
  }

  set delay(value: number) {
    this.delayVal = 0.0002 * (10 ** value * 2);
    this.lfoLGain.gain.value = this.delayVal;
    this.lfoRGain.gain.value = this.delayVal;
  }

  set depth(value: number) {
    this.depthVal = value;
    this.lfoLDepth.gain.value = this.depthVal * this.delayVal;
    this.lfoRDepth.gain.value = this.depthVal * this.delayVal;
  }

  set feedback(value: number) {
    this.feedbackVal = value;
    this.feedbackGainNodeLR.gain.value = this.feedbackVal;
    this.feedbackGainNodeRL.gain.value = this.feedbackVal;
  }

  set rate(value: number) {
    this.rateVal = value;
    this.lfoL.frequency.value = this.rateVal;
    this.lfoR.frequency.value = this.rateVal;
  }
}

export default Chorus;
