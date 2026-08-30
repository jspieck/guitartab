import { typedEventBus } from '../utils/typedEventBus'
/**
 * Canonical song-data change notification.
 * Prefer this over calling EventBus or typedEventBus directly.
 */
export function notifySongDataChanged(): void {
  typedEventBus.emit('song-data-changed')
}

export function ensureSongDataEventBridge(): void {
  void import('./songDataEventBridge').then(({ ensureSongDataEventBridge }) => {
    ensureSongDataEventBridge()
  })
}
