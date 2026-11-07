/**
 * Touch gestures on the tab (phone layout): one pointer pipeline on #mainContent for pinch
 * (zoom), swipe (next/previous beat) and long-press (note menu). Vertical panning stays native
 * scrolling (`touch-action: pan-y`); the browser then cancels the pointers and we stay out.
 */

/** Movement a finger may make and still count as holding still (px). */
export const TOUCH_SLOP = 8
/** Hold this long without moving for a long-press (ms). */
export const LONG_PRESS_MS = 500
/** A swipe moves at least this far sideways (px)… */
export const SWIPE_MIN_DISTANCE = 40
/** …and is done within this time (ms). */
export const SWIPE_MAX_MS = 300

export type Gesture = 'pinch' | 'swipe-left' | 'swipe-right' | 'long-press' | 'tap' | 'scroll' | 'pending'

export interface GestureSample {
  /** Fingers down now. */
  pointerCount: number
  /** Movement of the first finger since it went down (px). */
  dx: number
  dy: number
  elapsedMs: number
  /** The finger has lifted. */
  ended: boolean
}

/**
 * What a touch is so far. Two or more fingers are a pinch (it wins over everything); a quick
 * sideways move is a swipe; holding still is a long-press; a short still touch is a tap; any
 * other movement is native scrolling. 'pending' means it can still become a swipe or long-press.
 */
export function classifyGesture({ pointerCount, dx, dy, elapsedMs, ended }: GestureSample): Gesture {
  if (pointerCount >= 2) return 'pinch'
  const horizontal = Math.abs(dx) > 2 * Math.abs(dy)
  if (horizontal && Math.abs(dx) > SWIPE_MIN_DISTANCE && elapsedMs <= SWIPE_MAX_MS) {
    return dx < 0 ? 'swipe-left' : 'swipe-right'
  }
  if (Math.hypot(dx, dy) <= TOUCH_SLOP) {
    if (ended) return 'tap'
    return elapsedMs >= LONG_PRESS_MS ? 'long-press' : 'pending'
  }
  if (horizontal && !ended && elapsedMs <= SWIPE_MAX_MS) return 'pending'
  return 'scroll'
}

export interface Point {
  x: number
  y: number
}

export interface GestureHandlers {
  /** Two fingers down: the gesture is a pinch from now on. */
  pinchStart?: (a: Point, b: Point) => void
  pinchMove?: (a: Point, b: Point) => void
  pinchEnd?: () => void
  swipe?: (direction: 'left' | 'right') => void
  /** `target` is the element under the finger when it went down. */
  longPress?: (point: Point, target: Element | null) => void
}

/** Mouse events the browser emulates after a touch, which must not act on a swipe or long-press. */
const EMULATED_MOUSE_EVENTS = ['mousedown', 'mouseup', 'click'] as const
/** They follow the finger lifting at once; the next touch ends the suppression anyway. */
const SUPPRESS_MS = 600

/** Long-press hands this marked `contextmenu` to the tab view, which opens the note menu. */
export const LONG_PRESS_CONTEXTMENU = new WeakSet<Event>()

/**
 * Blocks what the browser adds to a touch: Android's long-press menu on the container, and the
 * mouse events it emulates after a swipe or long-press (on the document: after a long-press the
 * finger lifts over the note menu, not the tab). `suppress()` arms it until the next touch.
 */
function blockEmulatedEvents(container: HTMLElement) {
  let suppressUntil = 0
  const onContextMenu = (event: Event) => {
    if (LONG_PRESS_CONTEXTMENU.has(event)) return
    event.preventDefault()
    event.stopPropagation()
  }
  // A new touch is a new tap: its own click must get through, however soon it comes.
  const onAnyPointerDown = () => {
    suppressUntil = 0
  }
  const onEmulatedMouse = (event: Event) => {
    if (performance.now() < suppressUntil) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  container.addEventListener('contextmenu', onContextMenu, true)
  for (const type of EMULATED_MOUSE_EVENTS) document.addEventListener(type, onEmulatedMouse, true)
  document.addEventListener('pointerdown', onAnyPointerDown, true)
  return {
    suppress: () => {
      suppressUntil = performance.now() + SUPPRESS_MS
    },
    detach: () => {
      container.removeEventListener('contextmenu', onContextMenu, true)
      for (const type of EMULATED_MOUSE_EVENTS) document.removeEventListener(type, onEmulatedMouse, true)
      document.removeEventListener('pointerdown', onAnyPointerDown, true)
    },
  }
}

/** One touch sequence on the tab: which gesture it is and the handlers it fires. */
class GestureTracker {
  private readonly pointers = new Map<number, Point>()
  private first: { id: number; x: number; y: number; at: number; target: Element | null } | null = null
  private decided: Gesture | null = null
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly handlers: GestureHandlers,
    private readonly blocker: { suppress(): void },
  ) {}

  down(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.pointers.size === 1) {
      const target = event.target as Element
      this.first = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), target }
      this.decided = null
      clearTimeout(this.timer)
      this.timer = setTimeout(() => this.checkLongPress(), LONG_PRESS_MS)
    } else if (this.pointers.size === 2 && this.decided !== 'pinch') {
      // A second finger turns whatever the first one started into a pinch.
      clearTimeout(this.timer)
      this.decided = 'pinch'
      const [a, b] = [...this.pointers.values()]
      this.handlers.pinchStart?.(a, b)
    }
  }

  move(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return
    const point = { x: event.clientX, y: event.clientY }
    this.pointers.set(event.pointerId, point)
    if (this.decided === 'pinch') {
      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()]
        this.handlers.pinchMove?.(a, b)
      }
      return
    }
    if (this.decided != null || this.first == null || event.pointerId !== this.first.id) return
    const gesture = classifyGesture(this.sample(point, false))
    if (gesture === 'swipe-left' || gesture === 'swipe-right') this.finish(gesture, point)
    else if (gesture === 'scroll') {
      this.decided = 'scroll'
      clearTimeout(this.timer)
    }
  }

  up(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return
    const point = { x: event.clientX, y: event.clientY }
    const first = this.first
    if (this.decided == null && first != null && event.pointerId === first.id && event.type === 'pointerup') {
      // A quick flick can end before a move event crossed the swipe distance.
      const gesture = classifyGesture(this.sample(point, true))
      if (gesture === 'swipe-left' || gesture === 'swipe-right') this.finish(gesture, point)
    }
    this.pointers.delete(event.pointerId)
    // The emulated mouse events follow the finger lifting, however long it was held.
    if (this.decided != null && this.decided !== 'scroll') this.blocker.suppress()
    if (this.decided === 'pinch' && this.pointers.size < 2) {
      this.handlers.pinchEnd?.()
      // The remaining finger must not turn into a swipe or long-press.
      this.decided = 'scroll'
    }
    if (this.pointers.size === 0) this.reset()
  }

  reset(): void {
    clearTimeout(this.timer)
    this.first = null
    this.decided = null
  }

  private checkLongPress(): void {
    if (this.first == null || this.decided != null) return
    const point = this.pointers.get(this.first.id) ?? this.first
    if (classifyGesture(this.sample(point, false)) === 'long-press') this.finish('long-press', point)
  }

  private sample(point: Point, ended: boolean): GestureSample {
    return {
      pointerCount: this.pointers.size,
      dx: point.x - this.first!.x,
      dy: point.y - this.first!.y,
      elapsedMs: performance.now() - this.first!.at,
      ended,
    }
  }

  private finish(gesture: Gesture, point: Point): void {
    this.decided = gesture
    clearTimeout(this.timer)
    if (gesture === 'swipe-left' || gesture === 'swipe-right') {
      this.blocker.suppress()
      this.handlers.swipe?.(gesture === 'swipe-left' ? 'left' : 'right')
    } else if (gesture === 'long-press') {
      this.blocker.suppress()
      this.handlers.longPress?.(point, this.first?.target ?? null)
    }
  }
}

export function attachTouchGestures(container: HTMLElement, handlers: GestureHandlers): () => void {
  const blocker = blockEmulatedEvents(container)
  const tracker = new GestureTracker(handlers, blocker)
  const onDown = (event: PointerEvent) => tracker.down(event)
  const onMove = (event: PointerEvent) => tracker.move(event)
  const onUp = (event: PointerEvent) => tracker.up(event)
  container.addEventListener('pointerdown', onDown)
  container.addEventListener('pointermove', onMove)
  container.addEventListener('pointerup', onUp)
  container.addEventListener('pointercancel', onUp)
  return () => {
    tracker.reset()
    container.removeEventListener('pointerdown', onDown)
    container.removeEventListener('pointermove', onMove)
    container.removeEventListener('pointerup', onUp)
    container.removeEventListener('pointercancel', onUp)
    blocker.detach()
  }
}

/** Opens the note menu at a long-press: a marked `contextmenu` on the element under the finger. */
export function dispatchLongPressMenu(point: Point, target: Element | null): void {
  const element = target ?? document.elementFromPoint(point.x, point.y)
  if (element == null) return
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    button: 2,
  })
  LONG_PRESS_CONTEXTMENU.add(event)
  element.dispatchEvent(event)
}
