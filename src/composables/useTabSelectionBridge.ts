import { typedEventBus, type TabPosition } from '../utils/typedEventBus'
import type { TabSelection } from './useTabSelection'

export function tabPositionToSelection(position: TabPosition): TabSelection {
  return {
    trackId: position.trackId,
    voiceId: position.voiceId,
    blockId: position.blockId,
    beatIndex: position.beatId,
    stringIndex: position.string,
  }
}

export function useTabSelectionBridge(setSelection: (selection: TabSelection | null) => void) {
  function handleNavigationSelection(position: TabPosition): void {
    setSelection(tabPositionToSelection(position))
  }

  function registerNavigationSelectionBridge(): () => void {
    typedEventBus.on('navigation.setClickedPos', handleNavigationSelection)

    return () => {
      typedEventBus.off('navigation.setClickedPos', handleNavigationSelection)
    }
  }

  return {
    handleNavigationSelection,
    registerNavigationSelectionBridge,
  }
}
