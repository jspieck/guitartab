import { reactive } from 'vue'

// 'pending' from the first visit until the user dismisses the hint; it survives reloads.
const HINT_KEY = 'guitartab:firstRunHint'

function readPending(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === 'pending'
  } catch {
    return false
  }
}

/** The three-step "how to start" card shown to new visitors. */
export const firstRunHintState = reactive({ open: readPending() })

export function startFirstRunHint(): void {
  try {
    localStorage.setItem(HINT_KEY, 'pending')
  } catch {
    // Without storage the hint still shows for this visit.
  }
  firstRunHintState.open = true
}

export function dismissFirstRunHint(): void {
  try {
    localStorage.setItem(HINT_KEY, 'done')
  } catch {
    // Nothing to persist.
  }
  firstRunHintState.open = false
}
