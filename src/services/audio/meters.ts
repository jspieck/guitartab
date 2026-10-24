import Song from '../../stores/song'
import { modalManager } from '../dialogs/modalManager'
import Settings from '../../stores/settingsState'
import { getMeterCanvas } from '../../stores/sequencerState'
import { audioGraph } from './audioGraph'

/**
 * The sequencer's level meters (one per track, canvas 0 = master) and the equalizer's
 * spectrum, redrawn every animation frame while the song plays and once more after it
 * stops, so the bars fall back to zero.
 */

let averageVolumeIsNull = true
const dataArrays = new Map<number, Uint8Array>()

function dataArrayFor(analyser: AnalyserNode): Uint8Array {
  const size = analyser.frequencyBinCount
  let array = dataArrays.get(size)
  if (array == null) {
    array = new Uint8Array(size)
    dataArrays.set(size, array)
  }
  return array
}

function drawLevel(
  analyser: AnalyserNode,
  dataArray: Uint8Array,
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  background: string,
): void {
  analyser.getByteFrequencyData(dataArray)
  let averageVolume = 0
  for (const x of dataArray) averageVolume += x * x
  averageVolume = Math.sqrt(averageVolume / dataArray.length) * 0.7
  // clear even when silent, otherwise the last bar stays frozen after playback
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  if (averageVolume !== 0) {
    averageVolumeIsNull = false
    ctx.fillStyle = background
    ctx.fillRect(0, 0, (averageVolume / 120) * canvasWidth, canvasHeight)
  }
}

export function drawMeters(): void {
  if (!Settings.songPlaying && averageVolumeIsNull) return
  averageVolumeIsNull = true
  const color = Settings.darkMode ? '#4d4d4d' : 'rgba(43, 43, 43, 0.47)'
  for (let i = 0, n = Song.measures.length; i < n; i += 1) {
    const canvasContext = getMeterCanvas(i + 1)
    const bus = audioGraph.busses[i]
    if (canvasContext != null && bus != null) {
      drawLevel(bus.analyser, dataArrayFor(bus.analyser), canvasContext, 90, 30, color)
    }
  }
  const masterData = dataArrayFor(audioGraph.masterAnalyser)
  const canvasContext = getMeterCanvas(0)
  if (canvasContext != null) {
    drawLevel(audioGraph.masterAnalyser, masterData, canvasContext, 120, 30, color)
  }
  if (modalManager.isModalOpen('equalizerModal')) {
    audioGraph.equalizerHandler?.drawSpectrum(masterData)
  }
  requestAnimationFrame(drawMeters)
}
