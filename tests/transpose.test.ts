import { describe, expect, it } from 'vitest'
import type { Beat, Note } from '../src/types/song'
import { otherVoiceNotes } from '../src/utils/otherVoiceNotes'
import { applyPlacement, placeTransposedBeat } from '../src/utils/transpose'

const GUITAR = [40, 45, 50, 55, 59, 64] // index 0 = low E

describe('placeTransposedBeat', () => {
  it('keeps notes on their string while the fret fits', () => {
    expect(placeTransposedBeat([{ string: 0, fret: 3 }], GUITAR, 2, 24)).toEqual([
      { from: 0, string: 0, fret: 5 },
    ])
  })

  it('moves a note below the nut to a lower string', () => {
    // A string, open, a semitone down: G# on the low E string, fret 4.
    expect(placeTransposedBeat([{ string: 1, fret: 0 }], GUITAR, -1, 24)).toEqual([
      { from: 1, string: 0, fret: 4 },
    ])
  })

  it('keeps a chord playable an octave up, near the old hand position where it must move', () => {
    // An open E power chord (E string 0, B string 1 fret 2) an octave up stays on its strings.
    expect(
      placeTransposedBeat(
        [
          { string: 0, fret: 0 },
          { string: 1, fret: 2 },
        ],
        GUITAR,
        12,
        24,
      ),
    ).toEqual([
      { from: 0, string: 0, fret: 12 },
      { from: 1, string: 1, fret: 14 },
    ])
    // With only 12 frets the low E can't go up an octave on its string.
    const placed = placeTransposedBeat([{ string: 0, fret: 3 }], GUITAR, 12, 12)
    expect(placed).toEqual([{ from: 0, string: 2, fret: 5 }])
  })

  it('refuses what no string can play, and honours pinned strings', () => {
    expect(placeTransposedBeat([{ string: 0, fret: 0 }], GUITAR, -1, 24)).toBeNull()
    expect(placeTransposedBeat([{ string: 1, fret: 0 }], GUITAR, -1, 24, new Map([[1, 1]]))).toBeNull()
  })

  it('moves the note object with its grace note and trill partner', () => {
    const note = {
      fret: 0,
      string: 1,
      graceObj: { fret: 2 },
      trill: { fret: 3, period: 16 },
    } as unknown as Note
    const notes: (Note | null)[] = [null, note, null]
    applyPlacement(notes, [{ from: 1, string: 0, fret: 4 }])
    expect(notes[1]).toBeNull()
    expect(notes[0]).toBe(note)
    expect(note).toMatchObject({ fret: 4, string: 0, graceObj: { fret: 6 }, trill: { fret: 7 } })
  })
})

describe('otherVoiceNotes', () => {
  const beat = (duration: string, frets: Record<number, number> = {}): Beat =>
    ({
      duration,
      notes: Object.assign(
        new Array(6).fill(null),
        Object.fromEntries(Object.entries(frets).map(([s, fret]) => [s, { fret }])),
      ),
    }) as unknown as Beat

  it('places the other voice by time in the edited voice’s beats', () => {
    // Edited voice: four quarters, 40 px each from x = 10.
    const edited = [beat('q', { 5: 0 }), beat('q', { 5: 1 }), beat('q', { 5: 2 }), beat('q', { 5: 3 })]
    const boxes = edited.map((_, i) => ({ left: 10 + i * 40, width: 40, noteX: 30 + i * 40 }))
    // Other voice: a half note, then two eighths, then a quarter rest.
    const other = [beat('h', { 0: 5 }), beat('e', { 0: 7 }), beat('e', { 5: 3 }), beat('qr')]
    expect(otherVoiceNotes(edited, boxes, other)).toEqual([
      { x: 30, string: 0, text: '5', beatIndex: 0 },
      { x: 100, string: 0, text: '7', beatIndex: 1 },
      // An eighth in the second half of beat 3; the 3 on string 5 there would hide under the edited voice's
      // note only when it sits at the same x, so it stays.
      { x: 120, string: 5, text: '3', beatIndex: 2 },
    ])
  })

  it('skips a note right under the edited voice’s note on the same string, and empty voices', () => {
    const edited = [beat('h', { 0: 3 }), beat('h')]
    const boxes = [
      // Half notes sit a quarter's half-width into their slot.
      { left: 0, width: 80, noteX: 20 },
      { left: 80, width: 80, noteX: 100 },
    ]
    expect(otherVoiceNotes(edited, boxes, [beat('h', { 0: 5 }), beat('h', { 1: 2 })])).toEqual([
      { x: 100, string: 1, text: '2', beatIndex: 1 },
    ])
    expect(otherVoiceNotes(edited, boxes, [{ ...beat('wr'), empty: true } as Beat])).toEqual([])
  })
})
