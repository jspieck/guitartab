/**
 * Typed Event Bus
 * 
 * Provides type-safe event emission and subscription for the guitar tab application.
 * All events and their payloads are documented and typed.
 */

import mitt, { Emitter, Handler } from 'mitt'

// =============================================================================
// Event Payload Types
// =============================================================================

/** Position in the tab (track, block, voice, beat, string) */
export interface TabPosition {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
}

/** Partial position (for events that don't need all fields) */
export interface PartialTabPosition {
  trackId?: number
  blockId?: number
  voiceId?: number
  beatId?: number
  string?: number
}

/** Effect collision data */
export interface EffectCollisionData {
  isVariableSet: boolean
  beat: any
  note: any
  id: string
  index: number
}

/** Selection change data */
export interface SelectionChangeData {
  trackId: number
  voiceId: number
  blockId: number
  beatIndex: number
  stringIndex: number
}

// =============================================================================
// Event Map - All events and their payload types
// =============================================================================

export type AppEvents = {
  // Song data events
  'song-data-changed': void
  'song-loaded': void
  'song-saved': void
  
  // Menu events
  'menu.clickedOnPos': TabPosition
  'menu.activateEffectsForPos': TabPosition
  'menu.activateEffectsForMarkedPos': void
  'menu.activateEffectsForMarkedBeat': void
  'menu.activateEffectsForBlock': void
  'menu.activateEffectsForNote': any  // Note object
  'menu.activateEffectsForBeat': any  // Beat object
  'menu.setEffectOnCollision': EffectCollisionData
  
  // Selection events
  'selection.changed': SelectionChangeData | null
  'selection.cleared': void
  
  // Playback events
  'playback.started': void
  'playback.stopped': void
  'playback.paused': void
  'playback.positionChanged': { blockId: number; beatId: number }
  
  // UI events
  'ui.zoomChanged': number
  'ui.trackChanged': number
  'ui.voiceChanged': number
  'ui.disablePageMode': void
  
  // Navigation events - for scrolling/clicking position in tab view
  'navigation.setClickedPos': TabPosition
  'navigation.scrollToBlock': { trackId: number; voiceId: number; blockId: number }
  'navigation.moveMarker': TabPosition & { pageId: number }
  
  // Rendering events - for triggering re-renders
  'render.block': { trackId: number; blockId: number; voiceId: number }
  'render.blocks': { trackId: number; blockIds: number[]; voiceId: number }
  'render.all': void
  'render.overBar': { trackId: number; blockId: number; voiceId: number; rerender?: boolean }
  'render.durations': { trackId: number; blockId: number; voiceId: number }
  
  // Modal events
  'modal.opened': string
  'modal.closed': string
}

// =============================================================================
// Typed Event Bus
// =============================================================================

class TypedEventBus {
  private emitter: Emitter<AppEvents>
  
  constructor() {
    this.emitter = mitt<AppEvents>()
  }
  
  /**
   * Subscribe to an event
   */
  on<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): void {
    this.emitter.on(event, handler)
  }
  
  /**
   * Unsubscribe from an event
   */
  off<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): void {
    this.emitter.off(event, handler)
  }
  
  /**
   * Emit an event
   */
  emit<K extends keyof AppEvents>(event: K, payload?: AppEvents[K]): void {
    this.emitter.emit(event, payload as AppEvents[K])
  }
  
  /**
   * Subscribe to all events (for debugging)
   */
  onAll(handler: (event: keyof AppEvents, payload: any) => void): void {
    this.emitter.on('*', handler as any)
  }
  
  /**
   * Clear all event handlers
   */
  clearAll(): void {
    this.emitter.all.clear()
  }
}

// Export singleton instance
export const typedEventBus = new TypedEventBus()

// Export for backwards compatibility - wraps the old mitt instance
// This allows gradual migration
export default typedEventBus
