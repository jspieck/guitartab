import { describe, expect, it } from 'vitest'
import { RevertStack } from '../src/services/editor/revertStack'

describe('RevertStack', () => {
  it('supports undo and redo', () => {
    const stack = new RevertStack(5)

    stack.push('NotePlacement', { trackId: 0 })
    stack.push('NoteLength', { trackId: 0 })

    expect(stack.peek()?.type).toBe('NoteLength')
    expect(stack.stepBack()?.type).toBe('NoteLength')
    expect(stack.peek()?.type).toBe('NotePlacement')
    expect(stack.stepForward()?.type).toBe('NoteLength')
  })

  it('drops future entries when pushing after undo', () => {
    const stack = new RevertStack(5)

    stack.push('A', {})
    stack.push('B', {})
    stack.stepBack()
    stack.push('C', {})

    expect(stack.size).toBe(2)
    expect(stack.peek()?.type).toBe('C')
    expect(stack.canRedo).toBe(false)
  })

  it('trims to max size', () => {
    const stack = new RevertStack(2)

    stack.push('A', {})
    stack.push('B', {})
    stack.push('C', {})

    expect(stack.size).toBe(2)
    expect(stack.peek()?.type).toBe('C')
  })
})
