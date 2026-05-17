import { describe, expect, it } from 'vitest'
import type { TabBeat } from '../src/types/tab'
import { getBeamedBeatGroups, getBeamedBeatIndices } from '../src/utils/tabBeaming'

function makeNoteBeat(
  duration: string,
  options: Partial<Pick<TabBeat, 'tuplet' | 'tupletId'>> = {},
): TabBeat {
  return {
    duration,
    notes: [{ fret: 0 }],
    tuplet: null,
    tupletId: -1,
    ...options,
  } as TabBeat
}

function makeRestBeat(duration: string): TabBeat {
  return {
    duration,
    notes: [null],
    tuplet: null,
    tupletId: -1,
  } as TabBeat
}

describe('tab beaming groups', () => {
  it('splits consecutive eighth notes into quarter-note pairs', () => {
    const beats = Array.from({ length: 8 }, () => makeNoteBeat('e'))

    expect(getBeamedBeatGroups(beats)).toEqual([
      [
        { beatIndex: 0, beamCount: 1 },
        { beatIndex: 1, beamCount: 1 },
      ],
      [
        { beatIndex: 2, beamCount: 1 },
        { beatIndex: 3, beamCount: 1 },
      ],
      [
        { beatIndex: 4, beamCount: 1 },
        { beatIndex: 5, beamCount: 1 },
      ],
      [
        { beatIndex: 6, beamCount: 1 },
        { beatIndex: 7, beamCount: 1 },
      ],
    ])
  })

  it('keeps four sixteenth notes inside the same quarter-note group', () => {
    const beats = Array.from({ length: 4 }, () => makeNoteBeat('s'))

    expect(getBeamedBeatGroups(beats)).toEqual([
      [
        { beatIndex: 0, beamCount: 2 },
        { beatIndex: 1, beamCount: 2 },
        { beatIndex: 2, beamCount: 2 },
        { beatIndex: 3, beamCount: 2 },
      ],
    ])
  })

  it('breaks beam groups at rests and quarter notes', () => {
    const beats = [
      makeNoteBeat('e'),
      makeNoteBeat('e'),
      makeRestBeat('er'),
      makeNoteBeat('e'),
      makeNoteBeat('e'),
      makeNoteBeat('q'),
    ]

    expect(getBeamedBeatGroups(beats)).toEqual([
      [
        { beatIndex: 0, beamCount: 1 },
        { beatIndex: 1, beamCount: 1 },
      ],
      [
        { beatIndex: 3, beamCount: 1 },
        { beatIndex: 4, beamCount: 1 },
      ],
    ])
  })

  it('keeps tuplet notes together even when their summed duration exceeds one quarter', () => {
    const beats = [
      makeNoteBeat('e', { tuplet: 3, tupletId: 12 }),
      makeNoteBeat('e', { tuplet: 3, tupletId: 12 }),
      makeNoteBeat('e', { tuplet: 3, tupletId: 12 }),
      makeNoteBeat('e'),
      makeNoteBeat('e'),
    ]

    expect(getBeamedBeatGroups(beats)).toEqual([
      [
        { beatIndex: 0, beamCount: 1 },
        { beatIndex: 1, beamCount: 1 },
        { beatIndex: 2, beamCount: 1 },
      ],
      [
        { beatIndex: 3, beamCount: 1 },
        { beatIndex: 4, beamCount: 1 },
      ],
    ])
  })

  it('returns a flat index set for beamed beats only', () => {
    const beats = [
      makeNoteBeat('e'),
      makeNoteBeat('e'),
      makeRestBeat('qr'),
      makeNoteBeat('s'),
      makeNoteBeat('s'),
      makeNoteBeat('s'),
      makeNoteBeat('s'),
    ]

    expect(Array.from(getBeamedBeatIndices(beats))).toEqual([0, 1, 3, 4, 5, 6])
  })
})