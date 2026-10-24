import Song from '../../stores/song'
import { publishPlaybackPosition } from '../editor/playbackEngineBridge'
import { ticksBefore } from './songCursor'

/** Where Play starts: a bar and the ticks (whole = 64) into it. Moved by clicks and the cursor. */
export const startPosition = { block: 0, positionInBlock: 0 }

/** Sets the start to a beat and shows it as the playback position. */
export function setStartPosition(trackId: number, blockId: number, voiceId: number, beatId: number): void {
  startPosition.block = blockId
  startPosition.positionInBlock = ticksBefore(Song, trackId, blockId, voiceId, beatId)
  publishPlaybackPosition(blockId, beatId, startPosition.positionInBlock)
}

export function resetStartPosition(): void {
  startPosition.block = 0
  startPosition.positionInBlock = 0
}
