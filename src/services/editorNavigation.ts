import AppManager from '../assets/js/appManager'
import playBackLogic from '../assets/js/playBackLogicNew'
import { typedEventBus, type TabPosition } from '../utils/typedEventBus'
import { setLoadingWheelVisible } from '../utils/editorUi'

export interface EditorNavigationTarget {
  trackId: number
  voiceId: number
  blockId: number
  beatId?: number
  string?: number
}

export type CompleteTrackChange = () => void

function resolvePosition(target: EditorNavigationTarget): TabPosition {
  return {
    trackId: target.trackId,
    voiceId: target.voiceId,
    blockId: target.blockId,
    beatId: target.beatId ?? 0,
    string: target.string ?? 1,
  }
}

export function focusEditorPosition(
  target: EditorNavigationTarget,
  options: { updatePlaybackPosition?: boolean } = {},
): TabPosition {
  const position = resolvePosition(target)

  typedEventBus.emit('navigation.scrollToBlock', {
    trackId: position.trackId,
    voiceId: position.voiceId,
    blockId: position.blockId,
  })
  typedEventBus.emit('navigation.setClickedPos', position)

  if (options.updatePlaybackPosition ?? true) {
    playBackLogic.jumpToPosition(position.blockId, 0, position.beatId)
  }

  return position
}

export function changeTrackWithLoading(
  trackId: number,
  voiceId: number,
  callback: (complete: CompleteTrackChange) => void,
  options: { onBeforeChange?: () => void } = {},
): void {
  setLoadingWheelVisible(true)

  window.setTimeout(() => {
    try {
      options.onBeforeChange?.()
      AppManager.changeTrack(trackId, voiceId, false, () => {
        callback(() => {
          setLoadingWheelVisible(false)
        })
      })
    } catch (error) {
      setLoadingWheelVisible(false)
      throw error
    }
  }, 0)
}