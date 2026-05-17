import { shallowReactive } from 'vue'

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

export function registerPlaybackBarElement(element: SVGGElement | null): void {
  playbackBarState.registered = element !== null

  if (element === null) {
    resetPlaybackBarState()
  }
}

export function hasRegisteredPlaybackBar(): boolean {
  return playbackBarState.registered
}

export function isPlaybackBarVisible(): boolean {
  return playbackBarState.visible
}

export function setPlaybackBarPosition(x: number, y: number, transitionDuration: number): void {
  playbackBarState.x = x
  playbackBarState.y = y
  playbackBarState.transitionDuration = transitionDuration
  playbackBarState.transitionTimingFunction = 'linear'
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
}

export function usePlaybackBarState() {
  return {
    playbackBarState,
  }
}