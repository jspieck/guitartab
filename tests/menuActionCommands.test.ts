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

vi.mock('../src/services/editor/durationCommands', () => ({
  changeNoteDuration: (_host: unknown, ...args: unknown[]) => changeNoteDuration(...args),
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
    expect(changeNoteDuration).toHaveBeenCalledWith(0, 1, 0, 2, 3, 'q')
    expect(noteInputState.noteLength).toBe('q')
  })
})
