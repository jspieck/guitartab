import { beforeEach, describe, expect, it } from 'vitest'
import {
  CLASSICAL_STAFF_LINES_HEIGHT,
  clearClassicalLayoutMetrics,
  classicalNotationLayoutState,
  computeClassicalAreaGeometry,
  getClassicalBeatWidth,
  getClassicalRowGeometry,
  getRowStaffExtents,
  publishClassicalBeatWidth,
  publishClassicalLayoutMetrics,
  setClassicalBeatWidth,
} from '../src/stores/classicalNotationLayoutState'

describe('classicalNotationLayoutState', () => {
  beforeEach(() => {
    clearClassicalLayoutMetrics()
  })

  it('returns zero when no classical layout metrics are published', () => {
    expect(getClassicalBeatWidth(4)).toBe(0)
    expect(getRowStaffExtents(0, 4)).toEqual({ above: 0, below: 0 })
  })

  it('publishes and reads layout metrics', () => {
    publishClassicalLayoutMetrics({
      beatWidthByBlock: { 4: 55 },
      staffExtentsByBlock: { 4: { above: 12, below: 30 } },
    })

    expect(getClassicalBeatWidth(4)).toBe(55)
    expect(getRowStaffExtents(4, 5)).toEqual({ above: 12, below: 30 })
  })

  it('bumps the layout version only when metrics actually change', () => {
    const metrics = { beatWidthByBlock: { 1: 10 }, staffExtentsByBlock: { 1: { above: 5, below: 5 } } }
    expect(publishClassicalLayoutMetrics(metrics)).toBe(true)
    const versionAfterFirst = classicalNotationLayoutState.version

    // Re-publishing identical metrics (e.g. after a redraw) must not re-trigger layout.
    expect(publishClassicalLayoutMetrics(metrics)).toBe(false)
    expect(classicalNotationLayoutState.version).toBe(versionAfterFirst)

    expect(publishClassicalLayoutMetrics({ staffExtentsByBlock: { 1: { above: 6, below: 5 } } })).toBe(true)
    expect(classicalNotationLayoutState.version).toBe(versionAfterFirst + 1)
  })

  it('replaces beat widths so deleted blocks do not keep stale widths', () => {
    publishClassicalLayoutMetrics({ beatWidthByBlock: { 0: 20, 1: 30 } })
    publishClassicalLayoutMetrics({ beatWidthByBlock: { 0: 20 } })

    expect(getClassicalBeatWidth(1)).toBe(0)
  })

  it('updates beat width without bumping layout version', () => {
    publishClassicalLayoutMetrics({
      beatWidthByBlock: { 1: 10 },
    })
    const versionAfterPublish = classicalNotationLayoutState.version

    setClassicalBeatWidth(2, 20)

    expect(getClassicalBeatWidth(2)).toBe(20)
    expect(classicalNotationLayoutState.version).toBe(versionAfterPublish)
  })

  it('clears published metrics', () => {
    publishClassicalBeatWidth(3, 30)
    clearClassicalLayoutMetrics()

    expect(getClassicalBeatWidth(3)).toBe(0)
  })

  it('sizes each row staff area from the blocks of that row only', () => {
    publishClassicalLayoutMetrics({
      staffExtentsByBlock: { 0: { above: 0, below: 0 }, 1: { above: 0, below: 0 }, 2: { above: 0, below: 90 } },
    })

    expect(getClassicalRowGeometry(0, 2).height).toBeLessThan(getClassicalRowGeometry(2, 3).height)
    expect(getClassicalRowGeometry(0, 3).height).toBe(getClassicalRowGeometry(2, 3).height)
  })

  it('sizes the classical area from the note extents with a clef-sized minimum', () => {
    const plain = computeClassicalAreaGeometry({ above: 0, below: 0 })
    expect(plain.staffTop).toBeGreaterThan(0)
    expect(plain.height).toBe(plain.staffTop * 2 + CLASSICAL_STAFF_LINES_HEIGHT)

    const lowNotes = computeClassicalAreaGeometry({ above: 0, below: 90 })
    expect(lowNotes.staffTop).toBe(plain.staffTop)
    expect(lowNotes.height - lowNotes.staffTop - CLASSICAL_STAFF_LINES_HEIGHT).toBeGreaterThanOrEqual(90)

    const highNotes = computeClassicalAreaGeometry({ above: 70, below: 0 })
    expect(highNotes.staffTop).toBeGreaterThanOrEqual(70)
  })
})
