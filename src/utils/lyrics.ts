import type { Beat } from '../types/song'

/**
 * Lyrics: one syllable per beat and verse (`beat.lyrics[verse]`), on the beats that sound
 * a note. A syllable ending in `-` continues the word on the next syllable ("Hel-", "lo").
 *
 * Guitar Pro stores lyrics as text per verse with a start bar; the syllables go one per
 * note beat from that bar on. The same text form is what the user types or pastes:
 * spaces and line breaks separate syllables, a `-` ends a syllable and joins it to the
 * next, `+` puts two words on one beat, `[...]` is a comment (verse labels) and each extra
 * space skips a beat.
 */

/** Guitar Pro has five lyric lines. */
export const MAX_LYRIC_VERSES = 5
/** Width per character of a lyric syllable at the drawn size (11px). */
export const LYRIC_CHAR_WIDTH = 6

export interface LyricLine {
  /** Bar (0-based) whose first note beat takes the first syllable. */
  startBar: number
  text: string
}

export interface LyricBeatRef {
  blockId: number
  beatId: number
}

type Bars = ReadonlyArray<ReadonlyArray<ReadonlyArray<Beat> | undefined> | undefined>

const isBreak = (c: string) => c === ' ' || c === '\n' || c === '\r' || c === '\t'

/** Splits lyric text into one syllable per beat; `''` is a beat without one. */
export function parseLyricChunks(text: string): string[] {
  const chunks: string[] = []
  let current: string | null = null
  // Spaces since the last syllable: the first only separates, each further one skips a beat.
  let spaces = 0
  let afterChunk = false
  let comment = false
  const end = () => {
    if (current == null) return
    chunks.push(current.replace(/\+/g, ' '))
    current = null
    afterChunk = true
    spaces = 0
  }
  for (const c of text) {
    if (comment) {
      // A comment separates like a syllable would: only further spaces skip notes.
      if (c === ']') {
        comment = false
        afterChunk = true
        spaces = 0
      }
      continue
    }
    if (isBreak(c)) {
      end()
      if (c === ' ') spaces += 1
      continue
    }
    if (current == null && c === '[') {
      comment = true
      spaces = 0
      continue
    }
    if (current != null && current.endsWith('-') && c !== '-') end()
    if (current == null) {
      const skipped = afterChunk ? Math.max(0, spaces - 1) : spaces
      for (let i = 0; i < skipped; i += 1) chunks.push('')
      spaces = 0
      current = ''
    }
    current += c
  }
  end()
  return chunks
}

/** The inverse of `parseLyricChunks` (trailing empty beats are dropped). */
export function lyricChunksToText(chunks: readonly string[]): string {
  let last = chunks.length
  while (last > 0 && chunks[last - 1] === '') last -= 1
  let out = ''
  for (let i = 0; i < last; i += 1) {
    const chunk = chunks[i].replace(/ /g, '+')
    out += chunk
    if (i < last - 1) out += chunk.endsWith('-') && chunks[i + 1] !== '' ? '' : ' '
  }
  return out
}

/** Lyrics go on beats that sound a note (not on rests). */
export function beatTakesLyric(beat: Pick<Beat, 'notes'> | null | undefined): boolean {
  return (beat?.notes ?? []).some((note) => note != null)
}

export function beatLyric(beat: Pick<Beat, 'lyrics'> | null | undefined, verse: number): string {
  return beat?.lyrics?.[verse] ?? ''
}

export function beatHasLyrics(beat: Pick<Beat, 'lyrics'> | null | undefined): boolean {
  return (beat?.lyrics ?? []).some((syllable) => syllable !== '')
}

/** Sets (or with `''` clears) one verse's syllable; drops the field when no verse is left. */
export function setBeatLyric(beat: Pick<Beat, 'lyrics'>, verse: number, syllable: string): void {
  const lyrics = [...(beat.lyrics ?? [])]
  while (lyrics.length <= verse) lyrics.push('')
  lyrics[verse] = syllable
  while (lyrics.length > 0 && lyrics[lyrics.length - 1] === '') lyrics.pop()
  if (lyrics.length > 0) beat.lyrics = lyrics
  else delete beat.lyrics
}

/** The syllable as drawn: without the joining hyphen (drawn separately). */
export function lyricDisplayText(syllable: string): string {
  return lyricJoinsNext(syllable) ? syllable.replace(/-+$/, '') : syllable
}

export function lyricJoinsNext(syllable: string): boolean {
  return syllable.length > 1 && syllable.endsWith('-')
}

export function estimateLyricWidth(syllable: string): number {
  return lyricDisplayText(syllable).length * LYRIC_CHAR_WIDTH
}

/** MusicXML's `<syllabic>` of a syllable, given whether the previous one left a word open. */
export function lyricSyllabic(
  previousOpen: boolean,
  syllable: string,
): { text: string; syllabic: 'single' | 'begin' | 'middle' | 'end'; open: boolean } {
  const open = lyricJoinsNext(syllable)
  const syllabic = previousOpen ? (open ? 'middle' : 'end') : open ? 'begin' : 'single'
  return { text: lyricDisplayText(syllable), syllabic, open }
}

/** The beats (of one track's voice) that take lyrics, from `from` on (or before it, backwards). */
export function* lyricBeats(
  bars: Bars,
  voice: number,
  from: LyricBeatRef,
  direction: 1 | -1 = 1,
): Generator<LyricBeatRef> {
  for (let blockId = from.blockId; blockId >= 0 && blockId < bars.length; blockId += direction) {
    const beats = bars[blockId]?.[voice] ?? []
    let beatId = blockId === from.blockId ? from.beatId : direction === 1 ? 0 : beats.length - 1
    for (; beatId >= 0 && beatId < beats.length; beatId += direction) {
      if (beatTakesLyric(beats[beatId])) yield { blockId, beatId }
    }
  }
}

/** The first `count` lyric beats from `from` on. */
export function nextLyricBeats(bars: Bars, voice: number, from: LyricBeatRef, count: number): LyricBeatRef[] {
  const out: LyricBeatRef[] = []
  if (count <= 0) return out
  for (const ref of lyricBeats(bars, voice, from)) {
    out.push(ref)
    if (out.length === count) break
  }
  return out
}

/**
 * Writes syllables onto the lyric beats from `from` on (one each; `''` clears a beat).
 * Returns the beats written; fewer than syllables when the track ends.
 */
export function flowLyrics(
  bars: Bars,
  voice: number,
  verse: number,
  from: LyricBeatRef,
  syllables: readonly string[],
): LyricBeatRef[] {
  const targets = nextLyricBeats(bars, voice, from, syllables.length)
  targets.forEach((ref, i) => {
    const beat = bars[ref.blockId]![voice]![ref.beatId] as Beat
    setBeatLyric(beat, verse, syllables[i])
  })
  return targets
}

/** Puts Guitar Pro lyric lines (one per verse) onto a track's beats. */
export function applyLyricLines(bars: Bars, lines: readonly LyricLine[], voice = 0): void {
  lines.slice(0, MAX_LYRIC_VERSES).forEach((line, verse) => {
    if (line.text.trim() === '' || line.startBar < 0 || line.startBar >= bars.length) return
    flowLyrics(bars, voice, verse, { blockId: line.startBar, beatId: 0 }, parseLyricChunks(line.text))
  })
}

/** A track's lyrics as Guitar Pro lyric lines, one per verse; each starts at the bar of its first syllable. */
export function collectLyricLines(bars: Bars, voice = 0): LyricLine[] {
  let verses = 0
  for (const block of bars) {
    for (const beat of block?.[voice] ?? []) verses = Math.max(verses, beat.lyrics?.length ?? 0)
  }
  verses = Math.min(MAX_LYRIC_VERSES, verses)
  const lines: LyricLine[] = []
  for (let verse = 0; verse < verses; verse += 1) {
    const refs = [...lyricBeats(bars, voice, { blockId: 0, beatId: 0 })]
    const syllableOf = (ref: LyricBeatRef) => beatLyric(bars[ref.blockId]?.[voice]?.[ref.beatId], verse)
    const first = refs.find((ref) => syllableOf(ref) !== '')
    if (first == null) {
      lines.push({ startBar: 0, text: '' })
      continue
    }
    const fromBar = refs.filter((ref) => ref.blockId >= first.blockId)
    lines.push({ startBar: first.blockId, text: lyricChunksToText(fromBar.map(syllableOf)) })
  }
  return lines
}

/** Whether any track beat carries lyrics. */
export function barsHaveLyrics(bars: Bars): boolean {
  return bars.some((block) => (block ?? []).some((voice) => (voice ?? []).some(beatHasLyrics)))
}
