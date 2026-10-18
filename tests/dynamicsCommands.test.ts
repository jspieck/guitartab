import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processDynamicSelect } from '../src/services/editor/dynamicsCommands'

const addDynamic = vi.fn()
const deactivateEffects = vi.fn()
const setEffectVariable = vi.fn()
const requestOverBarRender = vi.fn()

vi.mock('../src/assets/js/songData', async () => {
  const { createSongMock } = await import('./helpers/songMock')
  return { default: createSongMock({
    measures: [
      [
        [
          [{
            dynamicPresent: false,
            dynamic: '',
            notes: [{}, {}],
          }],
        ],
      ],
    ],
  }) }
})

vi.mock('../src/assets/js/revertHandler', () => ({
  revertHandler: {
    addDynamic: (...args: unknown[]) => addDynamic(...args),
  },
}))

vi.mock('../src/services/menuMutationRouting', () => ({
  findMenuEffectGroup: () => ({ id: 'dynamic' }),
  getDynamicValue: () => 'p',
}))

vi.mock('../src/assets/js/menuHandler', () => ({
  menuHandler: {
    deactivateEffects: (...args: unknown[]) => deactivateEffects(...args),
    setEffectVariable: (...args: unknown[]) => setEffectVariable(...args),
  },
}))

vi.mock('../src/services/editor/renderCommands', () => ({
  requestOverBarRender: (...args: unknown[]) => requestOverBarRender(...args),
}))

describe('dynamicsCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies a dynamic marking to selected beats', () => {
    processDynamicSelect({
      notes: [{
        trackId: 0,
        blockId: 0,
        voiceId: 0,
        beatId: 0,
        string: 0,
      }],
      blocks: [0],
    }, 'pDynamic', false)

    expect(setEffectVariable).toHaveBeenCalled()
    expect(requestOverBarRender).toHaveBeenCalledWith(0, 0, 0)
  })
})
