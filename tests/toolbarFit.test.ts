import { describe, expect, it } from 'vitest'
import { fitToolbarGroups, type FoldableGroup } from '../src/utils/toolbarFit'

const groups: FoldableGroup[] = [
  { id: 'file', width: 200, foldedWidth: 60 },
  { id: 'transport', width: 300 },
  { id: 'countIn', width: 60, menu: 'practice' },
  { id: 'trainer', width: 40, menu: 'practice' },
  { id: 'view', width: 250, menu: 'more' },
]
const order = ['file', 'view', 'countIn', 'trainer']
const menus = { practice: 32, more: 32 }

describe('fitToolbarGroups', () => {
  it('folds nothing when everything fits', () => {
    expect([...fitToolbarGroups(groups, 850, order, menus)]).toEqual([])
  })

  it('folds in order until the bar fits, counting the folded width', () => {
    // 850 needed; folding File saves 140.
    expect([...fitToolbarGroups(groups, 710, order, menus)]).toEqual(['file'])
  })

  it('adds a shared menu button once a group folds into it', () => {
    // After File: 710. Folding View saves 250 but adds the 32 px menu button: 492.
    expect([...fitToolbarGroups(groups, 500, order, menus)]).toEqual(['file', 'view'])
    // Count-in and trainer share one practice button: 492 - 60 + 32 = 464, then - 40 = 424.
    expect([...fitToolbarGroups(groups, 470, order, menus)]).toEqual(['file', 'view', 'countIn'])
    expect([...fitToolbarGroups(groups, 430, order, menus)]).toEqual(['file', 'view', 'countIn', 'trainer'])
  })

  it('never folds groups outside the fold order, even when the bar still overflows', () => {
    const folded = fitToolbarGroups(groups, 100, order, menus)
    expect(folded.has('transport')).toBe(false)
    expect([...folded]).toEqual(order)
  })

  it('ignores ids in the fold order that are not on the bar', () => {
    expect([...fitToolbarGroups(groups, 710, ['missing', 'file'], menus)]).toEqual(['file'])
  })
})
