import { reactive } from 'vue'

/**
 * The dialog windows as state: which are open, in which order (the last one opened or
 * clicked is in front), and which have been mounted. `BaseModal` renders from it, the
 * footer lists the open windows, `ModalsContainer` mounts a dialog the first time it opens.
 */
export interface DialogWindow {
  id: string
  name: string
  /** Higher = further in front. */
  order: number
}

export const dialogState = reactive({
  windows: [] as DialogWindow[],
  /** Dialogs opened at least once; they stay mounted (and keep their size) afterwards. */
  mounted: [] as string[],
})

let nextOrder = 1

/** The dialog's root element while it is mounted (for focus handling, not for rendering). */
const elements = new Map<string, HTMLElement>()

export function registerDialogElement(id: string, element: HTMLElement | null): void {
  if (element == null) elements.delete(id)
  else elements.set(id, element)
}

export function dialogElement(id: string | null): HTMLElement | null {
  return id == null ? null : (elements.get(id) ?? null)
}

export function showDialog(id: string, name: string): void {
  if (!dialogState.mounted.includes(id)) dialogState.mounted.push(id)
  const open = dialogState.windows.find((window) => window.id === id)
  if (open != null) {
    open.order = nextOrder++
    return
  }
  dialogState.windows.push({ id, name, order: nextOrder++ })
}

export function hideDialog(id: string): void {
  const index = dialogState.windows.findIndex((window) => window.id === id)
  if (index >= 0) dialogState.windows.splice(index, 1)
}

export function hideAllDialogs(): void {
  dialogState.windows.splice(0)
}

export function bringDialogToFront(id: string): void {
  const open = dialogState.windows.find((window) => window.id === id)
  if (open != null && open.order !== nextOrder - 1) open.order = nextOrder++
}

export function isDialogOpen(id: string): boolean {
  return dialogState.windows.some((window) => window.id === id)
}

export function anyDialogOpen(): boolean {
  return dialogState.windows.length > 0
}

export function frontDialogId(): string | null {
  let front: DialogWindow | null = null
  for (const window of dialogState.windows) if (front == null || window.order > front.order) front = window
  return front?.id ?? null
}

/** Stacking above the page, in the order the windows were last brought to front. */
export function dialogZIndex(id: string): number {
  const own = dialogState.windows.find((window) => window.id === id)
  if (own == null) return 200
  return 200 + dialogState.windows.filter((window) => window.order < own.order).length
}
