/**
 * Keyboard movement in the toolbars (WAI-ARIA toolbar pattern): ←/→ go to the previous/next
 * button of the whole bar, Home/End to its ends, and Tab stops once per button group (the
 * group's last focused button), so a keyboard user doesn't tab through 40 buttons.
 * A bar opts in with `data-roving-toolbar`; groups are `.toolbar__group` or `data-roving-group`.
 */

const GROUP = '.toolbar__group, [data-roving-group]'
const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])
// Which keys the bar takes is decided by isToolbarNavigationKey (utils/keyboardShortcuts.ts).

function usable(button: HTMLButtonElement): boolean {
  return !button.disabled && button.getClientRects().length > 0
}

function buttonsOf(root: ParentNode): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter(usable)
}

/** Gives each group exactly one Tab stop: the focused button, the previous stop, or the first. */
export function syncRovingTabindex(toolbar: HTMLElement): void {
  const active = document.activeElement
  for (const group of Array.from(toolbar.querySelectorAll<HTMLElement>(GROUP))) {
    // Buttons of a nested group belong to that group.
    const all = Array.from(group.querySelectorAll<HTMLButtonElement>('button')).filter(
      (button) => button.closest(GROUP) === group,
    )
    const buttons = all.filter(usable)
    const stop =
      buttons.find((button) => button === active) ??
      buttons.find((button) => button.getAttribute('tabindex') === '0') ??
      buttons[0]
    for (const button of all) {
      const value = button === stop ? '0' : '-1'
      if (button.getAttribute('tabindex') !== value) button.setAttribute('tabindex', value)
    }
  }
}

/** Moves the focus for ←/→/Home/End; returns whether it did. */
export function moveToolbarFocus(toolbar: HTMLElement, key: string): boolean {
  const buttons = buttonsOf(toolbar)
  if (buttons.length === 0 || !KEYS.has(key)) return false
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const last = buttons.length - 1
  const next =
    key === 'Home'
      ? 0
      : key === 'End'
        ? last
        : key === 'ArrowRight'
          ? current < 0 || current === last
            ? 0
            : current + 1
          : current <= 0
            ? last
            : current - 1
  buttons[next].focus()
  syncRovingTabindex(toolbar)
  return true
}
