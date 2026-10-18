import { reactive } from 'vue'

/** Visibility of the keyboard shortcuts sheet (Help button or `?`). */
export const shortcutsHelpState = reactive({ open: false })

export function toggleShortcutsHelp(): void {
  shortcutsHelpState.open = !shortcutsHelpState.open
}

export function closeShortcutsHelp(): void {
  shortcutsHelpState.open = false
}
