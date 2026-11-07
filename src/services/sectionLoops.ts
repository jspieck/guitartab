import Song from '../stores/song'
import { playbackLoopState } from '../stores/playbackLoopState'
import { announce } from '../stores/announcerState'
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
  announce(`Looping ${section.text}, bars ${section.startBlock + 1} to ${section.endBlock}`)
}
