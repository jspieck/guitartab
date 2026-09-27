export type UserMessageKind = 'info' | 'error'

export interface UserMessage {
  text: string
  kind: UserMessageKind
}

/** Present a short, user-visible banner (not console-only). */
export function showUserMessage(text: string, kind: UserMessageKind = 'info'): void {
  // Lazy import avoids circular deps with AppManager ↔ audio/GP loaders.
  void import('../assets/js/appManager').then(({ default: AppManager }) => {
    AppManager.showNotification(text, kind)
  })
}

export function showUserError(text: string): void {
  showUserMessage(text, 'error')
}
