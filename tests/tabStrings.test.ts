import { describe, expect, it } from 'vitest'
import { stringLine } from '../src/utils/tabStrings'

describe('string order', () => {
  it('draws the lowest string (index 0) on the bottom line and back', () => {
    expect([0, 1, 2, 3, 4, 5].map((string) => stringLine(string, 6))).toEqual([5, 4, 3, 2, 1, 0])
    expect(stringLine(stringLine(2, 7), 7)).toBe(2)
  })
})
