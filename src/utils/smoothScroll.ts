/**
 * One smooth vertical scroll per element at a time. Starts from the element's real scrollTop
 * (not a remembered value), replaces an animation that is still running, and stops as soon
 * as the user scrolls themselves, so automatic scrolling never fights or jumps back.
 */

interface Running {
  frame: number
  stop: () => void
}

const running = new WeakMap<HTMLElement, Running>()

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function cancelSmoothScroll(element: HTMLElement): void {
  running.get(element)?.stop()
}

export function smoothScrollTo(element: HTMLElement, target: number, durationMs = 450): void {
  cancelSmoothScroll(element)
  const max = Math.max(0, element.scrollHeight - element.clientHeight)
  const to = Math.min(max, Math.max(0, Math.round(target)))
  const from = element.scrollTop
  if (Math.abs(to - from) < 1) return
  if (durationMs <= 0 || prefersReducedMotion()) {
    element.scrollTop = to
    return
  }

  const startedAt = performance.now()
  const userScrolls = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const
  const stop = () => {
    cancelAnimationFrame(entry.frame)
    userScrolls.forEach((type) => element.removeEventListener(type, stop))
    if (running.get(element) === entry) running.delete(element)
  }
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / durationMs)
    element.scrollTop = from + (to - from) * easeInOutQuad(progress)
    if (progress < 1) entry.frame = requestAnimationFrame(step)
    else stop()
  }
  const entry: Running = { frame: requestAnimationFrame(step), stop }
  running.set(element, entry)
  userScrolls.forEach((type) => element.addEventListener(type, stop, { passive: true }))
}

/** Space kept above a row that was scrolled to the top, and below the last visible row. */
export const ROW_SCROLL_MARGIN = 16

/**
 * The scrollTop that shows `span` (content coordinates), or null when it is already fully
 * visible. A row that doesn't fit goes to the top.
 */
export function revealScrollTop(
  span: { top: number; bottom: number },
  scrollTop: number,
  viewHeight: number,
  margin = ROW_SCROLL_MARGIN,
): number | null {
  const visible = span.top >= scrollTop && span.bottom <= scrollTop + viewHeight - margin
  if (visible) {
    return null
  }
  return Math.max(0, Math.round(span.top - margin))
}
