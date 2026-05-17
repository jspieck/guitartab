import { afterEach, describe, expect, it, vi } from 'vitest'
import { typedEventBus } from '../src/utils/typedEventBus'

afterEach(() => {
  typedEventBus.clearAll()
})

describe('typedEventBus.onAll', () => {
  it('forwards typed payload events to wildcard handlers', () => {
    const handler = vi.fn()
    const payload = {
      trackId: 1,
      voiceId: 0,
      blockId: 3,
      beatIndex: 2,
      stringIndex: 4,
    }

    typedEventBus.onAll(handler)
    typedEventBus.emit('selection.changed', payload)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('selection.changed', payload)
  })

  it('forwards void events as undefined payloads', () => {
    const handler = vi.fn()

    typedEventBus.onAll(handler)
    typedEventBus.emit('render.all')

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('render.all', undefined)
  })
})