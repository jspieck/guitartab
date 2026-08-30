import { afterEach, describe, expect, it, vi } from 'vitest'
import EventBus from '../src/assets/js/eventBus'
import { notifySongDataChanged } from '../src/services/appEvents'
import { ensureSongDataEventBridge } from '../src/services/songDataEventBridge'
import { typedEventBus } from '../src/utils/typedEventBus'

afterEach(() => {
  typedEventBus.clearAll()
})

describe('notifySongDataChanged', () => {
  it('notifies typed and legacy listeners once', () => {
    ensureSongDataEventBridge()

    const typedHandler = vi.fn()
    const legacyHandler = vi.fn()
    typedEventBus.on('song-data-changed', typedHandler)
    EventBus.on('song-data-changed', legacyHandler)

    notifySongDataChanged()

    expect(typedHandler).toHaveBeenCalledOnce()
    expect(legacyHandler).toHaveBeenCalledOnce()
  })
})
