import type { Interval, MeasureMetaInfo } from '../../types/song'
import { buildPlayOrder } from '../playback/playOrder'
import { computeCountIn, getBarBeatPositions, secondsPerWhole } from '../practiceTiming'

/**
 * What an audio render plays and when: the bars in order (repeats and jumps played out, or
 * every bar once), each with its start in seconds and its tempo, an optional count-in bar,
 * and the metronome clicks. Pure: bar data in, a timeline out. The renderer then schedules
 * each bar's beats through `notePlayback`, as playback does.
 */

export interface RenderPlanOptions {
  /** the whole song, or the loop interval once */
  range: 'song' | 'loop'
  loop: Interval | null
  /** true: repeats, voltas and D.C./D.S. played out (as playback does); false: every bar once */
  unrollRepeats: boolean
  /** a bar of clicks before the first note */
  countIn: boolean
  /** the practice speed factor (1 = as written) */
  playbackRate: number
  /** tempo when no bar up to the first one sets one (quarters per minute) */
  songBpm: number
}

export interface PlannedBar {
  blockId: number
  /** whole notes into the bar where this pass starts and ends (a loop cuts its first and last bar) */
  from: number
  to: number
  /** seconds from the render start to position `from` */
  start: number
  /** tempo in this bar (quarters per minute, as written) */
  bpm: number
  secondsPerWhole: number
}

export interface PlannedClick {
  time: number
  accent: boolean
}

export interface RenderPlan {
  bars: PlannedBar[]
  countInClicks: PlannedClick[]
  /** seconds until the last bar ends (releases and reverb ring on after it) */
  duration: number
}

const EPSILON = 1e-6

function barLength(meta: MeasureMetaInfo): number {
  return meta.numerator / meta.denominator
}

/** The tempo in force at a bar in written order: the last bar up to it that sets one. */
function tempoAt(meta: readonly MeasureMetaInfo[], blockId: number, fallback: number): number {
  for (let i = blockId; i >= 0; i -= 1) {
    const bpm = meta[i]?.bpm
    if (bpm != null && bpm > 0) return bpm
  }
  return fallback > 0 ? fallback : 120
}

/** The bars to play with the part of each that sounds. */
function playedSpans(
  meta: readonly MeasureMetaInfo[],
  options: RenderPlanOptions,
): { blockId: number; from: number; to: number }[] {
  const loop = options.range === 'loop' ? options.loop : null
  const first = loop?.startBlock ?? 0
  let order = options.unrollRepeats
    ? buildPlayOrder(meta, first).map((bar) => bar.blockId)
    : meta.map((_, blockId) => blockId).slice(first)
  if (loop != null) {
    // up to the first time the loop's end bar is played
    const end = order.indexOf(loop.endBlock)
    order = end === -1 ? order.filter((blockId) => blockId <= loop.endBlock) : order.slice(0, end + 1)
  }
  return order.map((blockId, index) => ({
    blockId,
    from: loop != null && index === 0 ? loop.startRatio : 0,
    to: loop != null && index === order.length - 1 ? loop.endRatio : barLength(meta[blockId]),
  }))
}

export function buildRenderPlan(meta: readonly MeasureMetaInfo[], options: RenderPlanOptions): RenderPlan {
  const spans = playedSpans(meta, options).filter((span) => span.to > span.from + EPSILON)
  const rate = options.playbackRate > 0 ? options.playbackRate : 1
  const countInClicks: PlannedClick[] = []
  let time = 0
  if (options.countIn && spans.length > 0) {
    const firstMeta = meta[spans[0].blockId]
    const bpm = tempoAt(meta, spans[0].blockId, options.songBpm)
    const countIn = computeCountIn(firstMeta.numerator, firstMeta.denominator, bpm, rate, 0)
    time = countIn.duration
    countInClicks.push(...countIn.clicks.map((click) => ({ ...click, time: click.time + time })))
  }
  let bpm = spans.length > 0 ? tempoAt(meta, spans[0].blockId, options.songBpm) : options.songBpm
  const bars = spans.map((span) => {
    // as playback does: a bar with a tempo sets it, the others keep the one before
    const own = meta[span.blockId].bpm
    if (own != null && own > 0) bpm = own
    const perWhole = secondsPerWhole(bpm, rate)
    const bar: PlannedBar = { ...span, start: time, bpm, secondsPerWhole: perWhole }
    time += (span.to - span.from) * perWhole
    return bar
  })
  return { bars, countInClicks, duration: time }
}

/** The metronome clicks of the planned bars: one per beat of each bar's meter, accented on beat 1. */
export function plannedClicks(meta: readonly MeasureMetaInfo[], plan: RenderPlan): PlannedClick[] {
  const clicks: PlannedClick[] = []
  for (const bar of plan.bars) {
    const { numerator, denominator } = meta[bar.blockId]
    getBarBeatPositions(numerator, denominator, bar.to).forEach((position, beat) => {
      if (position < bar.from - EPSILON) return
      clicks.push({ time: bar.start + (position - bar.from) * bar.secondsPerWhole, accent: beat === 0 })
    })
  }
  return clicks
}

/** "3:07" */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
