import { notifySongDataChanged } from '../appEvents'

interface TrackLayoutHost {
  assignBlocksToRows(trackId: number, voiceId: number): void
}

/**
 * Recompute row layout for a track/voice and notify Vue renderers.
 */
export function invalidateTrackLayout(
  tabInstance: TrackLayoutHost,
  trackId: number,
  voiceId: number,
  callback?: (() => void) | null,
): void {
  tabInstance.assignBlocksToRows(trackId, voiceId)
  notifySongDataChanged()
  callback?.()
}
