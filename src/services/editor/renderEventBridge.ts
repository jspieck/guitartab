import EventBus from '../../assets/js/eventBus'
import playBackLogic from '../../assets/js/playBackLogicNew'
import { tab } from '../../assets/js/tab'
import { hasRegisteredSelectionSurface } from '../../composables/useSelectionSurfaceState'
import { typedEventBus } from '../../utils/typedEventBus'
import { ensureSongDataEventBridge } from '../songDataEventBridge'
import { disablePageMode } from './pageModeController'
import { scrollToSvgBlock } from './navigationController'

let isRenderEventBridgeRegistered = false

export function ensureRenderEventBridge(): void {
  if (isRenderEventBridgeRegistered) {
    return
  }

  isRenderEventBridgeRegistered = true
  ensureSongDataEventBridge()

  typedEventBus.on('navigation.setClickedPos', (pos) => {
    if (!pos || hasRegisteredSelectionSurface()) {
      return
    }

    tab.markedNoteObj = {
      trackId: pos.trackId,
      blockId: pos.blockId,
      voiceId: pos.voiceId,
      beatId: pos.beatId,
      string: pos.string,
    }
    playBackLogic.setPlayPosition(pos.trackId, pos.blockId, pos.voiceId, pos.beatId)
    EventBus.emit('menu.clickedOnPos', pos)
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
