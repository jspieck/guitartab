import { afterEach, describe, expect, it, vi } from 'vitest'
import EventBus from '../src/assets/js/eventBus'
import { ensureLegacySongDataEventBridge } from '../src/services/songDataEventBridge'
import { typedEventBus } from '../src/utils/typedEventBus'

afterEach(() => {
  typedEventBus.clearAll()
})

describe('ensureLegacySongDataEventBridge', () => {
  it('relays legacy song-data changes onto the typed event bus', () => {
    ensureLegacySongDataEventBridge()

    const handler = vi.fn()
    typedEventBus.on('song-data-changed', handler)

    EventBus.emit('song-data-changed')

    expect(handler).toHaveBeenCalledOnce()
  })
})