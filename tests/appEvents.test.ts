import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifySongDataChanged } from '../src/services/appEvents'
import { typedEventBus } from '../src/utils/typedEventBus'

afterEach(() => {
  typedEventBus.clearAll()
})

describe('notifySongDataChanged', () => {
  it('notifies typed song-data listeners once', () => {
    const handler = vi.fn()
    typedEventBus.on('song-data-changed', handler)

    notifySongDataChanged()

    expect(handler).toHaveBeenCalledOnce()
  })
})
