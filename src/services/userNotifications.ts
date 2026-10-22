import { showNotification, type NotificationKind } from '../stores/notificationState'

export type UserMessageKind = NotificationKind

export interface UserMessage {
  text: string
  kind: UserMessageKind
}

/** Present a short, user-visible banner (not console-only). */
export function showUserMessage(text: string, kind: UserMessageKind = 'info'): void {
  showNotification(text, kind)
}

export function showUserError(text: string): void {
  showUserMessage(text, 'error')
}
