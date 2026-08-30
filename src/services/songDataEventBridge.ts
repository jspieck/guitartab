import EventBus from '../assets/js/eventBus'
import { typedEventBus } from '../utils/typedEventBus'

let isSongDataBridgeRegistered = false
let isRelayingSongDataChanged = false

const relayEventBusToTyped = () => {
  if (isRelayingSongDataChanged) {
    return
  }
  isRelayingSongDataChanged = true
  typedEventBus.emit('song-data-changed')
  isRelayingSongDataChanged = false
}

const relayTypedToEventBus = () => {
  if (isRelayingSongDataChanged) {
    return
  }
  isRelayingSongDataChanged = true
  EventBus.emit('song-data-changed')
  isRelayingSongDataChanged = false
}

export function ensureSongDataEventBridge(): void {
  if (isSongDataBridgeRegistered) {
    return
  }

  isSongDataBridgeRegistered = true
  EventBus.on('song-data-changed', relayEventBusToTyped)
  typedEventBus.on('song-data-changed', relayTypedToEventBus)
}
