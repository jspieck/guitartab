import { reactive } from 'vue'
import Song from '../../stores/song'
import { detectPitch, tunerReading, type TunerReading } from '../../utils/pitchDetection'
import { audioGraph } from './audioGraph'

/**
 * The tuner: listens to the microphone (only while its dialog is open), detects the pitch
 * a few times a second and compares it with the shown track's tuning. Nothing is sent
 * anywhere; the input isn't connected to the speakers.
 */

export const tunerState = reactive({
  listening: false,
  /** why the microphone isn't available, for the dialog */
  error: '',
  reading: null as TunerReading | null,
  /** input loudness, 0…1, smoothed, for the dialog's level ring */
  level: 0,
})

const FRAME = 4096
const INTERVAL_MS = 80
/** Readings kept for the median, which steadies the needle. */
const HISTORY = 5

let stream: MediaStream | null = null
let source: MediaStreamAudioSourceNode | null = null
let analyser: AnalyserNode | null = null
let timer: ReturnType<typeof setInterval> | null = null
let history: number[] = []

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function tick(buffer: Float32Array): void {
  if (analyser == null) return
  analyser.getFloatTimeDomainData(buffer)
  let sum = 0
  for (const sample of buffer) sum += sample * sample
  // RMS of a strummed string is around 0.05…0.2; fast attack, slow release
  const level = Math.min(1, Math.sqrt(sum / buffer.length) * 6)
  tunerState.level = level > tunerState.level ? level : tunerState.level * 0.7 + level * 0.3
  const frequency = detectPitch(buffer, audioGraph.context.sampleRate)
  if (frequency == null) {
    // keep the last reading a moment, the string is still ringing out
    history = history.slice(1)
    if (history.length === 0) tunerState.reading = null
    return
  }
  history = [...history, frequency].slice(-HISTORY)
  const track = Song.tracks[Song.currentTrackId]
  const tuning = (track?.strings ?? [])
    .slice(0, track?.numStrings ?? 6)
    .map((pitch) => Math.round(pitch) + (track?.capo ?? 0))
  tunerState.reading = tunerReading(median(history), tuning)
}

export async function startTuner(): Promise<void> {
  if (tunerState.listening) return
  tunerState.error = ''
  if (typeof navigator === 'undefined' || navigator.mediaDevices?.getUserMedia == null) {
    tunerState.error = 'This browser gives no microphone access.'
    return
  }
  try {
    // raw input: echo cancellation and noise suppression bend a tone's pitch and level
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
  } catch (error) {
    tunerState.error =
      error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow it in the browser to use the tuner.'
        : 'No microphone found.'
    return
  }
  await audioGraph.context.resume().catch(() => undefined)
  source = audioGraph.context.createMediaStreamSource(stream)
  analyser = audioGraph.context.createAnalyser()
  analyser.fftSize = FRAME
  source.connect(analyser)
  history = []
  const buffer = new Float32Array(FRAME)
  timer = setInterval(() => tick(buffer), INTERVAL_MS)
  tunerState.listening = true
}

export function stopTuner(): void {
  if (timer != null) clearInterval(timer)
  timer = null
  source?.disconnect()
  analyser?.disconnect()
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  source = null
  analyser = null
  history = []
  tunerState.listening = false
  tunerState.reading = null
  tunerState.level = 0
}
