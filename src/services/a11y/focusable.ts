const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isShown(element: HTMLElement): boolean {
  // Hidden by display:none (or inside such an element) gives no boxes; `inert` subtrees can't take focus.
  return element.getClientRects().length > 0 && element.closest('[inert]') == null
}

/** The elements Tab reaches inside `root`, in order (tabindex > 0 is not used in this app). */
export function focusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isShown)
}

/**
 * Tab and Shift+Tab inside `root`: from the last element to the first and back.
 * Returns whether it moved the focus (the caller then cancels the key).
 */
export function wrapTabFocus(root: HTMLElement, backwards: boolean): boolean {
  const items = focusableElements(root)
  const active = document.activeElement as HTMLElement | null
  if (items.length === 0) {
    root.focus({ preventScroll: true })
    return true
  }
  const first = items[0]
  const last = items[items.length - 1]
  if (backwards && (active === first || active === root)) {
    last.focus()
    return true
  }
  if (!backwards && active === last) {
    first.focus()
    return true
  }
  return false
}
