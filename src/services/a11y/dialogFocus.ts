import { wrapTabFocus } from './focusable'

/**
 * Keyboard and focus handling of the dialog windows (used by BaseModal and ModalsContainer,
 * which load with the first dialog that opens): the focus moves in on opening and back on
 * closing, Escape closes the window in front, and Tab stays inside it.
 */

/**
 * Windows that stay open beside the tab while you play or edit: Tab may leave them.
 * In the others Tab goes round inside the window until it is closed (Escape).
 */
const TOOL_WINDOWS = new Set([
  'pianoModal',
  'guitarModal',
  'mixerModal',
  'compressorModal',
  'equalizerModal',
  'midiModal',
])

// A text field gets the focus when a dialog opens (except on phones: no keyboard popping up).
const FIRST_FIELD =
  'input[type="text"], input[type="number"], input[type="search"], input:not([type]), textarea'

/** Escape and Tab while a dialog is open; `frontId` is the window in front, `modal` its element. */
export function handleDialogKey(
  event: KeyboardEvent,
  frontId: string | null,
  modal: HTMLElement | null,
  close: (id: string) => void,
): void {
  if (event.defaultPrevented || (event.key !== 'Escape' && event.key !== 'Tab')) return
  if (frontId == null || modal == null) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close(frontId)
    return
  }
  if (TOOL_WINDOWS.has(frontId) || !modal.contains(document.activeElement)) return
  if (wrapTabFocus(modal, event.shiftKey)) event.preventDefault()
}

/** Moves the focus into a dialog that just opened, unless its own code already did. */
export function focusInto(modal: HTMLElement, compact: boolean): void {
  requestAnimationFrame(() => {
    if (!modal.classList.contains('active') || modal.contains(document.activeElement)) return
    const field = compact ? null : modal.querySelector<HTMLElement>(`.modalBody :is(${FIRST_FIELD})`)
    const target = field != null && field.getClientRects().length > 0 ? field : modal
    target.focus({ preventScroll: true })
  })
}

/** After closing: back to where the focus came from, else the dialog in front, else the tab. */
export function restoreFocus(saved: HTMLElement | undefined, front: HTMLElement | null): void {
  const candidates = [
    saved?.isConnected && saved.getClientRects().length > 0 && !saved.closest('.modal:not(.active)')
      ? saved
      : null,
    front,
    document.querySelector<HTMLElement>('.tab-svg'),
  ]
  candidates.find((element) => element != null)?.focus({ preventScroll: true })
}
