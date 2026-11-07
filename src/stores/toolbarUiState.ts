import { reactive } from 'vue'

/** The edit bar's tabs. */
export type EditTab = 'note' | 'effects' | 'dynamics' | 'bar' | 'text'

/** UI state of the toolbar and the note menu (not song state; that is useToolbarState). */
export const toolbarUiState = reactive({
  editTab: 'note' as EditTab,
})

/** The note menu: open at a point on the screen (a right-click, or the cursor for Shift+F10). */
export const noteMenuState = reactive({
  open: false,
  x: 0,
  y: 0,
  /** Opened by a long-press on a phone: shown as a bottom sheet. */
  sheet: false,
})

/** Element that had focus before the menu opened; it gets it back on close. */
let returnFocus: HTMLElement | null = null

export function openNoteMenu(x: number, y: number, options: { sheet?: boolean } = {}): void {
  if (!noteMenuState.open && typeof document !== 'undefined') {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  noteMenuState.x = x
  noteMenuState.y = y
  noteMenuState.sheet = options.sheet === true
  noteMenuState.open = true
}

export function closeNoteMenu({ restoreFocus = true } = {}): void {
  if (!noteMenuState.open) return
  noteMenuState.open = false
  if (restoreFocus) returnFocus?.focus({ preventScroll: true })
  returnFocus = null
}

export function setEditTab(tab: EditTab): void {
  toolbarUiState.editTab = tab
}
