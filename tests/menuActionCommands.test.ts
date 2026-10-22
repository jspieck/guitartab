import { beforeEach, describe, expect, it, vi } from 'vitest'
import { noteInputState } from '../src/stores/noteInputState'
import { selectionState } from '../src/stores/selectionState'
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
  },
}))

vi.mock('../src/assets/js/tab', () => ({
  tab: {
    changeNoteDuration: (...args: unknown[]) => changeNoteDuration(...args),
  },
}))

vi.mock('../src/utils/typedEventBus', () => ({
  typedEventBus: {
    emit: vi.fn(),
  },
}))

describe('menuActionCommands', () => {
  beforeEach(() => {
    selectionState.cursor = { ...markedNoteObj }
    changeNoteDuration.mockReset()
    changeNoteDuration.mockReturnValue(true)
  })

  it('applies a note-length change', () => {
    const applied = applyNoteLengthSelection('q')

    expect(applied).toBe(true)
    expect(changeNoteDuration).toHaveBeenCalledWith(0, 1, 0, 2, 3, 'q', false)
    expect(noteInputState.noteLength).toBe('q')
  })

  it('does nothing while a track is being created', async () => {
    const AppManager = (await import('../src/assets/js/appManager')).default
    AppManager.duringTrackCreation = true

    expect(applyNoteLengthSelection('e')).toBe(false)

    AppManager.duringTrackCreation = false
  })
})
