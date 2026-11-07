import { layoutModeState } from '../../stores/layoutModeState'
import { openNoteMenu } from '../../stores/toolbarUiState'

/** Opens the note menu next to the edit cursor (Shift+F10, the context-menu key). */
export function openNoteMenuAtCursor(): void {
  if (layoutModeState.compact) {
    openNoteMenu(0, 0, { sheet: true })
    return
  }
  const cursor = document.querySelector('.selection-indicator rect')?.getBoundingClientRect()
  if (cursor != null && cursor.width > 0) {
    openNoteMenu(cursor.left + cursor.width / 2, cursor.bottom)
    return
  }
  // The cursor's row isn't mounted (scrolled away): open in the middle of the sheet.
  const sheet = document.getElementById('mainContent')?.getBoundingClientRect()
  openNoteMenu(sheet ? sheet.left + sheet.width / 2 : 200, sheet ? sheet.top + 80 : 200)
}
