import { audioGraph, type AudioGraph } from './audioGraph'

/** An object, so tests can wrap `playClick` to record the clicks. */
export const metronome = {
  /**
   * A short synthesized blip (no samples to load), higher and louder on the first beat of
   * a bar. Goes straight into the limiter, past the track buses and the master gain.
   * Returns the oscillator, so a click scheduled ahead can be taken back.
   */
  playClick(
    startpoint: number,
    isHigh: boolean,
    graph: AudioGraph<BaseAudioContext> = audioGraph,
  ): OscillatorNode {
    const { context } = graph
    const start = Math.max(startpoint, context.currentTime)
    const oscillator = context.createOscillator()
    oscillator.type = 'square'
    oscillator.frequency.value = isHigh ? 1760 : 1320
    const gainNode = context.createGain()
    const peak = isHigh ? 0.3 : 0.18
    gainNode.gain.setValueAtTime(0.0001, start)
    gainNode.gain.exponentialRampToValueAtTime(peak, start + 0.002)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + 0.05)
    oscillator.connect(gainNode)
    gainNode.connect(graph.limiter ?? context.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.06)
    return oscillator
  },
}
