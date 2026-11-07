import { describe, expect, it } from 'vitest'
import type { Beat } from '../src/types/song'
import type { TabBeat } from '../src/types/tab'
import {
  applyLyricLines,
  collectLyricLines,
  flowLyrics,
  lyricChunksToText,
  lyricSyllabic,
  parseLyricChunks,
  setBeatLyric,
} from '../src/utils/lyrics'
import { computeRowLanes, getRhythmBandHeight, LANE_HEIGHTS } from '../src/utils/tabRowLanes'

/** A beat with a note (`n`) or a rest (`r`). */
function beat(kind: 'n' | 'r', lyrics?: string[]): Beat {
  return {
    duration: kind === 'n' ? 'q' : 'qr',
    notes: kind === 'n' ? [{ fret: 1 }, null] : [null, null],
    ...(lyrics ? { lyrics } : {}),
  } as unknown as Beat
}

/** Bars of one voice from a pattern like "nnr|nn". */
function bars(pattern: string): Beat[][][] {
  return pattern.split('|').map((bar) => [[...bar].map((kind) => beat(kind as 'n' | 'r'))])
}

function lyricsOf(song: Beat[][][], verse = 0): string {
  return song
    .map((bar) => bar[0].map((b) => (b.notes.some((n) => n) ? b.lyrics?.[verse] || '_' : '.')).join(' '))
    .join(' | ')
}

describe('lyric text', () => {
  it('splits on spaces and after hyphens, joins words with +, skips notes with extra spaces', () => {
    expect(parseLyricChunks('Hel-lo world')).toEqual(['Hel-', 'lo', 'world'])
    expect(parseLyricChunks('Hel- lo')).toEqual(['Hel-', 'lo'])
    expect(parseLyricChunks('a  b   c')).toEqual(['a', '', 'b', '', '', 'c'])
    expect(parseLyricChunks(' a')).toEqual(['', 'a'])
    expect(parseLyricChunks('oh+yeah now')).toEqual(['oh yeah', 'now'])
    expect(parseLyricChunks('line one\r\nline two')).toEqual(['line', 'one', 'line', 'two'])
  })

  it('ignores [comments] like verse labels', () => {
    expect(parseLyricChunks('[Verse 1] Hel-lo [x] you')).toEqual(['Hel-', 'lo', 'you'])
    expect(parseLyricChunks('[Chorus]\nla')).toEqual(['la'])
  })

  it('writes syllables back to text that reads the same', () => {
    const cases = [
      ['Hel-', 'lo', 'world'],
      ['Hel-', '', 'lo'],
      ['', '', 'a', 'oh yeah', '', 'b-', 'c'],
      ['-', 'a'],
    ]
    for (const syllables of cases) {
      expect(parseLyricChunks(lyricChunksToText(syllables))).toEqual(syllables)
    }
    expect(lyricChunksToText(['a', 'b', '', ''])).toBe('a b')
    expect(lyricChunksToText(['Hel-', 'lo', 'oh yeah'])).toBe('Hel-lo oh+yeah')
  })

  it('gives MusicXML syllabic values across a word', () => {
    expect(lyricSyllabic(false, 'Hel-')).toEqual({ text: 'Hel', syllabic: 'begin', open: true })
    expect(lyricSyllabic(true, 'lo-')).toEqual({ text: 'lo', syllabic: 'middle', open: true })
    expect(lyricSyllabic(true, 'you')).toEqual({ text: 'you', syllabic: 'end', open: false })
    expect(lyricSyllabic(false, 'la')).toEqual({ text: 'la', syllabic: 'single', open: false })
    // A lone dash is a syllable of its own, not a hyphen.
    expect(lyricSyllabic(false, '-').text).toBe('-')
  })
})

describe('lyrics on beats', () => {
  it('flows syllables onto note beats only, across bars', () => {
    const song = bars('nrn|rnn')
    const written = flowLyrics(song, 0, 0, { blockId: 0, beatId: 1 }, ['a', 'b', 'c', 'd'])
    expect(written).toEqual([
      { blockId: 0, beatId: 2 },
      { blockId: 1, beatId: 1 },
      { blockId: 1, beatId: 2 },
    ])
    expect(lyricsOf(song)).toBe('_ . a | . b c')
  })

  it('keeps verses apart and drops the field when the last syllable is cleared', () => {
    const target = beat('n')
    setBeatLyric(target, 1, 'two')
    expect(target.lyrics).toEqual(['', 'two'])
    setBeatLyric(target, 0, 'one')
    setBeatLyric(target, 1, '')
    expect(target.lyrics).toEqual(['one'])
    setBeatLyric(target, 0, '')
    expect('lyrics' in target).toBe(false)
  })

  it('reads Guitar Pro lines and writes them back from the first syllable of each verse', () => {
    const song = bars('nnr|nnn|nn')
    applyLyricLines(song, [
      { startBar: 0, text: 'Hel-lo  world' },
      { startBar: 1, text: ' la la' },
    ])
    expect(lyricsOf(song)).toBe('Hel- lo . | _ world _ | _ _')
    expect(lyricsOf(song, 1)).toBe('_ _ . | _ la la | _ _')
    expect(collectLyricLines(song)).toEqual([
      { startBar: 0, text: 'Hel-lo  world' },
      { startBar: 1, text: ' la la' },
    ])

    const again = bars('nnr|nnn|nn')
    applyLyricLines(again, collectLyricLines(song))
    expect(again).toEqual(song)
  })

  it('reserves a lyrics lane per verse below everything else', () => {
    const lanes = computeRowLanes({
      numStrings: 6,
      stringSpacing: 12,
      blocks: [
        {
          blockId: 0,
          meta: undefined,
          beats: [
            { beat: { ...beat('n', ['', 'b']), dynamicPresent: true, dynamic: 'f' } as TabBeat, centerX: 20 },
          ],
        },
      ],
    })
    expect(lanes.lyricVerses).toBe(2)
    expect(lanes.below.lyrics).toEqual({
      top: lanes.below.dynamic!.top + LANE_HEIGHTS.dynamic,
      height: 2 * LANE_HEIGHTS.lyrics,
    })
    expect(lanes.bodyHeight).toBe(lanes.below.lyrics!.top + 2 * LANE_HEIGHTS.lyrics)
    expect(lanes.below.dynamic!.top).toBe(5 * 12 + getRhythmBandHeight(0))
  })
})
