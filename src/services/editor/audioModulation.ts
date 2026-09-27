import Song from '../../assets/js/songData'

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
    values[i] = base + (Math.sin(percent * 2 * Math.PI) * scale)
    if (i === valueCount - 1) {
      values[i] = 1
    }
  }
  return values
}

export function makeBend(
  bendObj: { bendPosition: number, bendValue: number }[],
  source: AudioBufferSourceNode,
  duration: number,
  startpoint: number,
  playBackRate: number,
): void {
  const lastTime = startpoint + duration * (bendObj[0].bendPosition / 60)
  const pBrate = playBackRate * 2 ** ((bendObj[0].bendValue / 100) / 12)
  source.playbackRate.setValueAtTime(pBrate, lastTime)

  for (let i = 1; i < bendObj.length; i += 1) {
    const newTime = startpoint + duration * (bendObj[i].bendPosition / 60)
    const newValue = playBackRate * 2 ** ((bendObj[i].bendValue / 100) / 12)
    source.playbackRate.exponentialRampToValueAtTime(newValue, newTime)
  }
}

export function makeTrill(
  gainNode: GainNode,
  trillDuration: number,
  startpoint: number,
  bpm: number = Song.bpm,
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
  bpm: number = Song.bpm,
): void {
  const frequency = (bpm / 60) * 2
  const scale = 0.01
  const playBackRate = source.playbackRate.value
  const values = generateCurve(playBackRate, frequency, scale, vibratoDuration)
  const vibratoDur = vibratoDuration !== -1 ? vibratoDuration : 3
  source.playbackRate.setValueCurveAtTime(values, startpoint, vibratoDur)
}

export function makeDistortion(distValue: number): Float32Array {
  const nSamples = 44100
  const curve = new Float32Array(nSamples)
  const deg = Math.PI / 180

  for (let i = 0; i < nSamples; i += 1) {
    const x = (i * 2) / nSamples - 1
    curve[i] = (3 + distValue) * x * 57 * (deg / (Math.PI + distValue * Math.abs(x)))
  }
  return curve
}

export function smoothDistortion(distAmount: number): Float32Array {
  const nSamples = 44100
  const curve = new Float32Array(nSamples)
  const amount = Math.min(distAmount, 0.9)
  const k = (2 * amount) / (1 - amount)
  for (let i = 0; i < nSamples; i += 1) {
    const x = (i * 2) / nSamples - 1
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return curve
}

export type EffectGainType = 'reverb' | 'chorus' | 'phaser' | 'pan' | string

export interface EffectBus {
  convolver: { wetGain: number }
  chorus: { dry: number }
  pan: StereoPannerNode
}

/** Apply mixer effect gain (0–127) onto a track bus. */
export function setEffectGain(
  bus: EffectBus,
  value: number,
  type: EffectGainType,
): void {
  switch (type) {
    case 'reverb':
      bus.convolver.wetGain = value / 127
      break
    case 'chorus':
      bus.chorus.dry = 1 - value / 127
      break
    case 'phaser':
      // Phaser wiring is not currently supported on the live graph.
      break
    case 'pan':
      bus.pan.pan.value = -1 + (value / 127) * 2
      break
    default:
  }
}
