import { afterEach, describe, expect, it, vi } from 'vitest'
import { typedEventBus } from '../src/utils/typedEventBus'

afterEach(() => {
  typedEventBus.clearAll()
})

describe('typedEventBus menu events', () => {
  it('delivers clickedOnPos to menu listeners', () => {
    const handler = vi.fn()
    typedEventBus.on('menu.clickedOnPos', handler)

    typedEventBus.emit('menu.clickedOnPos', {
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

  it('delivers activateEffectsForBlock to menu listeners', () => {
    const handler = vi.fn()
    typedEventBus.on('menu.activateEffectsForBlock', handler)

    typedEventBus.emit('menu.activateEffectsForBlock')

    expect(handler).toHaveBeenCalledOnce()
  })
})
