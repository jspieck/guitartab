import { describe, expect, it } from 'vitest'
import { clefAt, clefChangesAt, setClefFrom, shiftClefs } from '../src/utils/clefs'
import { hiddenBars, multiRestRuns } from '../src/utils/multiRests'
import { computeRowLanes } from '../src/utils/tabRowLanes'
import { tabStemsGoUp } from '../src/utils/otherVoiceNotes'
import { beatShowsRhythm } from '../src/utils/durationUtils'
import type { Beat, MeasureMetaInfo, Track } from '../src/types/song'
import { beat, meta, note } from './helpers/songBuilders'

const guitar = (): Pick<Track, 'numStrings' | 'clefs'> => ({ numStrings: 6 })

describe('clef changes', () => {
  it('carries the clef on from its bar, defaults by instrument, and drums are percussion', () => {
    const track = guitar()
    setClefFrom(track, 3, 'bass')
    setClefFrom(track, 6, 'treble8vb')
    expect([0, 2, 3, 5, 6, 9].map((bar) => clefAt(track, bar, false))).toEqual([
      'treble',
      'treble',
      'bass',
      'bass',
      'treble8vb',
      'treble8vb',
    ])
    expect(clefAt({ numStrings: 4 }, 0, false)).toBe('bass')
    expect(clefAt(track, 4, true)).toBe('percussion')
    expect([2, 3, 4, 6].map((bar) => clefChangesAt(track, bar, false))).toEqual([false, true, false, true])
  })

  it('keeps only real changes: choosing the clef before removes a change', () => {
    const track = guitar()
    setClefFrom(track, 0, 'treble')
    expect(track.clefs).toBeUndefined()
    setClefFrom(track, 2, 'alto')
    setClefFrom(track, 5, 'alto')
    expect(track.clefs).toEqual({ 2: 'alto' })
    setClefFrom(track, 2, 'treble')
    expect(track.clefs).toBeUndefined()
  })

  it('moves with inserted and removed bars', () => {
    const track = guitar()
    setClefFrom(track, 1, 'bass')
    setClefFrom(track, 4, 'tenor')
    shiftClefs(track, 2, 3)
    expect(track.clefs).toEqual({ 1: 'bass', 7: 'tenor' })
    shiftClefs(track, 5, -3)
    expect(track.clefs).toEqual({ 1: 'bass', 4: 'tenor' })
  })
})

describe('multi-bar rests', () => {
  const rest = (): Beat[][] => [[beat('w')], [beat('w', {}, { empty: true })]]
  const played = (): Beat[][] => [[beat('w', { 0: note(3) })], []]
  const metas = (count: number): MeasureMetaInfo[] => Array.from({ length: count }, () => meta(4, 4))

  it('collapses runs of two or more empty bars', () => {
    const bars = [played(), rest(), rest(), rest(), played(), rest(), played(), rest(), rest()]
    const runs = multiRestRuns(bars, metas(bars.length), guitar(), false)
    expect([...runs]).toEqual([
      [1, 3],
      [7, 2],
    ])
    expect([...hiddenBars(runs)]).toEqual([2, 3, 8])
  })

  it('breaks a run where a bar must stay visible', () => {
    const bars = [rest(), rest(), rest(), rest(), rest(), rest()]
    const bar = metas(bars.length)
    bar[2].marker = { text: 'B', color: { red: 0, green: 0, blue: 0 } }
    bar[4].keySignature = 2 // keys are on every bar: a change from bar 4 on
    bar[5].keySignature = 2
    expect([...multiRestRuns(bars, bar, guitar(), false)]).toEqual([
      [0, 2],
      [2, 2],
      [4, 2],
    ])
    // a repeat ending on a bar keeps it out of runs (as their first bar) and ends them before it
    const repeated = metas(4)
    repeated[1].repeatClose = 2
    expect([...multiRestRuns([rest(), rest(), rest(), rest()], repeated, guitar(), false)]).toEqual([[2, 2]])
  })

  it('treats a slash, a text or a chord as content', () => {
    const slashed = (): Beat[][] => [[beat('q', {}, { slash: true })]]
    const texted = (): Beat[][] => [[beat('w', {}, { text: 'tacet' })]]
    expect(multiRestRuns([slashed(), slashed(), texted(), texted()], metas(4), guitar(), false).size).toBe(0)
    expect(beatShowsRhythm(beat('q', {}, { slash: true }))).toBe(true)
    expect(beatShowsRhythm(beat('q'))).toBe(false)
  })
})

describe('rhythm on stems', () => {
  it('turns the first voice up only where the second voice plays', () => {
    const second = [beat('w', { 0: note(5) })]
    expect(tabStemsGoUp(true, 0, second)).toBe(true)
    expect(tabStemsGoUp(true, 1, second)).toBe(false)
    expect(tabStemsGoUp(false, 0, second)).toBe(false)
    expect(tabStemsGoUp(true, 0, [beat('w', {}, { empty: true })])).toBe(false)
  })

  it('adds a rhythm lane above the strings for stems going up', () => {
    const eighths = [0, 1].map(() => ({ beat: beat('e', { 0: note(1) }), centerX: 0 }))
    const input = (stemsUp: boolean) => ({
      blocks: [{ blockId: 0, stemsUp, meta: undefined, beats: eighths }],
      numStrings: 6,
      stringSpacing: 12,
    })
    const down = computeRowLanes(input(false))
    const up = computeRowLanes(input(true))
    expect(down.above.rhythm).toBeUndefined()
    expect(up.above.rhythm).toBeDefined()
    // the beams and the flag of an eighth fit inside the lane
    expect(up.above.rhythm!.top).toBeLessThanOrEqual(-24 - 10)
    expect(up.overBarHeight).toBeGreaterThan(down.overBarHeight)
  })
})
