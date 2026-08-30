import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearClassicalLayoutMetrics,
  classicalNotationLayoutState,
  getClassicalBeatWidth,
  getClassicalRowMarginTop,
  getClassicalStaveBeginY,
  publishClassicalBeatWidth,
  publishClassicalLayoutMetrics,
  setClassicalBeatWidth,
} from '../src/stores/classicalNotationLayoutState'

describe('classicalNotationLayoutState', () => {
  beforeEach(() => {
    clearClassicalLayoutMetrics()
  })

  it('returns zero when no classical layout metrics are published', () => {
    expect(getClassicalStaveBeginY(2)).toBe(0)
    expect(getClassicalRowMarginTop(1)).toBe(0)
    expect(getClassicalBeatWidth(4)).toBe(0)
  })

  it('publishes and reads layout metrics', () => {
    publishClassicalLayoutMetrics({
      staveBeginByBlock: { 2: 42 },
      marginTopByRow: { 1: 18 },
      beatWidthByBlock: { 4: 55 },
    })

    expect(getClassicalStaveBeginY(2)).toBe(42)
    expect(getClassicalRowMarginTop(1)).toBe(18)
    expect(getClassicalBeatWidth(4)).toBe(55)
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
})
