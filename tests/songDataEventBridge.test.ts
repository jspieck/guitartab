import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifySongDataChanged } from '../src/services/appEvents'
import { typedEventBus } from '../src/utils/typedEventBus'

afterEach(() => {
  typedEventBus.clearAll()
})

describe('song-data typed bus', () => {
  it('delivers song-data-changed without a legacy relay', () => {
    const handler = vi.fn()
    typedEventBus.on('song-data-changed', handler)

    notifySongDataChanged()

    expect(handler).toHaveBeenCalledOnce()
  })
})
