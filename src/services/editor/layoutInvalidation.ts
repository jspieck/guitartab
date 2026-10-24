import { notifySongDataChanged } from '../appEvents'
import { relayoutTrack } from './measureLayoutEngine'

/** Lays out a track/voice again and lets the Vue renderers redraw it. */
export function redrawTrack(trackId: number, voiceId: number, callback?: (() => void) | null): void {
  relayoutTrack(trackId, voiceId)
  notifySongDataChanged()
  callback?.()
}
