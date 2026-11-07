import type { App } from 'vue'
import { showNotification } from '../stores/notificationState'

/**
 * Last line of defence: errors nothing else caught become a banner instead of a silently broken
 * editor. A part of the app that fails to load (after a redeploy the old hashed chunk files are
 * gone; or the connection dropped) gets a Reload button: the autosave restores the song.
 */

// The browsers' messages for a failed dynamic import() (Chromium, Safari, Firefox).
const CHUNK_LOAD_FAILURE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i

// Harmless browser noise, not our bug.
const IGNORED = /ResizeObserver loop|^Script error\.?$/i

/** Not more than one banner per this many ms, so an error in a loop doesn't flood the screen. */
const BANNER_INTERVAL_MS = 10_000

let lastBannerAt = -Infinity

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

export function isChunkLoadFailure(error: unknown): boolean {
  return CHUNK_LOAD_FAILURE.test(messageOf(error))
}

export function reportUnexpectedError(error: unknown, now = Date.now()): void {
  const message = messageOf(error)
  if (IGNORED.test(message)) return
  console.error(error)
  if (now - lastBannerAt < BANNER_INTERVAL_MS) return
  lastBannerAt = now
  if (isChunkLoadFailure(error)) {
    showNotification(
      'Part of the app could not be loaded (it may have been updated). Reload to continue; your song is autosaved.',
      'error',
      {
        label: 'Reload',
        run: () => window.location.reload(),
      },
    )
    return
  }
  showNotification(
    `Something went wrong${message ? `: ${message}` : ''}. Your song is autosaved; reload the page if the editor misbehaves.`,
    'error',
  )
}

/** Routes Vue's and the window's uncaught errors to `reportUnexpectedError`. */
export function installGlobalErrorHandlers(app: App): void {
  app.config.errorHandler = (error) => reportUnexpectedError(error)
  window.addEventListener('error', (event) => {
    // Errors from other origins (extensions) arrive without details; they aren't ours.
    if (event.filename && !event.filename.startsWith(window.location.origin)) return
    reportUnexpectedError(event.error ?? event.message)
  })
  window.addEventListener('unhandledrejection', (event) => reportUnexpectedError(event.reason))
}

/** For tests: lets the next error show a banner again. */
export function resetErrorBannerThrottle(): void {
  lastBannerAt = -Infinity
}
