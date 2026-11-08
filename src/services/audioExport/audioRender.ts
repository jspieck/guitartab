import { toRaw } from 'vue'
import Song from '../../stores/song'
import type { Interval } from '../../types/song'
import Duration from '../../utils/duration'
import { trackAmp } from '../audio/ampModel'
import { AudioGraph, audioGraph, loadAmpModule } from '../audio/audioGraph'
import { metronome } from '../audio/metronome'
import { SamplePlayer } from '../audio/samplePlayer'
import { notePlayback, type BeatRef } from '../playback/notePlayback'
import { buildRenderPlan, plannedClicks, type RenderPlan } from './renderPlan'
import { audibleLength } from './wavFile'

/**
 * Renders the song to audio: the same note playback as the Play button (`notePlayback` and
 * the sample player), into a second audio graph on an `OfflineAudioContext` that copies the
 * live one's mixer, drum mixer, amp, EQ and limiter settings. Mute and solo apply as set.
 * Runs faster than real time; progress comes from pausing the render every so often.
 */

export interface AudioRenderOptions {
  range: 'song' | 'loop'
  loop: Interval | null
  unrollRepeats: boolean
  metronome: boolean
  countIn: boolean
  /** practice speed factor (1 = as written) */
  playbackRate: number
  sampleRate: number
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export interface RenderedAudio {
  channels: Float32Array[]
  sampleRate: number
}

/** Releases and reverb ring on this long after the last bar; the silent rest is cut off. */
const TAIL_SECONDS = 4
const TRIM_PADDING_SECONDS = 0.05
const EPSILON = 1e-6
/** bars scheduled between two breaks for the page (and a look at the cancel button) */
const BARS_PER_SLICE = 16

function abortError(): DOMException {
  return new DOMException('Cancelled', 'AbortError')
}

function beatsOf(trackId: number, blockId: number, voiceId: number) {
  return Song.measures[trackId]?.[blockId]?.[voiceId] ?? []
}

/** Start of each beat of a voice in a bar (whole notes), plus the bar end. */
function beatPositions(trackId: number, blockId: number, voiceId: number): number[] {
  const positions = [0]
  for (const beat of beatsOf(trackId, blockId, voiceId)) {
    positions.push(positions[positions.length - 1] + Duration.getDurationOfNote(beat, false) / 64)
  }
  return positions
}

/** The first beat of a planned bar's played part in a voice. */
function firstBeatOf(plan: RenderPlan, index: number, trackId: number, voiceId: number): BeatRef | null {
  const bar = plan.bars[index]
  if (bar == null) return null
  const positions = beatPositions(trackId, bar.blockId, voiceId)
  const beatId = positions.findIndex(
    (position, id) => id < positions.length - 1 && position >= bar.from - EPSILON,
  )
  if (beatId === -1 || positions[beatId] >= bar.to - EPSILON) return null
  return { blockId: bar.blockId, beatId, sequenceIndex: index }
}

/** The beat played after `ref` in the plan (the next in its bar, else the next planned bar's first). */
export function planAfter(plan: RenderPlan, trackId: number, voiceId: number, ref: BeatRef): BeatRef | null {
  const index = ref.sequenceIndex ?? 0
  const bar = plan.bars[index]
  if (bar == null) return null
  const positions = beatPositions(trackId, ref.blockId, voiceId)
  const next = ref.beatId + 1
  if (next < positions.length - 1 && positions[next] < bar.to - EPSILON) return { ...ref, beatId: next }
  return firstBeatOf(plan, index + 1, trackId, voiceId)
}

/** Schedules every beat of one planned bar on `player`, `offset` seconds into the render. */
export function scheduleBar(plan: RenderPlan, index: number, player: SamplePlayer, offset = 0): void {
  const bar = plan.bars[index]
  const { secondsPerWhole } = bar
  player.effectBpm = 240 / secondsPerWhole
  for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
    for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
      const beats = beatsOf(trackId, bar.blockId, voiceId)
      const positions = beatPositions(trackId, bar.blockId, voiceId)
      const after = (ref: BeatRef) => planAfter(plan, trackId, voiceId, ref)
      beats.forEach((beat, beatId) => {
        const position = positions[beatId]
        if (position < bar.from - EPSILON || position >= bar.to - EPSILON) return
        const start = offset + bar.start + (position - bar.from) * secondsPerWhole
        const duration = (positions[beatId + 1] - position) * secondsPerWhole
        const following = after({ blockId: bar.blockId, beatId, sequenceIndex: index })
        notePlayback.playBeat(trackId, bar.blockId, voiceId, beatId, duration, start, beat, following, {
          player,
          secondsPerWhole,
          after,
        })
      })
    }
  }
}

/** The render's audio graph: the live graph's settings on `context`. */
async function buildGraph(context: OfflineAudioContext): Promise<AudioGraph<OfflineAudioContext>> {
  if (Song.tracks.some((_, trackId) => trackAmp(trackId).enabled)) await loadAmpModule()
  const graph = new AudioGraph(context)
  graph.createBusses(audioGraph)
  graph.copyBussesOf(audioGraph)
  return graph
}

/** Lets the page paint and the cancel button work between slices of scheduling. */
function nextSlice(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Renders the song (or the loop) to stereo float channels. Progress goes to `onProgress`
 * (0…1); aborting `signal` rejects with an AbortError.
 */
export async function renderSongAudio(options: AudioRenderOptions): Promise<RenderedAudio> {
  const meta = toRaw(Song.measureMeta)
  const plan = buildRenderPlan(meta, {
    range: options.range,
    loop: options.loop,
    unrollRepeats: options.unrollRepeats,
    countIn: options.countIn,
    playbackRate: options.playbackRate,
    songBpm: Song.bpm,
  })
  if (plan.bars.length === 0) throw new Error('There is nothing to render.')
  const { sampleRate, signal } = options
  const total = plan.duration + TAIL_SECONDS
  const context = new OfflineAudioContext({
    numberOfChannels: 2,
    length: Math.ceil(total * sampleRate),
    sampleRate,
  })
  const graph = await buildGraph(context)
  const player = new SamplePlayer(graph)

  // Scheduling is the first tenth of the progress, rendering the rest.
  for (let index = 0; index < plan.bars.length; index += 1) {
    scheduleBar(plan, index, player)
    if (index % BARS_PER_SLICE === BARS_PER_SLICE - 1) {
      options.onProgress?.((0.1 * index) / plan.bars.length)
      await nextSlice()
      if (signal?.aborted) throw abortError()
    }
  }
  const clicks = [...plan.countInClicks, ...(options.metronome ? plannedClicks(meta, plan) : [])]
  for (const click of clicks) metronome.playClick(click.time, click.accent, graph)

  return new Promise<RenderedAudio>((resolve, reject) => {
    let stopped = false
    const onAbort = () => {
      // The render stays paused at its next stop and is dropped (an offline render can't be cancelled).
      stopped = true
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    // Pausing gives progress and a place to stop; browsers without it render in one go.
    const step = Math.max(1, total / 40)
    for (let time = step; time < total - 0.5; time += step) {
      try {
        context
          .suspend(time)
          .then(() => {
            if (stopped) return
            options.onProgress?.(0.1 + (0.9 * time) / total)
            void context.resume()
          })
          .catch(() => undefined)
      } catch {
        break
      }
    }
    context.startRendering().then(
      (buffer) => {
        signal?.removeEventListener('abort', onAbort)
        if (stopped) return
        const full = [buffer.getChannelData(0), buffer.getChannelData(1)]
        const frames = audibleLength(
          full,
          Math.ceil(plan.duration * sampleRate),
          Math.ceil(TRIM_PADDING_SECONDS * sampleRate),
        )
        options.onProgress?.(1)
        resolve({ channels: full.map((data) => data.subarray(0, frames)), sampleRate })
      },
      (error: unknown) => {
        if (!stopped) reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}
