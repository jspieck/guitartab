import mitt, { Emitter, Handler, WildcardHandler } from 'mitt'
import type { TabBeat, TabNoteData, TabPosition } from '../types/tab'

export type { TabPosition } from '../types/tab'

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
  beat: TabBeat
  note: TabNoteData | null
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
  'menu.activateEffectsForNote': TabNoteData
  'menu.activateEffectsForBeat': TabBeat
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

class TypedEventBus {
  private emitter: Emitter<AppEvents>

  constructor() {
    this.emitter = mitt<AppEvents>()
  }

  on<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): void {
    this.emitter.on(event, handler)
  }

  off<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): void {
    this.emitter.off(event, handler)
  }

  emit<K extends keyof AppEvents>(event: K, payload?: AppEvents[K]): void {
    this.emitter.emit(event, payload as AppEvents[K])
  }

  onAll(handler: (event: keyof AppEvents, payload: AppEvents[keyof AppEvents]) => void): void {
    const wildcardHandler: WildcardHandler<AppEvents> = (event, payload) => {
      handler(event, payload)
    }

    this.emitter.on('*', wildcardHandler)
  }

  clearAll(): void {
    this.emitter.all.clear()
  }
}

export const typedEventBus = new TypedEventBus()
export default typedEventBus
