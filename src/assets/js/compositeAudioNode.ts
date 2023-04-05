/* declare global {
  interface AudioNode {
    new (): AudioNode,
    realConnect: {(
      destinationNode: AudioNode,
      output?: number | undefined,
      input?: number | undefined
    ): AudioNode;
    (
      dNode: AudioParam,
      output?: number | undefined
    ): void};
  }
} */

class CompositeAudioNode {
  audioCtx: AudioContext;

  input: GainNode;

  output: GainNode;

  // isCompositeNode: boolean;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
    this.input = this.audioCtx.createGain();
    this.output = this.audioCtx.createGain();
    // this.isCompositeNode = true;
  }

  connectPre(source: AudioNode) {
    source.connect(this.input);
  }

  connect(destination: AudioNode) {
    this.output.connect(destination);
  }

  /* get isCompositeAudioNode() {
    return this.isCompositeNode;
  }

  connect(
    destinationNode: AudioNode | AudioParam,
    output?: number | undefined,
    input?: number | undefined,
  ): AudioNode {
    return this.output.connect(destinationNode as AudioNode, output, input);
  } */

  // disconnect(...args: any[]): void {
  //   this.output.disconnect(...args);
  // }
}

/*
AudioNode.prototype.realConnect = AudioNode.prototype.connect;
AudioNode.prototype.connect = function connectNodes(
  destinationNode: AudioNode | AudioParam,
  destination?: number,
  source?: number,
): AudioNode {
  if (destinationNode instanceof CompositeAudioNode) {
    this.realConnect(destinationNode.input, destination, source);
  } else if (destinationNode instanceof AudioParam) {
    this.realConnect(destinationNode, destination);
  } else {
    this.realConnect(destinationNode, destination, source);
  }
  return destinationNode as AudioNode;
};
*/

export default CompositeAudioNode;
