const rowSurfaces = new Map<number, HTMLElement>()

export function registerClassicalRowSurface(rowId: number, element: unknown): void {
  if (!(element instanceof HTMLElement)) {
    rowSurfaces.delete(rowId)
    return
  }

  rowSurfaces.set(rowId, element)
}

export function getClassicalRowSurface(rowId: number): HTMLElement | null {
  return rowSurfaces.get(rowId) ?? null
}

export function clearClassicalRowSurfaces(): void {
  rowSurfaces.clear()
}
