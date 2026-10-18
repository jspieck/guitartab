const rowSurfaces = new Map<number, HTMLElement>()

export function registerClassicalRowSurface(rowId: number, element: unknown): void {
  if (!(element instanceof HTMLElement)) {
    rowSurfaces.delete(rowId)
    return
  }

  rowSurfaces.set(rowId, element)
}

/** Remove a surface only if it is still the one registered for the row. */
export function unregisterClassicalRowSurface(rowId: number, element: HTMLElement): void {
  if (rowSurfaces.get(rowId) === element) {
    rowSurfaces.delete(rowId)
  }
}

export function getClassicalRowSurface(rowId: number): HTMLElement | null {
  return rowSurfaces.get(rowId) ?? null
}

/** Row ids with a mounted surface (the virtualized, visible classical rows). */
export function getRegisteredClassicalRowIds(): number[] {
  return [...rowSurfaces.keys()]
}

export function clearClassicalRowSurfaces(): void {
  rowSurfaces.clear()
}
