import { selectionState } from '../../stores/selectionState'
import playback from '../playback'
import { hasRegisteredSelectionSurface } from '../../stores/selectionSurfaceState'
import { typedEventBus } from '../../utils/typedEventBus'
import { disablePageMode } from './pageModeController'
import { scrollToSvgBlock } from './navigationController'

let isRenderEventBridgeRegistered = false

export function ensureRenderEventBridge(): void {
  if (isRenderEventBridgeRegistered) {
    return
  }

  isRenderEventBridgeRegistered = true

  typedEventBus.on('navigation.setClickedPos', (pos) => {
    if (!pos || hasRegisteredSelectionSurface()) {
      return
    }

    selectionState.cursor = {
      trackId: pos.trackId,
      blockId: pos.blockId,
      voiceId: pos.voiceId,
      beatId: pos.beatId,
      string: pos.string,
    }
    playback.setPlayPosition(pos.trackId, pos.blockId, pos.voiceId, pos.beatId)
  })

  typedEventBus.on('navigation.scrollToBlock', (data) => {
    if (data) {
      scrollToSvgBlock(data.trackId, data.voiceId, data.blockId)
    }
  })

  typedEventBus.on('ui.disablePageMode', () => {
    disablePageMode()
  })

  typedEventBus.on('navigation.moveMarker', () => {
    // DOM playback markers are replaced by Vue selection/playback surfaces.
  })
}
