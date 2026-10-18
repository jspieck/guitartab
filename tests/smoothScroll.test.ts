import { describe, expect, it } from 'vitest'
import { revealScrollTop } from '../src/utils/smoothScroll'

describe('page-turn scrolling', () => {
  const view = { scrollTop: 1000, height: 600 } // shows 1000–1600

  it('leaves the view alone while the row is fully visible', () => {
    expect(revealScrollTop({ top: 1000, bottom: 1200 }, view.scrollTop, view.height)).toBeNull()
    expect(revealScrollTop({ top: 1350, bottom: 1580 }, view.scrollTop, view.height)).toBeNull()
  })

  it('turns the page when the row runs past the bottom', () => {
    // The row would be cut off: it goes to the top, 16 px of air above it.
    expect(revealScrollTop({ top: 1400, bottom: 1650 }, view.scrollTop, view.height)).toBe(1384)
  })

  it('scrolls back up to a row above the view (a loop or a jump back)', () => {
    expect(revealScrollTop({ top: 200, bottom: 450 }, view.scrollTop, view.height)).toBe(184)
    expect(revealScrollTop({ top: 990, bottom: 1200 }, view.scrollTop, view.height)).toBe(974)
  })

  it('never asks for a negative position', () => {
    expect(revealScrollTop({ top: 5, bottom: 200 }, 300, 600)).toBe(0)
  })
})
