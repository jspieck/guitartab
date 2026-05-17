import { shallowReactive } from 'vue'

interface SelectionSurfaceState {
  registered: boolean
}

const selectionSurfaceState = shallowReactive<SelectionSurfaceState>({
  registered: false,
})

export function registerSelectionSurface(isRegistered: boolean): void {
  selectionSurfaceState.registered = isRegistered
}

export function hasRegisteredSelectionSurface(): boolean {
  return selectionSurfaceState.registered
}

export function resetSelectionSurfaceState(): void {
  selectionSurfaceState.registered = false
}

export function useSelectionSurfaceState() {
  return {
    selectionSurfaceState,
  }
}