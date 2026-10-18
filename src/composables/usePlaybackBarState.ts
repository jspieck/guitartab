import { shallowReactive, toRaw } from 'vue'

export interface PlaybackBarState {
  registered: boolean
  visible: boolean
  x: number
  y: number
  transitionDuration: number
  transitionTimingFunction: string
}

const playbackBarState = shallowReactive<PlaybackBarState>({
  registered: false,
  visible: false,
  x: 0,
  y: 0,
  transitionDuration: 0,
  transitionTimingFunction: 'linear',
})

// The bar moves on every beat. Its transform is written straight to the element so that
// GuitarTabView doesn't re-render each time; only `visible` and `y` (the row, which sets
// the bar's height) are reactive.
let barElement: SVGGElement | null = null

function applyPosition(): void {
  if (barElement == null || typeof barElement.setAttribute !== 'function') return
  const { x, y, transitionDuration, transitionTimingFunction } = toRaw(playbackBarState)
  barElement.setAttribute('transform', `translate(${x}, ${y})`)
  barElement.style.transition = `transform ${transitionDuration}s ${transitionTimingFunction}`
}

export function registerPlaybackBarElement(element: SVGGElement | null): void {
  barElement = element
  playbackBarState.registered = element !== null

  if (element === null) {
    resetPlaybackBarState()
  } else {
    applyPosition()
  }
}

export function hasRegisteredPlaybackBar(): boolean {
  return playbackBarState.registered
}

export function isPlaybackBarVisible(): boolean {
  return playbackBarState.visible
}

export function setPlaybackBarPosition(x: number, y: number, transitionDuration: number): void {
  const raw = toRaw(playbackBarState)
  raw.x = x
  raw.transitionDuration = transitionDuration
  raw.transitionTimingFunction = 'linear'
  // Reactive, but only triggers when the bar moves to another row.
  playbackBarState.y = y
  applyPosition()
}

export function showPlaybackBar(): void {
  playbackBarState.visible = true
}

export function hidePlaybackBar(): void {
  playbackBarState.visible = false
}

export function resetPlaybackBarState(): void {
  playbackBarState.registered = false
  playbackBarState.visible = false
  playbackBarState.x = 0
  playbackBarState.y = 0
  playbackBarState.transitionDuration = 0
  playbackBarState.transitionTimingFunction = 'linear'
  applyPosition()
}

export function usePlaybackBarState() {
  return {
    playbackBarState,
  }
}
