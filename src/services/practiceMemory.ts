import { watch } from 'vue'
import Song from '../stores/song'
import { playbackLoopVersion } from '../stores/playbackLoopState'
import { clampPlaybackRate, practiceState, setPlaybackRate } from '../stores/practiceState'
import { selectionState } from '../stores/selectionState'
import { sectionPracticeState, setSectionRates } from '../stores/sectionPracticeState'
import { rememberSectionSpeed } from './sectionLoops'
import {
  applyRangeAsLoop,
  clearRange,
  currentLoopInterval,
  extendRange,
  startRange,
} from './editor/rangeSelection'

/**
 * Per-song practice memory: the playback speed and the loop. Kept per song in this browser
 * (so a Guitar Pro file opened again gets them back) and written into .gt files and autosave
 * drafts as their last part. Not song content: changing it doesn't make the song unsaved.
 */

interface LoopEnd {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
}

export interface PracticeMemory {
  playbackRate: number
  /** The loop's first and last beat; null without a loop. */
  loop: { start: LoopEnd; end: LoopEnd } | null
  /** Speed trainer per section loop: the speed reached, by the section's first bar (Big win 28). */
  sections?: Record<string, number>
}

const STORAGE_PREFIX = 'guitartab:practice-song:'
/** Songs remembered at most; the oldest are dropped. */
const MAX_SONGS = 50

function loopEnd({ trackId, blockId, voiceId, beatId }: LoopEnd): LoopEnd {
  return { trackId, blockId, voiceId, beatId }
}

export function currentPracticeMemory(): PracticeMemory {
  const { rangeStart, rangeEnd } = selectionState
  const looping = currentLoopInterval() != null && rangeStart != null && rangeEnd != null
  return {
    playbackRate: practiceState.playbackRate,
    loop: looping ? { start: loopEnd(rangeStart), end: loopEnd(rangeEnd) } : null,
    ...(Object.keys(sectionPracticeState.rates).length
      ? { sections: { ...sectionPracticeState.rates } }
      : {}),
  }
}

function validEnd(value: unknown): value is LoopEnd {
  if (value == null || typeof value !== 'object') return false
  const end = value as Record<string, unknown>
  const ints = ['trackId', 'blockId', 'voiceId', 'beatId'].every((key) => Number.isInteger(end[key]))
  if (!ints) return false
  const { trackId, blockId, voiceId, beatId } = end as unknown as LoopEnd
  return Song.measures[trackId]?.[blockId]?.[voiceId]?.[beatId] != null
}

/** Applies remembered speed and loop; returns false for data that doesn't fit this song. */
export function applyPracticeMemory(memory: unknown): boolean {
  if (memory == null || typeof memory !== 'object') return false
  const { playbackRate, loop, sections } = memory as Partial<PracticeMemory>
  setSectionRates(sections)
  if (typeof playbackRate === 'number') setPlaybackRate(clampPlaybackRate(playbackRate))
  if (loop != null && validEnd(loop.start) && validEnd(loop.end)) {
    const { start, end } = loop
    startRange(start.trackId, start.blockId, start.voiceId, start.beatId)
    extendRange(end.trackId, end.blockId, end.voiceId, end.beatId)
    applyRangeAsLoop()
  } else if (currentLoopInterval() != null) {
    clearRange()
  }
  return true
}

/** Which song this is, well enough to find its practice settings again. */
export function songMemoryKey(): string {
  const { title, artist } = Song.songDescription
  return [title, artist, Song.measureMeta.length, Song.tracks.length].join('|')
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function rememberPractice(): void {
  const store = storage()
  if (store == null || Song.measureMeta.length === 0) return
  try {
    const memory = currentPracticeMemory()
    store.setItem(`${STORAGE_PREFIX}${songMemoryKey()}`, JSON.stringify({ ...memory, savedAt: Date.now() }))
    const keys = Object.keys(store).filter((key) => key.startsWith(STORAGE_PREFIX))
    if (keys.length > MAX_SONGS) {
      const savedAt = (key: string) => Number(JSON.parse(store.getItem(key) ?? '{}').savedAt) || 0
      keys.sort((a, b) => savedAt(a) - savedAt(b))
      keys.slice(0, keys.length - MAX_SONGS).forEach((key) => store.removeItem(key))
    }
  } catch {
    // Storage full or unavailable: the memory lasts for this session only.
  }
}

/** After loading a song: the .gt file's own practice part, else what this browser remembers. */
export function recallPractice(fromFile?: unknown): void {
  setSectionRates(null)
  if (applyPracticeMemory(fromFile)) return
  try {
    const stored = storage()?.getItem(`${STORAGE_PREFIX}${songMemoryKey()}`)
    if (stored != null) applyPracticeMemory(JSON.parse(stored))
  } catch {
    // A damaged entry: start without it.
  }
}

let watching = false
let timer: ReturnType<typeof setTimeout> | null = null

/** Remembers speed and loop changes (after a short pause); call once at startup. */
export function watchPracticeMemory(): void {
  if (watching) return
  watching = true
  watch([() => practiceState.playbackRate, playbackLoopVersion], ([rate], [previousRate]) => {
    // the trainer's steps (and any speed change) while a section loops belong to that section
    if (rate !== previousRate) rememberSectionSpeed(rate)
    if (timer != null) clearTimeout(timer)
    timer = setTimeout(rememberPractice, 500)
  })
}
