import { beforeEach, describe, expect, it } from 'vitest'
import Song, { type Beat } from '../src/stores/song'

describe('Song.isBeatEmpty', () => {
  beforeEach(() => {
    Song.measures = [[[[Song.defaultMeasure()]]]] as Beat[][][][]
  })

  it('treats a rest-only block as empty', () => {
    expect(Song.isBeatEmpty(0, 0)).toBe(true)
  })

  it('treats a note-bearing rest block as non-empty', () => {
    Song.measures[0][0][0][0] = {
      ...Song.defaultMeasure(),
      duration: 'er',
      notes: [
        {
          ...Song.defaultNote(),
          fret: 7,
          string: 2,
        },
      ],
    }

    expect(Song.isBeatEmpty(0, 0)).toBe(false)
  })

  it('treats blocks with otherNotes content as non-empty', () => {
    Song.measures[0][0][0][0] = {
      ...Song.defaultMeasure(),
      duration: 'er',
      otherNotes: ['ghost'],
    }

    expect(Song.isBeatEmpty(0, 0)).toBe(false)
  })
})
