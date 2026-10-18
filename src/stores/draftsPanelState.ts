import { reactive } from 'vue'

/** Visibility of the "Recover drafts" panel (opened from the menu). */
export const draftsPanelState = reactive({ open: false })

export function toggleDraftsPanel(): void {
  draftsPanelState.open = !draftsPanelState.open
}

export function closeDraftsPanel(): void {
  draftsPanelState.open = false
}
