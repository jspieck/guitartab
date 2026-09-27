/**
 * Menu events now emit directly on `typedEventBus`.
 * This no-op remains so existing `ensureMenuEventBridge()` call sites stay valid.
 */
export function ensureMenuEventBridge(): void {
  // intentionally empty — typedEventBus is the sole menu event bus
}
