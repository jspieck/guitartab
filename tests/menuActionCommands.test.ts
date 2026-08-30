import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyNoteLengthSelection } from '../src/services/menuActionCommands'

const changeNoteDuration = vi.fn()
const markedNoteObj = {
  trackId: 0,
  blockId: 1,
  voiceId: 0,
  beatId: 2,
  string: 3,
}

vi.mock('../src/assets/js/appManager', () => ({
  default: {
    duringTrackCreation: false,
    typeOfNote: 'e',
  },
}))

vi.mock('../src/assets/js/tab', () => ({
  tab: {
    get markedNoteObj() {
      return markedNoteObj
    },
    changeNoteDuration: (...args: unknown[]) => changeNoteDuration(...args),
  },
}))

vi.mock('../src/assets/js/eventBus', () => ({
  default: {
    emit: vi.fn(),
  },
}))

describe('menuActionCommands', () => {
  beforeEach(() => {
    changeNoteDuration.mockReset()
    changeNoteDuration.mockReturnValue(true)
  })

  it('applies a note-length change and requests menu resync', async () => {
    const EventBus = (await import('../src/assets/js/eventBus')).default
    const AppManager = (await import('../src/assets/js/appManager')).default

    const applied = applyNoteLengthSelection('q')

    expect(applied).toBe(true)
    expect(changeNoteDuration).toHaveBeenCalledWith(0, 1, 0, 2, 3, 'q', false)
    expect(AppManager.typeOfNote).toBe('q')
    expect(EventBus.emit).toHaveBeenCalledWith('menu.activateEffectsForMarkedPos')
  })

  it('returns false when no marked note is available', async () => {
    const original = { ...markedNoteObj }
    Object.assign(markedNoteObj, {
      trackId: -1,
      blockId: -1,
      voiceId: -1,
      beatId: -1,
      string: -1,
    })

    const AppManager = (await import('../src/assets/js/appManager')).default
    AppManager.duringTrackCreation = true

    expect(applyNoteLengthSelection('e')).toBe(false)

    AppManager.duringTrackCreation = false
    Object.assign(markedNoteObj, original)
  })
})
