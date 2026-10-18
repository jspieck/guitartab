import { describe, expect, it } from 'vitest'
import type { TabBeat, TabNoteData } from '../src/types/tab'
import {
  computeRowLanes,
  getRhythmBandHeight,
  MEASURE_NUMBER_STRIP,
  type LaneBlockInput,
} from '../src/utils/tabRowLanes'

function beat(
  overrides: Partial<TabBeat> = {},
  notes: Array<Partial<TabNoteData> | null> = [{ fret: 1 }],
): TabBeat {
  return {
    duration: 'q',
    notes: notes.map((note) => (note ? { fret: 0, ...note } : null)),
    ...overrides,
  } as TabBeat
}

function row(beats: TabBeat[], meta: LaneBlockInput['meta'] = undefined, spacing = 30) {
  return computeRowLanes({
    numStrings: 6,
    stringSpacing: 12,
    blocks: [
      { blockId: 0, meta, beats: beats.map((b, index) => ({ beat: b, centerX: 20 + index * spacing })) },
    ],
  })
}

describe('computeRowLanes', () => {
  it('keeps a row without annotations compact', () => {
    const lanes = row([beat(), beat()])

    expect(lanes.above).toEqual({})
    expect(lanes.below).toEqual({})
    expect(lanes.overBarHeight).toBe(MEASURE_NUMBER_STRIP)
    expect(lanes.bodyHeight).toBe(5 * 12 + getRhythmBandHeight(0))
  })

  it('sizes the rhythm band for the deepest beam level in the row', () => {
    expect(row([beat({ duration: 'e' })]).bodyHeight).toBeLessThan(row([beat({ duration: 't' })]).bodyHeight)
  })

  it('stacks used lanes above the strings without overlap, nearest lane first', () => {
    const lanes = row(
      [
        beat({}, [
          {
            fret: 5,
            bendObj: [
              { bendPosition: 0, bendValue: 0, vibrato: 0 },
              { bendPosition: 60, bendValue: 100, vibrato: 0 },
            ],
            palmMute: true,
            vibrato: true,
          },
        ]),
        beat({ text: 'hi' }, [{ fret: 3, accentuated: true }]),
      ],
      { bpm: 120, marker: { text: 'A', color: { red: 0, green: 0, blue: 0 } } },
    )

    const boxes = Object.entries(lanes.above).map(([id, box]) => ({ id, ...box! }))
    expect(boxes.map((box) => box.id).sort()).toEqual(
      ['articulation', 'bend', 'marker', 'palmMute', 'tempo', 'text', 'vibrato'].sort(),
    )
    boxes.sort((a, b) => b.top - a.top)
    expect(boxes[0].id).toBe('bend')
    expect(boxes[0].top + boxes[0].height).toBe(-MEASURE_NUMBER_STRIP)
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index].top + boxes[index].height).toBe(boxes[index - 1].top)
    }
    expect(lanes.overBarHeight).toBe(-boxes.at(-1)!.top)
  })

  it('puts horizontally clashing texts on separate lines', () => {
    const lanes = row([beat({ text: 'A long annotation text' }), beat({ text: 'next' })], undefined, 30)

    expect(lanes.textLine['0:0']).not.toBe(lanes.textLine['0:1'])
    expect(lanes.above.text!.height).toBe(30)
  })

  it('stacks several articulations of one beat on separate lines', () => {
    const lanes = row([
      beat({}, [
        { fret: 1, accentuated: true, stacatto: true },
        { fret: 2, tap: true },
      ]),
    ])

    const lines = ['•', '>', 'T'].map((token) => lanes.articulationLine[`0:0:${token}`])
    expect(new Set(lines).size).toBe(3)
  })

  it('reserves lanes below the rhythm for tuplets and dynamics', () => {
    const lanes = row([beat({ tuplet: 3, dynamicPresent: true, dynamic: 'f' } as Partial<TabBeat>)])

    expect(lanes.below.tuplet!.top).toBe(5 * 12 + getRhythmBandHeight(0))
    expect(lanes.below.dynamic!.top).toBe(lanes.below.tuplet!.top + lanes.below.tuplet!.height)
    expect(lanes.bodyHeight).toBe(lanes.below.dynamic!.top + lanes.below.dynamic!.height)
  })
})
