import Song from '../../stores/song'
import { audioExportRunning, audioExportState } from '../../stores/audioExportState'
import { getPlaybackRate } from '../../stores/practiceState'
import { onSoundFontSettled, soundFontState, whenPresetsLoaded } from '../../stores/soundFontState'
import { trackPresetKey } from '../audio/samplePlayer'
import { announce } from '../../stores/announcerState'
import { currentLoopInterval } from '../editor/rangeSelection'
import { renderSongAudio } from './audioRender'
import { encodeOggOpus, OPUS_SAMPLE_RATE } from './opusEncoder'
import { formatDuration } from './renderPlan'
import { encodeWav } from './wavFile'

/**
 * File → Export audio: waits for the instruments, renders (`audioRender.ts`), encodes to WAV
 * or Ogg Opus and downloads the file. One export at a time; `cancelAudioExport` stops it.
 */

const WAV_SAMPLE_RATE = 44100

let controller: AbortController | null = null

function baseName(): string {
  const title = Song.songDescription.title.replace(/[\\/:*?"<>|]+/g, '').trim()
  return title && title !== '[Title]' ? title : 'song'
}

function download(data: Uint8Array, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking right away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Resolves once the SoundFont is loaded; rejects when it failed. */
function soundFontReady(): Promise<void> {
  if (soundFontState.status === 'ready' || soundFontState.status === 'idle') return Promise.resolve()
  if (soundFontState.status === 'failed')
    return Promise.reject(new Error('The instruments could not be loaded.'))
  return new Promise((resolve, reject) => {
    onSoundFontSettled(() => {
      if (soundFontState.status === 'ready') resolve()
      else reject(new Error('The instruments could not be loaded.'))
    })
  })
}

/** The SoundFont, and (streamed, Big win 32) every preset the song's tracks play. */
async function instrumentsReady(): Promise<void> {
  await soundFontReady()
  await whenPresetsLoaded(Song.tracks.map((_, trackId) => trackPresetKey(trackId)))
}

function aborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = () => reject(new DOMException('Cancelled', 'AbortError'))
    if (signal.aborted) fail()
    else signal.addEventListener('abort', fail, { once: true })
  })
}

function setPhase(phase: typeof audioExportState.phase, message = ''): void {
  audioExportState.phase = phase
  audioExportState.progress = 0
  audioExportState.message = message
}

function onProgress(fraction: number): void {
  audioExportState.progress = fraction
}

/** The rendered audio as file bytes in the chosen format. */
async function encode(
  audio: { channels: Float32Array[]; sampleRate: number },
  opus: boolean,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (!opus) return encodeWav(audio.channels, audio.sampleRate)
  const title = Song.songDescription.title
  const comments = title && title !== '[Title]' ? [`TITLE=${title}`] : []
  return encodeOggOpus(audio.channels, { comments, signal, onProgress })
}

function reportFailure(error: unknown): void {
  if (error instanceof DOMException && error.name === 'AbortError') {
    setPhase('idle', 'Export cancelled.')
    return
  }
  console.error('Audio export failed', error)
  setPhase('failed', `The export failed: ${error instanceof Error ? error.message : String(error)}`)
}

export async function startAudioExport(): Promise<void> {
  if (audioExportRunning()) return
  const options = { ...audioExportState }
  const loop = options.range === 'loop' ? currentLoopInterval() : null
  if (options.range === 'loop' && loop == null) {
    setPhase('failed', 'Set a loop first, or export the whole song.')
    return
  }
  controller = new AbortController()
  const { signal } = controller
  const opus = options.format === 'opus'
  try {
    setPhase('waiting', 'Waiting for the instruments…')
    await Promise.race([instrumentsReady(), aborted(signal)])
    setPhase('rendering')
    const audio = await renderSongAudio({
      range: options.range,
      loop,
      unrollRepeats: options.unrollRepeats,
      metronome: options.metronome,
      countIn: options.countIn,
      playbackRate: options.practiceSpeed ? getPlaybackRate() : 1,
      sampleRate: opus ? OPUS_SAMPLE_RATE : WAV_SAMPLE_RATE,
      signal,
      onProgress,
    })
    setPhase('encoding')
    const bytes = await encode(audio, opus, signal)
    const suffix = options.range === 'loop' ? ' (loop)' : ''
    download(bytes, `${baseName()}${suffix}.${opus ? 'ogg' : 'wav'}`, opus ? 'audio/ogg' : 'audio/wav')
    const length = formatDuration(audio.channels[0].length / audio.sampleRate)
    const size = (bytes.length / (1024 * 1024)).toFixed(1)
    setPhase('done', `Saved ${length} of audio (${size} MB).`)
    announce('Audio export finished')
  } catch (error) {
    reportFailure(error)
  } finally {
    controller = null
  }
}

export function cancelAudioExport(): void {
  controller?.abort()
}
