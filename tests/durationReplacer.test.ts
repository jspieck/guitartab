import { describe, it, expect } from 'vitest'
import {
  DurationReplacer,
  Beat,
  DURATION_TICKS,
} from '../src/utils/durationReplacer'

// ─── Test helpers ───────────────────────────────────────────────────────────

function makeBeat(
  duration: string,
  opts: Partial<Beat> = {},
): Beat {
  return {
    duration,
    dotted: false,
    doubleDotted: false,
    tuplet: null,
    tupletId: 0,
    hasNotes: true,
    ...opts,
  }
}

function makeRest(
  duration: string,
  opts: Partial<Beat> = {},
): Beat {
  const code = duration.endsWith('r') ? duration : duration + 'r'
  return makeBeat(code, { hasNotes: false, ...opts })
}

function makeQuarterMeasure(): Beat[] {
  // Standard 4/4 measure: 4 quarter-note rests = 64 ticks
  return [makeRest('qr'), makeRest('qr'), makeRest('qr'), makeRest('qr')]
}

// ─── Static helpers ─────────────────────────────────────────────────────────

describe('DurationReplacer: static helpers', () => {
  describe('baseDuration', () => {
    it('strips r suffix', () => {
      expect(DurationReplacer.baseDuration('qr')).toBe('q')
      expect(DurationReplacer.baseDuration('er')).toBe('e')
    })
    it('leaves non-rest unchanged', () => {
      expect(DurationReplacer.baseDuration('q')).toBe('q')
      expect(DurationReplacer.baseDuration('w')).toBe('w')
    })
  })

  describe('isRest', () => {
    it('identifies rests', () => {
      expect(DurationReplacer.isRest('qr')).toBe(true)
      expect(DurationReplacer.isRest('er')).toBe(true)
    })
    it('identifies non-rests', () => {
      expect(DurationReplacer.isRest('q')).toBe(false)
      expect(DurationReplacer.isRest('e')).toBe(false)
    })
  })

  describe('ticksOf', () => {
    it('returns correct ticks for all durations', () => {
      expect(DurationReplacer.ticksOf('w')).toBe(64)
      expect(DurationReplacer.ticksOf('h')).toBe(32)
      expect(DurationReplacer.ticksOf('q')).toBe(16)
      expect(DurationReplacer.ticksOf('e')).toBe(8)
      expect(DurationReplacer.ticksOf('s')).toBe(4)
      expect(DurationReplacer.ticksOf('t')).toBe(2)
      expect(DurationReplacer.ticksOf('z')).toBe(1)
      expect(DurationReplacer.ticksOf('o')).toBe(0.5)
    })
    it('returns same ticks for rest variants', () => {
      expect(DurationReplacer.ticksOf('qr')).toBe(16)
      expect(DurationReplacer.ticksOf('er')).toBe(8)
    })
  })

  describe('codeFromTicks', () => {
    it('converts ticks back to code', () => {
      expect(DurationReplacer.codeFromTicks(64)).toBe('w')
      expect(DurationReplacer.codeFromTicks(32)).toBe('h')
      expect(DurationReplacer.codeFromTicks(16)).toBe('q')
      expect(DurationReplacer.codeFromTicks(8)).toBe('e')
      expect(DurationReplacer.codeFromTicks(4)).toBe('s')
      expect(DurationReplacer.codeFromTicks(2)).toBe('t')
      expect(DurationReplacer.codeFromTicks(1)).toBe('z')
    })
    it('returns empty string for unknown ticks', () => {
      expect(DurationReplacer.codeFromTicks(99)).toBe('')
    })
  })

  describe('beatTicks', () => {
    it('plain duration', () => {
      expect(DurationReplacer.beatTicks(makeBeat('q'))).toBe(16)
    })
    it('dotted duration (1.5×)', () => {
      expect(DurationReplacer.beatTicks(makeBeat('q', { dotted: true }))).toBe(24)
    })
    it('double-dotted duration (1.75×)', () => {
      expect(DurationReplacer.beatTicks(makeBeat('q', { doubleDotted: true }))).toBe(28)
    })
    it('rest duration returns same ticks', () => {
      expect(DurationReplacer.beatTicks(makeRest('qr'))).toBe(16)
    })
  })

  describe('greatestPow2Fit', () => {
    it('returns largest power of 2 that fits', () => {
      expect(DurationReplacer.greatestPow2Fit(64)).toBe(64)
      expect(DurationReplacer.greatestPow2Fit(63)).toBe(32)
      expect(DurationReplacer.greatestPow2Fit(48)).toBe(32)
      expect(DurationReplacer.greatestPow2Fit(32)).toBe(32)
      expect(DurationReplacer.greatestPow2Fit(17)).toBe(16)
      expect(DurationReplacer.greatestPow2Fit(16)).toBe(16)
      expect(DurationReplacer.greatestPow2Fit(8)).toBe(8)
      expect(DurationReplacer.greatestPow2Fit(3)).toBe(2)
      expect(DurationReplacer.greatestPow2Fit(1)).toBe(1)
    })
    it('returns 0 for zero or negative', () => {
      expect(DurationReplacer.greatestPow2Fit(0)).toBe(0)
      expect(DurationReplacer.greatestPow2Fit(-5)).toBe(0)
    })
    it('caps at 64 (whole note)', () => {
      expect(DurationReplacer.greatestPow2Fit(128)).toBe(64)
    })
  })
})

// ─── decompose ──────────────────────────────────────────────────────────────

describe('DurationReplacer.decompose', () => {
  function totalTicks(notes: { ticks: number }[]): number {
    return notes.reduce((s, n) => s + n.ticks, 0)
  }

  it('decomposes a whole note (64 ticks)', () => {
    const result = DurationReplacer.decompose(64)
    expect(totalTicks(result)).toBe(64)
    expect(result).toHaveLength(1)
    expect(result[0].duration).toBe('w')
  })

  it('decomposes a quarter note (16 ticks)', () => {
    const result = DurationReplacer.decompose(16)
    expect(totalTicks(result)).toBe(16)
    expect(result).toHaveLength(1)
    expect(result[0].duration).toBe('q')
  })

  it('decomposes 8 ticks (eighth note)', () => {
    const result = DurationReplacer.decompose(8)
    expect(totalTicks(result)).toBeCloseTo(8)
    expect(result).toHaveLength(1)
    expect(result[0].duration).toBe('e')
  })

  it('decomposes 24 ticks (dotted quarter = q.)', () => {
    const result = DurationReplacer.decompose(24)
    expect(totalTicks(result)).toBeCloseTo(24)
    // Should be one dotted quarter, not q + e
    expect(result).toHaveLength(1)
    expect(result[0].duration).toBe('q')
    expect(result[0].dotted).toBe(true)
  })

  it('decomposes 28 ticks (double-dotted quarter = q..)', () => {
    const result = DurationReplacer.decompose(28)
    expect(totalTicks(result)).toBeCloseTo(28)
    expect(result).toHaveLength(1)
    expect(result[0].duration).toBe('q')
    expect(result[0].doubleDotted).toBe(true)
  })

  it('decomposes 48 ticks (dotted half = h.)', () => {
    const result = DurationReplacer.decompose(48)
    expect(totalTicks(result)).toBeCloseTo(48)
    expect(result).toHaveLength(1)
    expect(result[0].duration).toBe('h')
    expect(result[0].dotted).toBe(true)
  })

  it('decomposes 12 ticks (dotted eighth = e.)', () => {
    const result = DurationReplacer.decompose(12)
    expect(totalTicks(result)).toBeCloseTo(12)
    expect(result).toHaveLength(1)
    expect(result[0].duration).toBe('e')
    expect(result[0].dotted).toBe(true)
  })

  it('decomposes non-standard values into multiple notes', () => {
    // 40 ticks = h(32) + e(8)
    const result = DurationReplacer.decompose(40)
    expect(totalTicks(result)).toBeCloseTo(40)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('decomposes 56 ticks (double-dotted half = h..)', () => {
    const result = DurationReplacer.decompose(56)
    expect(totalTicks(result)).toBeCloseTo(56)
    expect(result).toHaveLength(1)
    expect(result[0].duration).toBe('h')
    expect(result[0].doubleDotted).toBe(true)
  })

  it('decomposes 3 ticks (t + z)', () => {
    const result = DurationReplacer.decompose(3)
    expect(totalTicks(result)).toBeCloseTo(3)
    // Could be dotted t (3) or t(2) + z(1)
    expect(result.length).toBeLessThanOrEqual(2)
  })

  it('decomposes 1.5 ticks (dotted z)', () => {
    const result = DurationReplacer.decompose(1.5)
    expect(totalTicks(result)).toBeCloseTo(1.5)
    expect(result).toHaveLength(1)
    expect(result[0].duration).toBe('z')
    expect(result[0].dotted).toBe(true)
  })

  it('decomposes 1.75 ticks (double-dotted z)', () => {
    const result = DurationReplacer.decompose(1.75)
    expect(totalTicks(result)).toBeCloseTo(1.75)
    expect(result).toHaveLength(1)
    expect(result[0].doubleDotted).toBe(true)
  })

  it('returns empty array for 0', () => {
    expect(DurationReplacer.decompose(0)).toEqual([])
  })

  it('always sums to the input for various values', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64]
    for (const v of values) {
      const result = DurationReplacer.decompose(v)
      expect(totalTicks(result)).toBeCloseTo(v, 6)
    }
  })

  it('handles the problematic fractional values from original code', () => {
    // These are the exact values that caused bugs with === comparisons
    const fractionals = [0.5, 0.75, 1.25, 1.5, 1.75, 2.5, 3.25, 3.5]
    for (const v of fractionals) {
      const result = DurationReplacer.decompose(v)
      expect(totalTicks(result)).toBeCloseTo(v, 6)
    }
  })
})

// ─── shrink ─────────────────────────────────────────────────────────────────

describe('DurationReplacer.shrink', () => {
  it('quarter → eighth: inserts 8-tick rest', () => {
    const beats = [makeBeat('q'), makeRest('qr'), makeRest('qr'), makeRest('qr')]
    const { beats: result, insertedRests } = DurationReplacer.shrink(beats, 0, 'e')

    expect(result).toHaveLength(5)
    expect(DurationReplacer.ticksOf(result[0].duration)).toBe(8)
    expect(result[1].hasNotes).toBe(false)
    const restTicks = insertedRests.reduce((s, r) => s + r.ticks, 0)
    expect(restTicks).toBeCloseTo(8)
    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(64)
  })

  it('half → quarter: inserts 16-tick rest', () => {
    const beats = [makeBeat('h'), makeRest('hr')]
    const { beats: result } = DurationReplacer.shrink(beats, 0, 'q')

    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(64)
    expect(result).toHaveLength(3)
    expect(DurationReplacer.ticksOf(result[0].duration)).toBe(16)
  })

  it('whole → quarter: inserts 48 ticks of rests', () => {
    const beats = [makeBeat('w')]
    const { beats: result, insertedRests } = DurationReplacer.shrink(beats, 0, 'q')

    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(64)
    const restTicks = insertedRests.reduce((s, r) => s + r.ticks, 0)
    expect(restTicks).toBeCloseTo(48)
  })

  it('quarter → sixteenth: inserts 12-tick rest (dotted eighth)', () => {
    const beats = [makeBeat('q'), makeRest('qr'), makeRest('qr'), makeRest('qr')]
    const { beats: result, insertedRests } = DurationReplacer.shrink(beats, 0, 's')

    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(64)
    const restTicks = insertedRests.reduce((s, r) => s + r.ticks, 0)
    expect(restTicks).toBeCloseTo(12)
  })

  it('preserves total measure duration', () => {
    const beats = makeQuarterMeasure()
    beats[0].hasNotes = true
    beats[0].duration = 'q'

    for (const newDur of ['e', 's', 't', 'z']) {
      const { beats: result } = DurationReplacer.shrink(beats, 0, newDur)
      expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(64)
    }
  })

  it('returns unchanged if newDuration >= oldDuration', () => {
    const beats = [makeBeat('e'), makeRest('er')]
    const { beats: result, insertedRests } = DurationReplacer.shrink(beats, 0, 'q')

    expect(result).toHaveLength(2)
    expect(insertedRests).toHaveLength(0)
  })

  it('marks rest status correctly on the changed beat', () => {
    const beats = [makeRest('qr'), makeRest('qr'), makeRest('qr'), makeRest('qr')]
    const { beats: result } = DurationReplacer.shrink(beats, 0, 'e')

    expect(DurationReplacer.isRest(result[0].duration)).toBe(true)
  })
})

// ─── grow ───────────────────────────────────────────────────────────────────

describe('DurationReplacer.grow', () => {
  it('eighth → quarter: consumes 8-tick rest', () => {
    // [e(note), er, qr, qr] → [q(note), qr, qr]
    const beats = [makeBeat('e'), makeRest('er'), makeRest('qr'), makeRest('qr')]
    const { beats: result, success } = DurationReplacer.grow(beats, 0, 'q')

    expect(success).toBe(true)
    expect(DurationReplacer.ticksOf(result[0].duration)).toBe(16)
    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(48) // originally 48 ticks
  })

  it('quarter → half: consumes one quarter rest', () => {
    const beats = [makeBeat('q'), makeRest('qr'), makeRest('qr'), makeRest('qr')]
    const { beats: result, success } = DurationReplacer.grow(beats, 0, 'h')

    expect(success).toBe(true)
    expect(DurationReplacer.ticksOf(result[0].duration)).toBe(32)
    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(64)
  })

  it('quarter → whole: consumes three quarter rests', () => {
    const beats = makeQuarterMeasure()
    beats[0].hasNotes = true
    beats[0].duration = 'q'
    const { beats: result, success } = DurationReplacer.grow(beats, 0, 'w')

    expect(success).toBe(true)
    expect(result).toHaveLength(1)
    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(64)
  })

  it('fails when not enough rests are available', () => {
    // Two notes, no rests to consume
    const beats = [makeBeat('q'), makeBeat('q'), makeRest('qr'), makeRest('qr')]
    const { beats: result, success } = DurationReplacer.grow(beats, 0, 'h')

    expect(success).toBe(false)
    // Beats unchanged
    expect(result).toHaveLength(4)
  })

  it('returns excess as rests when over-consuming', () => {
    // [e(note), hr] — grow e→q needs 8 ticks;  hr gives 32 ticks → excess 24
    const beats = [makeBeat('e'), makeRest('hr')]
    const { beats: result, success, insertedRests } = DurationReplacer.grow(beats, 0, 'q')

    expect(success).toBe(true)
    expect(DurationReplacer.ticksOf(result[0].duration)).toBe(16) // now quarter
    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(40) // e(8)+hr(32)=40
    const excessTicks = insertedRests.reduce((s, r) => s + r.ticks, 0)
    expect(excessTicks).toBeCloseTo(24)
  })

  it('preserves total measure duration', () => {
    const beats = [makeBeat('e'), makeRest('er'), makeRest('qr'), makeRest('qr')]
    const originalTotal = DurationReplacer.measureTotalTicks(beats, true)

    const { beats: result, success } = DurationReplacer.grow(beats, 0, 'q')

    expect(success).toBe(true)
    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(originalTotal)
  })

  it('does not consume notes (only rests)', () => {
    // [e(note), e(note), qr, qr] — should not consume the second note
    const beats = [makeBeat('e'), makeBeat('e'), makeRest('qr'), makeRest('qr')]
    const { success } = DurationReplacer.grow(beats, 0, 'q')

    expect(success).toBe(false)
  })
})

// ─── changeDuration (high-level) ────────────────────────────────────────────

describe('DurationReplacer.changeDuration', () => {
  it('same duration: just swaps the code', () => {
    const beats = [makeBeat('q'), makeRest('qr'), makeRest('qr'), makeRest('qr')]
    const { beats: result, success } = DurationReplacer.changeDuration(beats, 0, 'q')

    expect(success).toBe(true)
    expect(result).toHaveLength(4)
    expect(result[0].duration).toBe('q')
  })

  it('shrink path: quarter → eighth', () => {
    const beats = [makeBeat('q'), makeRest('qr'), makeRest('qr'), makeRest('qr')]
    const { beats: result, success } = DurationReplacer.changeDuration(beats, 0, 'e')

    expect(success).toBe(true)
    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(64)
    expect(DurationReplacer.ticksOf(result[0].duration)).toBe(8)
  })

  it('grow path: eighth → quarter', () => {
    const beats = [makeBeat('e'), makeRest('er'), makeRest('qr'), makeRest('qr')]
    const { beats: result, success } = DurationReplacer.changeDuration(beats, 0, 'q')

    expect(success).toBe(true)
    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(48)
    expect(DurationReplacer.ticksOf(result[0].duration)).toBe(16)
  })

  it('grow path fails gracefully', () => {
    const beats = [makeBeat('q'), makeBeat('q'), makeBeat('q'), makeBeat('q')]
    const { success } = DurationReplacer.changeDuration(beats, 0, 'h')

    expect(success).toBe(false)
  })

  it('multiple sequential changes preserve measure total', () => {
    let beats: Beat[] = makeQuarterMeasure()
    beats[0].hasNotes = true
    beats[0].duration = 'q'

    // Shrink: q → e
    let r = DurationReplacer.changeDuration(beats, 0, 'e')
    expect(r.success).toBe(true)
    expect(DurationReplacer.measureTotalTicks(r.beats, true)).toBeCloseTo(64)

    // Grow back: e → q (there should be an eighth rest available)
    r = DurationReplacer.changeDuration(r.beats, 0, 'q')
    expect(r.success).toBe(true)
    expect(DurationReplacer.measureTotalTicks(r.beats, true)).toBeCloseTo(64)
  })
})

// ─── measureTotalTicks ──────────────────────────────────────────────────────

describe('DurationReplacer.measureTotalTicks', () => {
  it('sums a standard 4/4 measure', () => {
    const beats = makeQuarterMeasure()
    expect(DurationReplacer.measureTotalTicks(beats, true)).toBe(64)
  })

  it('sums mixed durations', () => {
    const beats = [makeBeat('h'), makeBeat('e'), makeBeat('e'), makeBeat('q')]
    // 32 + 8 + 8 + 16 = 64
    expect(DurationReplacer.measureTotalTicks(beats, true)).toBe(64)
  })

  it('accounts for dotted notes', () => {
    // dotted half (48) + quarter (16) = 64
    const beats = [makeBeat('h', { dotted: true }), makeBeat('q')]
    expect(DurationReplacer.measureTotalTicks(beats, true)).toBe(64)
  })
})

// ─── Edge cases and regression tests ────────────────────────────────────────

describe('Edge cases', () => {
  it('shrink the smallest possible: z → o', () => {
    const beats = [makeBeat('z')]
    const { beats: result, success } = DurationReplacer.changeDuration(beats, 0, 'o')

    expect(success).toBe(true)
    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(1)
    expect(DurationReplacer.ticksOf(result[0].duration)).toBeCloseTo(0.5)
  })

  it('handles middle-of-measure beat change', () => {
    const beats = [makeRest('qr'), makeBeat('q'), makeRest('qr'), makeRest('qr')]
    // Shrink beat[1] from q to e
    const { beats: result, success } = DurationReplacer.changeDuration(beats, 1, 'e')

    expect(success).toBe(true)
    expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(64)
  })

  it('grow consumes ONLY forward rests, not backward', () => {
    // [qr, e(note), er, qr]
    const beats = [makeRest('qr'), makeBeat('e'), makeRest('er'), makeRest('qr')]
    const { beats: result, success } = DurationReplacer.grow(beats, 1, 'q')

    expect(success).toBe(true)
    // The first qr should still be there
    expect(DurationReplacer.isRest(result[0].duration)).toBe(true)
    expect(DurationReplacer.ticksOf(result[0].duration)).toBe(16)
  })

  it('IEEE-754 regression: decompose(0.5 + 0.25) does not break', () => {
    // 0.75 via floating point
    const val = 0.5 + 0.25
    const result = DurationReplacer.decompose(val)
    const total = result.reduce((s, r) => s + r.ticks, 0)
    expect(total).toBeCloseTo(0.75, 6)
  })

  it('IEEE-754 regression: decompose(16 - 8.5) handles imprecise subtraction', () => {
    const val = 16 - 8.5 // Should be 7.5
    const result = DurationReplacer.decompose(val)
    const total = result.reduce((s, r) => s + r.ticks, 0)
    expect(total).toBeCloseTo(7.5, 6)
  })

  it('round-trip: shrink then grow returns to original total', () => {
    const original = [makeBeat('h'), makeRest('hr')]
    const originalTotal = DurationReplacer.measureTotalTicks(original, true)

    // Shrink: h → q
    const shrunk = DurationReplacer.shrink(original, 0, 'q')
    expect(DurationReplacer.measureTotalTicks(shrunk.beats, true)).toBeCloseTo(originalTotal)

    // Grow: q → h (should consume the 16-tick rest created by shrink)
    const grown = DurationReplacer.grow(shrunk.beats, 0, 'h')
    expect(grown.success).toBe(true)
    expect(DurationReplacer.measureTotalTicks(grown.beats, true)).toBeCloseTo(originalTotal)
  })

  it('exhaustive: all standard shrink pairs preserve total', () => {
    const durations = ['w', 'h', 'q', 'e', 's', 't', 'z']
    for (let i = 0; i < durations.length; i++) {
      for (let j = i + 1; j < durations.length; j++) {
        const big = durations[i]
        const small = durations[j]
        const beats = [makeBeat(big)]
        const bigTicks = DurationReplacer.ticksOf(big)

        const { beats: result } = DurationReplacer.shrink(beats, 0, small)
        expect(DurationReplacer.measureTotalTicks(result, true)).toBeCloseTo(
          bigTicks,
          6,
        )
      }
    }
  })
})
