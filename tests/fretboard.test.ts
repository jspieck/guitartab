import { describe, expect, it } from 'vitest'
import { columnOfNeckFret, fretboardColumns, inlayCount } from '../src/utils/fretboard'

describe('fretboard geometry', () => {
  it('shows the neck from the nut, with the capo inside it', () => {
    const columns = fretboardColumns(2, false)
    expect(columns).toHaveLength(25)
    expect(columns[0]).toEqual({ neckFret: 0, tabFret: -2, inlays: 0 })
    expect(columns[2]).toEqual({ neckFret: 2, tabFret: 0, inlays: 0 })
    expect(columns[24]).toEqual({ neckFret: 24, tabFret: 22, inlays: 2 })
  })

  it('counts from the capo for input: column = tab fret 0…24', () => {
    const columns = fretboardColumns(3, true)
    expect(columns.map((column) => column.tabFret)).toEqual(Array.from({ length: 25 }, (_, fret) => fret))
    // Inlays stay where they are on the neck: tab fret 2 with capo 3 is neck fret 5.
    expect(columns[2]).toEqual({ neckFret: 5, tabFret: 2, inlays: 1 })
    expect(columns[9].inlays).toBe(2)
  })

  it('maps sounding notes (frets from the nut) to columns', () => {
    expect(columnOfNeckFret(5, 3, true)).toBe(2)
    expect(columnOfNeckFret(2, 3, true)).toBe(-1)
    expect(columnOfNeckFret(5, 3, false)).toBe(5)
    expect(columnOfNeckFret(25, 0, false)).toBe(-1)
    expect(columnOfNeckFret(27, 3, true)).toBe(24)
  })

  it('puts inlays on 3, 5, 7, 9, 12 (two), 15 … 24 (two)', () => {
    const dots = Array.from({ length: 25 }, (_, fret) => inlayCount(fret))
    expect(dots.flatMap((count, fret) => (count > 0 ? [`${fret}:${count}`] : []))).toEqual([
      '3:1',
      '5:1',
      '7:1',
      '9:1',
      '12:2',
      '15:1',
      '17:1',
      '19:1',
      '21:1',
      '24:2',
    ])
  })
})
