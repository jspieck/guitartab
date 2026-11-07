import Song from '../../stores/song'
import { masterEqualizer } from './masterEqualizer'
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
  background: string,
): void {
  const { width: canvasWidth, height: canvasHeight } = ctx.canvas
  analyser.getByteFrequencyData(dataArray)
  let averageVolume = 0
  for (const x of dataArray) averageVolume += x * x
  averageVolume = Math.sqrt(averageVolume / dataArray.length) * 0.7
  // clear even when silent, otherwise the last bar stays frozen after playback
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  if (averageVolume !== 0) {
    averageVolumeIsNull = false
    // A glowing bar along the fader's track (inset as in sequencer.scss), not a filled box.
    const left = METER_INSET_LEFT
    const width = (canvasWidth - METER_INSET_LEFT - METER_INSET_RIGHT) * Math.min(1, averageVolume / 120)
    ctx.save()
    ctx.fillStyle = background
    ctx.shadowColor = background
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.roundRect(left, canvasHeight / 2 - METER_HEIGHT / 2, width, METER_HEIGHT, METER_HEIGHT / 2)
    ctx.fill()
    ctx.restore()
  }
}

/** The fader track's inset in its 30 px high canvas, and the meter bar's height around it. */
const METER_INSET_LEFT = 4
const METER_INSET_RIGHT = 8
const METER_HEIGHT = 8

export function drawMeters(): void {
  if (!Settings.songPlaying && averageVolumeIsNull) return
  averageVolumeIsNull = true
  // The theme's meter colour (tokens.css); var() is already substituted in the computed value.
  const color = getComputedStyle(document.body).getPropertyValue('--seq-meter').trim()
  for (let i = 0, n = Song.measures.length; i < n; i += 1) {
    const canvasContext = getMeterCanvas(i + 1)
    const bus = audioGraph.busses[i]
    if (canvasContext != null && bus != null) {
      drawLevel(bus.analyser, dataArrayFor(bus.analyser), canvasContext, color)
    }
  }
  const masterData = dataArrayFor(audioGraph.masterAnalyser)
  const canvasContext = getMeterCanvas(0)
  if (canvasContext != null) {
    drawLevel(audioGraph.masterAnalyser, masterData, canvasContext, color)
  }
  masterEqualizer.spectrumListener?.(masterData)
  requestAnimationFrame(drawMeters)
}
