import { typedEventBus } from '../utils/typedEventBus'
/**
 * Canonical song-data change notification on `typedEventBus`.
 */
export function notifySongDataChanged(): void {
  typedEventBus.emit('song-data-changed')
}
