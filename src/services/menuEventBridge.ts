import EventBus from '../assets/js/eventBus'
import type { Measure, Note } from '../types/tab'
import { typedEventBus, type TabPosition } from '../utils/typedEventBus'

let isMenuEventBridgeRegistered = false

const relayActivateEffectsForMarkedBeat = () => {
  typedEventBus.emit('menu.activateEffectsForMarkedBeat')
}

const relayActivateEffectsForMarkedPos = () => {
  typedEventBus.emit('menu.activateEffectsForMarkedPos')
}

const relayActivateEffectsForBeat = (beat: unknown) => {
  typedEventBus.emit('menu.activateEffectsForBeat', beat as Measure)
}

const relayDisableNoteEffectButtons = () => {
  typedEventBus.emit('menu.disableNoteEffectButtons')
}

const relayActivateEffectsForBlock = () => {
  typedEventBus.emit('menu.activateEffectsForBlock')
}

const relayActivateEffectsForPos = (position: unknown) => {
  typedEventBus.emit('menu.activateEffectsForPos', position as TabPosition)
}

const relayActivateEffectsForNote = (note: unknown) => {
  typedEventBus.emit('menu.activateEffectsForNote', note as Note)
}

const relayClickedOnPos = (position: unknown) => {
  typedEventBus.emit('menu.clickedOnPos', position as TabPosition)
}

export function ensureMenuEventBridge(): void {
  if (isMenuEventBridgeRegistered) {
    return
  }

  isMenuEventBridgeRegistered = true

  EventBus.on('menu.activateEffectsForMarkedBeat', relayActivateEffectsForMarkedBeat)
  EventBus.on('menu.activateEffectsForMarkedPos', relayActivateEffectsForMarkedPos)
  EventBus.on('menu.activateEffectsForBeat', relayActivateEffectsForBeat)
  EventBus.on('menu.disableNoteEffectButtons', relayDisableNoteEffectButtons)
  EventBus.on('menu.activateEffectsForBlock', relayActivateEffectsForBlock)
  EventBus.on('menu.activateEffectsForPos', relayActivateEffectsForPos)
  EventBus.on('menu.activateEffectsForNote', relayActivateEffectsForNote)
  EventBus.on('menu.clickedOnPos', relayClickedOnPos)
}