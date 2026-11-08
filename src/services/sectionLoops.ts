import Song from '../stores/song'
import { playbackLoopState } from '../stores/playbackLoopState'
import { announce } from '../stores/announcerState'
import { practiceState, setPlaybackRate } from '../stores/practiceState'
import { sectionRate, setSectionRate } from '../stores/sectionPracticeState'
import { sectionAt } from '../utils/markerSections'
import { applyRangeAsLoop, clearRange, extendRange, startRange } from './editor/rangeSelection'

/** Whether the loop is exactly the section's bars. */
export function isSectionLooped(startBlock: number, endBlock: number): boolean {
  const loop = playbackLoopState
  return (
    loop.active && loop.startBlock === startBlock && loop.endBlock === endBlock - 1 && loop.startRatio === 0
  )
}

/**
 * Loops the section that starts at a marker (Intro, Riff, …) on the shown track, or ends
 * the loop when that section is already looped.
 */
export function toggleSectionLoop(blockId: number): void {
  const section = sectionAt(Song.measureMeta, blockId)
  if (section == null) return
  if (isSectionLooped(section.startBlock, section.endBlock)) {
    clearRange()
    announce(`Loop off: ${section.text}`)
    return
  }
  const trackId = Song.currentTrackId
  const voiceId = Song.currentVoiceId
  const lastBlock = section.endBlock - 1
  const lastBeat = Math.max(0, (Song.measures[trackId]?.[lastBlock]?.[voiceId]?.length ?? 1) - 1)
  startRange(trackId, section.startBlock, voiceId, 0)
  extendRange(trackId, lastBlock, voiceId, lastBeat)
  applyRangeAsLoop()
  // with the speed trainer: start slow, or where this section was left (Big win 28)
  const speed = practiceState.trainer ? (sectionRate(section.startBlock) ?? practiceState.trainerStart) : null
  if (speed != null) setPlaybackRate(speed)
  const atSpeed = speed != null ? ` at ${Math.round(speed * 100)} %` : ''
  announce(`Looping ${section.text}, bars ${section.startBlock + 1} to ${section.endBlock}${atSpeed}`)
}

/** The marker section the loop is exactly, or null. */
export function loopedSection(): { startBlock: number; endBlock: number; text: string } | null {
  if (!playbackLoopState.active) return null
  const section = sectionAt(Song.measureMeta, playbackLoopState.startBlock)
  return section && isSectionLooped(section.startBlock, section.endBlock) ? section : null
}

/** Remembers the speed reached in the looped section (called on speed changes). */
export function rememberSectionSpeed(rate: number): void {
  const section = loopedSection()
  if (section && practiceState.trainer) setSectionRate(section.startBlock, rate)
}

/**
 * Loops whole bars `first`…`last` (0-based, in either order) on the shown track: the
 * practice options' numeric loop entry. Out-of-range bars are clamped.
 */
export function loopBars(first: number, last: number): void {
  const count = Song.measureMeta.length
  if (count === 0) return
  const clamp = (bar: number) => Math.min(count - 1, Math.max(0, Math.round(bar)))
  const [from, to] = [clamp(Math.min(first, last)), clamp(Math.max(first, last))]
  const trackId = Song.currentTrackId
  const voiceId = Song.currentVoiceId
  const lastBeat = Math.max(0, (Song.measures[trackId]?.[to]?.[voiceId]?.length ?? 1) - 1)
  startRange(trackId, from, voiceId, 0)
  extendRange(trackId, to, voiceId, lastBeat)
  applyRangeAsLoop()
  announce(from === to ? `Looping bar ${from + 1}` : `Looping bars ${from + 1} to ${to + 1}`)
}
