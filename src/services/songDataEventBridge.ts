/**
 * Song-data notifications now emit only on `typedEventBus`
 * (via `notifySongDataChanged` / `appEvents.ts`).
 * Compatibility relays to the legacy mitt bus have been removed.
 */
export function ensureSongDataEventBridge(): void {
  // intentionally empty — typedEventBus is the sole song-data event bus
}
