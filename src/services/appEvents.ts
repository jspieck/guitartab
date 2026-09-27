import { typedEventBus } from '../utils/typedEventBus'
/**
 * Canonical song-data change notification on `typedEventBus`.
 */
export function notifySongDataChanged(): void {
  typedEventBus.emit('song-data-changed')
}

/** @deprecated No-op kept for older call sites. */
export function ensureSongDataEventBridge(): void {
  void import('./songDataEventBridge').then(({ ensureSongDataEventBridge }) => {
    ensureSongDataEventBridge()
  })
}
