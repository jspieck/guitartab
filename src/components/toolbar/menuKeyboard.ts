const ITEM_SELECTOR = '[role^="menuitem"]:not(:disabled), [role="tab"]:not(:disabled)'

/**
 * Arrow-key movement between the entries of a menu (in reading order; the note menu's rows
 * wrap into the next row). `key` is a KeyboardEvent key, or 'first' to focus the first entry.
 * Returns whether the key was one this handles.
 */
export function focusMenuItem(container: HTMLElement | null, key: string): boolean {
  if (container == null) return false
  const items = Array.from(container.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
  if (items.length === 0) return false
  const current = items.indexOf(document.activeElement as HTMLElement)
  let next: number
  switch (key) {
    case 'first':
    case 'Home':
      next = 0
      break
    case 'End':
      next = items.length - 1
      break
    case 'ArrowDown':
    case 'ArrowRight':
      next = current < 0 ? 0 : (current + 1) % items.length
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
      break
    default:
      return false
  }
  items[next].focus()
  return true
}
