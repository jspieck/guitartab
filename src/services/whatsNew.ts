import { DIALOGS, openDialog } from './dialogs/dialogs'

/**
 * "What's new" once after an update (Big win 34). The build tells the app the newest
 * CHANGELOG.md heading (`__CHANGELOG_LATEST__`, from site/vitePlugin.ts); the browser remembers
 * the last one shown. A first visit only remembers it: new visitors have nothing to compare.
 */
const SEEN_KEY = 'guitartab:whatsNewSeen'

/** The help page on the site; opened in a new tab so the song stays open. */
export const GETTING_STARTED_URL = 'getting-started.html'

export function openGettingStarted(): void {
  window.open(GETTING_STARTED_URL, '_blank', 'noopener')
}

/** True when the dialog should open now (and the entry counts as seen from then on). */
export function shouldShowWhatsNew(firstVisit: boolean, latest: string, storage: Storage): boolean {
  if (latest === '') return false
  try {
    const seen = storage.getItem(SEEN_KEY)
    if (seen === latest) return false
    storage.setItem(SEEN_KEY, latest)
    return !firstVisit
  } catch {
    // Storage blocked (private mode, policy): don't nag on every visit.
    return false
  }
}

export function showWhatsNewAfterUpdate(firstVisit: boolean): void {
  if (shouldShowWhatsNew(firstVisit, __CHANGELOG_LATEST__, localStorage)) void openDialog(DIALOGS.WHATS_NEW)
}
