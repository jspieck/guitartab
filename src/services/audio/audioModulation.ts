import Song from '../../stores/song'
import { getPlaybackRate } from '../../stores/practiceState'

/** Pure pitch/gain modulation curves applied during note playback. */

export function generateCurve(
  base: number,
  frequency: number,
  scale: number,
  duration: number,
): Float32Array {
  const valueCount = 4096
  const values = new Float32Array(valueCount)
  for (let i = 0; i < valueCount; i += 1) {
    const percent = (i / valueCount) * duration * frequency
    values[i] = base + Math.sin(percent * 2 * Math.PI) * scale
    if (i === valueCount - 1) {
      values[i] = 1
    }
  }
  return values
}

/**
 * Bend values count 50 per semitone: 100 is a "full" (whole-tone) bend, as in Guitar Pro, the
 * bend dialog (value / 25 = quarter tones), the tab's "full"/"½" labels and the exports.
 */
export const BEND_VALUE_PER_SEMITONE = 50

/** Playback-rate factor for a bend value. */
export function bendRateFactor(bendValue: number): number {
  return 2 ** (bendValue / BEND_VALUE_PER_SEMITONE / 12)
}

export function makeBend(
  bendObj: { bendPosition: number; bendValue: number }[],
  source: AudioBufferSourceNode,
  duration: number,
  startpoint: number,
  playBackRate: number,
): void {
  const lastTime = startpoint + duration * (bendObj[0].bendPosition / 60)
  const pBrate = playBackRate * bendRateFactor(bendObj[0].bendValue)
  source.playbackRate.setValueAtTime(pBrate, lastTime)

  for (let i = 1; i < bendObj.length; i += 1) {
    const newTime = startpoint + duration * (bendObj[i].bendPosition / 60)
    const newValue = playBackRate * bendRateFactor(bendObj[i].bendValue)
    source.playbackRate.exponentialRampToValueAtTime(newValue, newTime)
  }
}

export function makeTrill(
  gainNode: GainNode,
  trillDuration: number,
  startpoint: number,
  bpm: number = Song.bpm * getPlaybackRate(),
): void {
  const frequency = (bpm / 60) * 2
  const scale = 0.6
  const volume = gainNode.gain.value
  const values = generateCurve(volume, frequency, scale, trillDuration)
  const trillDur = trillDuration !== -1 ? trillDuration : 3
  gainNode.gain.setValueCurveAtTime(values, startpoint, trillDur)
}

export function makeVibrato(
  source: AudioBufferSourceNode,
  vibratoDuration: number,
  startpoint: number,
  bpm: number = Song.bpm * getPlaybackRate(),
): void {
  const frequency = (bpm / 60) * 2
  const scale = 0.01
  const playBackRate = source.playbackRate.value
  const values = generateCurve(playBackRate, frequency, scale, vibratoDuration)
  const vibratoDur = vibratoDuration !== -1 ? vibratoDuration : 3
  source.playbackRate.setValueCurveAtTime(values, startpoint, vibratoDur)
}

export type EffectGainType = 'reverb' | 'chorus' | 'phaser' | 'pan' | string

export interface EffectBus {
  reverbSend: GainNode
  chorusSend: GainNode
  setPan(value: number): void
}

/** Apply mixer effect gain (0–127) onto a track bus: the reverb/chorus send level or the pan. */
export function setEffectGain(bus: EffectBus, value: number, type: EffectGainType): void {
  switch (type) {
    case 'reverb':
      bus.reverbSend.gain.value = value / 127
      break
    case 'chorus':
      bus.chorusSend.gain.value = value / 127
      break
    case 'phaser':
      // Phaser wiring is not currently supported on the live graph.
      break
    case 'pan':
      bus.setPan(-1 + (value / 127) * 2)
      break
    default:
  }
}
