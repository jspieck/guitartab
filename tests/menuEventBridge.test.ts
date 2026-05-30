import { afterEach, describe, expect, it, vi } from 'vitest'
import EventBus from '../src/assets/js/eventBus'
import { ensureLegacyMenuEventBridge } from '../src/services/menuEventBridge'
import { typedEventBus } from '../src/utils/typedEventBus'

afterEach(() => {
  typedEventBus.clearAll()
})

describe('ensureLegacyMenuEventBridge', () => {
  it('relays legacy clickedOnPos events to the typed menu bus', () => {
    ensureLegacyMenuEventBridge()

    const handler = vi.fn()
    typedEventBus.on('menu.clickedOnPos', handler)

    EventBus.emit('menu.clickedOnPos', {
      trackId: 1,
      blockId: 2,
      voiceId: 0,
      beatId: 3,
      string: 4,
    })

    expect(handler).toHaveBeenCalledWith({
      trackId: 1,
      blockId: 2,
      voiceId: 0,
      beatId: 3,
      string: 4,
    })
  })

  it('relays legacy block activation events to the typed menu bus', () => {
    ensureLegacyMenuEventBridge()

    const handler = vi.fn()
    typedEventBus.on('menu.activateEffectsForBlock', handler)

    EventBus.emit('menu.activateEffectsForBlock')

    expect(handler).toHaveBeenCalledOnce()
  })
})