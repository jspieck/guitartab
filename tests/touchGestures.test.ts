// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachTouchGestures,
  classifyGesture,
  LONG_PRESS_MS,
  SWIPE_MAX_MS,
  type GestureHandlers,
} from '../src/services/touchGestures'

const touch = { pointerCount: 1, dx: 0, dy: 0, elapsedMs: 0, ended: false }

describe('classifyGesture', () => {
  it('treats two fingers as a pinch, whatever they do', () => {
    expect(classifyGesture({ ...touch, pointerCount: 2, dx: 100 })).toBe('pinch')
    expect(classifyGesture({ ...touch, pointerCount: 3, elapsedMs: 900 })).toBe('pinch')
  })

  it('recognises a quick sideways move as a swipe in its direction', () => {
    expect(classifyGesture({ ...touch, dx: -60, dy: 10, elapsedMs: 150 })).toBe('swipe-left')
    expect(classifyGesture({ ...touch, dx: 60, dy: -20, elapsedMs: 150, ended: true })).toBe('swipe-right')
  })

  it('does not swipe when slow, short or mostly vertical', () => {
    expect(classifyGesture({ ...touch, dx: 60, elapsedMs: SWIPE_MAX_MS + 1 })).toBe('scroll')
    expect(classifyGesture({ ...touch, dx: 30, elapsedMs: 100, ended: true })).toBe('scroll')
    expect(classifyGesture({ ...touch, dx: 50, dy: 40, elapsedMs: 100 })).toBe('scroll')
  })

  it('waits while a sideways move can still become a swipe', () => {
    expect(classifyGesture({ ...touch, dx: 20, dy: 2, elapsedMs: 80 })).toBe('pending')
  })

  it('turns holding still into a long-press, and a short still touch into a tap', () => {
    expect(classifyGesture({ ...touch, dx: 3, dy: 4, elapsedMs: LONG_PRESS_MS })).toBe('long-press')
    expect(classifyGesture({ ...touch, dx: 3, elapsedMs: 200 })).toBe('pending')
    expect(classifyGesture({ ...touch, dx: 3, elapsedMs: 120, ended: true })).toBe('tap')
    // Moving more than the slop is scrolling, not a long-press.
    expect(classifyGesture({ ...touch, dy: 20, elapsedMs: 700 })).toBe('scroll')
  })
})

describe('attachTouchGestures', () => {
  let container: HTMLElement
  let detach: () => void
  let handlers: Required<GestureHandlers>

  const pointer = (type: string, id: number, x: number, y: number, pointerType = 'touch') =>
    container.dispatchEvent(
      new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType, bubbles: true }),
    )

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    handlers = {
      pinchStart: vi.fn(),
      pinchMove: vi.fn(),
      pinchEnd: vi.fn(),
      swipe: vi.fn(),
      longPress: vi.fn(),
    }
    detach = attachTouchGestures(container, handlers)
  })

  afterEach(() => {
    detach()
    container.remove()
    vi.useRealTimers()
  })

  it('swipes once per gesture', () => {
    pointer('pointerdown', 1, 200, 100)
    vi.advanceTimersByTime(80)
    pointer('pointermove', 1, 150, 104)
    pointer('pointermove', 1, 120, 104)
    pointer('pointerup', 1, 120, 104)
    expect(handlers.swipe).toHaveBeenCalledTimes(1)
    expect(handlers.swipe).toHaveBeenCalledWith('left')
    expect(handlers.longPress).not.toHaveBeenCalled()
  })

  it('long-presses after holding still, with the point and target', () => {
    pointer('pointerdown', 1, 50, 60)
    pointer('pointermove', 1, 52, 61)
    vi.advanceTimersByTime(LONG_PRESS_MS + 10)
    expect(handlers.longPress).toHaveBeenCalledWith({ x: 52, y: 61 }, container)
    pointer('pointerup', 1, 52, 61)
    expect(handlers.swipe).not.toHaveBeenCalled()
  })

  it('a second finger makes a pinch and cancels the long-press', () => {
    pointer('pointerdown', 1, 50, 60)
    pointer('pointerdown', 2, 150, 60)
    pointer('pointermove', 2, 200, 60)
    vi.advanceTimersByTime(LONG_PRESS_MS + 10)
    expect(handlers.pinchStart).toHaveBeenCalledWith({ x: 50, y: 60 }, { x: 150, y: 60 })
    expect(handlers.pinchMove).toHaveBeenCalledWith({ x: 50, y: 60 }, { x: 200, y: 60 })
    expect(handlers.longPress).not.toHaveBeenCalled()
    pointer('pointerup', 2, 200, 60)
    expect(handlers.pinchEnd).toHaveBeenCalledTimes(1)
    // The finger still down neither swipes nor long-presses.
    pointer('pointermove', 1, 0, 60)
    vi.advanceTimersByTime(LONG_PRESS_MS + 10)
    expect(handlers.swipe).not.toHaveBeenCalled()
    expect(handlers.longPress).not.toHaveBeenCalled()
  })

  it('ignores the mouse, and stops after a scroll was recognised', () => {
    pointer('pointerdown', 1, 200, 100, 'mouse')
    pointer('pointermove', 1, 100, 100, 'mouse')
    pointer('pointerdown', 2, 100, 100)
    pointer('pointermove', 2, 100, 160)
    vi.advanceTimersByTime(LONG_PRESS_MS + 10)
    pointer('pointermove', 2, 20, 160)
    expect(handlers.swipe).not.toHaveBeenCalled()
    expect(handlers.longPress).not.toHaveBeenCalled()
  })

  it('swallows the emulated click after a swipe and blocks the native long-press menu', () => {
    const clicked = vi.fn()
    container.addEventListener('click', clicked)
    pointer('pointerdown', 1, 200, 100)
    pointer('pointermove', 1, 100, 100)
    pointer('pointerup', 1, 100, 100)
    container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clicked).not.toHaveBeenCalled()

    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    container.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
  })
})
