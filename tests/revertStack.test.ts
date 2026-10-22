import { describe, expect, it } from 'vitest'
import { RevertStack } from '../src/services/editor/revertStack'

describe('RevertStack', () => {
  it('supports undo and redo', () => {
    const stack = new RevertStack<string>(5)

    stack.push('A')
    stack.push('B')

    expect(stack.peek()).toBe('B')
    expect(stack.stepBack()).toBe('B')
    expect(stack.peek()).toBe('A')
    expect(stack.stepForward()).toBe('B')
  })

  it('drops future entries when pushing after undo', () => {
    const stack = new RevertStack<string>(5)

    stack.push('A')
    stack.push('B')
    stack.stepBack()
    stack.push('C')

    expect(stack.size).toBe(2)
    expect(stack.peek()).toBe('C')
    expect(stack.canRedo).toBe(false)
  })

  it('trims to max size', () => {
    const stack = new RevertStack<string>(2)

    stack.push('A')
    stack.push('B')
    stack.push('C')

    expect(stack.size).toBe(2)
    expect(stack.peek()).toBe('C')
  })

  it('removeWhere keeps the undo position on the same entry', () => {
    const stack = new RevertStack<string>(5)
    for (const entry of ['A', 'x', 'B', 'x', 'C']) stack.push(entry)
    stack.stepBack() // undoes C
    stack.stepBack() // undoes the second x; the next undo is B

    stack.removeWhere((entry) => entry === 'x')

    expect(stack.size).toBe(3)
    expect(stack.peek()).toBe('B')
    expect(stack.stepForward()).toBe('C')
  })
})
