import { describe, expect, it } from 'vitest'
import { formatCursorPosition } from '../src/utils/positionLabel'

describe('formatCursorPosition', () => {
  it('counts from 1 with string 1 the highest string', () => {
    expect(formatCursorPosition({ blockId: 2, beatId: 1, string: 5 }, 6)).toBe('Bar 3 · Beat 2 · String 1')
    expect(formatCursorPosition({ blockId: 0, beatId: 0, string: 0 }, 6, 3)).toBe(
      'Bar 1 · Beat 1 · String 6 · fret 3',
    )
  })

  it('leaves out the fret on an empty string', () => {
    expect(formatCursorPosition({ blockId: 0, beatId: 0, string: 0 }, 4, null)).toBe(
      'Bar 1 · Beat 1 · String 4',
    )
  })
})
