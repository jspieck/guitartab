import { reactive } from 'vue'

export type NotificationKind = 'info' | 'error'

export interface NotificationAction {
  label: string
  run: () => void
}

export interface NotificationState {
  text: string
  kind: NotificationKind
  action: NotificationAction | null
  visible: boolean
  /** Bumped per message so the banner can restart its fade-in. */
  id: number
}

/** The banner at the top right (App.vue renders it). */
export const notificationState = reactive<NotificationState>({
  text: '',
  kind: 'info',
  action: null,
  visible: false,
  id: 0,
})

let hideTimer: ReturnType<typeof setTimeout> | null = null

/** Shows a banner message; `action` adds a button (e.g. "Undo") that runs once and closes it. */
export function showNotification(
  text: string,
  kind: NotificationKind = 'info',
  action?: NotificationAction,
): void {
  if (hideTimer != null) clearTimeout(hideTimer)
  notificationState.text = text
  notificationState.kind = kind
  notificationState.action = action ?? null
  notificationState.visible = true
  notificationState.id += 1
  // Errors and messages with a button stay longer, so there is time to read and react.
  hideTimer = setTimeout(hideNotification, kind === 'error' || action != null ? 8000 : 5000)
}

export function hideNotification(): void {
  if (hideTimer != null) clearTimeout(hideTimer)
  hideTimer = null
  notificationState.visible = false
}

/** Runs the banner's button action once and closes the banner. */
export function runNotificationAction(): void {
  const action = notificationState.action
  notificationState.action = null
  hideNotification()
  action?.run()
}
