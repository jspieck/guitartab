import EventBus from '../assets/js/eventBus'
import { typedEventBus } from '../utils/typedEventBus'

let isLegacySongDataBridgeRegistered = false

const relaySongDataChanged = () => {
  typedEventBus.emit('song-data-changed')
}

export function ensureLegacySongDataEventBridge(): void {
  if (isLegacySongDataBridgeRegistered) {
    return
  }

  isLegacySongDataBridgeRegistered = true
  EventBus.on('song-data-changed', relaySongDataChanged)
}