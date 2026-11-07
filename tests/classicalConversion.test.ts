// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * What the classical notation makes of a track's bars, before anything is drawn: per beat
 * the VexFlow keys, duration, accidentals, grace notes, dots and ties, plus each bar's
 * largest beat width and the staff extents the row heights come from. Covers chords with
 * sharps, rests, dotted and double-dotted notes, triplets, grace notes, ties, notes off the
 * strings (MIDI), and the bass and percussion clefs. Written against the old
 * `assets/js/vexflowClassical.ts`; drawing is covered by the e2e screenshot baselines.
 */

vi.mock('../src/services/audio/audioGraph', () =>
  import('./helpers/legacyMocks').then((m) => m.audioGraphModule),
)
vi.mock('../src/services/playback', () => import('./helpers/legacyMocks').then((m) => m.playbackModule))
vi.mock('../src/services/midi/liveInput', () =>
  import('./helpers/legacyMocks').then((m) => m.liveInputModule),
)
type SongType = (typeof import('../src/stores/song'))['default']
type Beat = import('../src/stores/song').Beat
type Note = import('../src/stores/song').Note
type Notation = {
  computeVexFlowDataStructures(trackId: number, voiceId: number): void
  syncLayoutMetrics(): boolean
  allNotes: { note: unknown; tied: boolean[]; strings: number[] }[][]
  blockBeatWidths: number[]
}

let Song: SongType
let notation: Notation
let layout: typeof import('../src/stores/classicalNotationLayoutState')

beforeEach(async () => {
  Song = (await import('../src/stores/song')).default
  layout = await import('../src/stores/classicalNotationLayoutState')
  notation = (await import('../src/services/notation/classicalNotation')).default as unknown as Notation
  Song.initEmptySong()
})

const note = (fret: number, extra: Partial<Note> = {}): Note => ({ ...Song.defaultNote(), fret, ...extra })

function beat(duration: string, notes: Record<number, Note> = {}, extra: Partial<Beat> = {}): Beat {
  const b = { ...Song.defaultMeasure(), duration: duration as never, notes: [] as (Note | null)[], ...extra }
  for (const [string, n] of Object.entries(notes)) b.notes[Number(string)] = n
  return b
}

/** Describes a converted beat: keys, duration, modifiers (accidentals, grace), dots, ties. */
function describeNote(entry: Notation['allNotes'][number][number]) {
  const note = entry.note as {
    getKeys(): string[]
    getDuration(): string
    isRest(): boolean
    getModifiers(): { getCategory(): string; getIndex(): number; type?: string }[]
    getDots?(): unknown[]
  }
  return {
    keys: note.getKeys().join(' '),
    duration: note.getDuration() + (note.isRest() ? 'r' : ''),
    modifiers: note
      .getModifiers()
      .map(
        (modifier) =>
          `${modifier.getCategory()}@${modifier.getIndex()}${modifier.type ? `:${modifier.type}` : ''}`,
      )
      .join(' '),
    tied: entry.tied.join(','),
    strings: entry.strings.join(','),
  }
}

/** The first `bars` bars (the rest of the empty song is rests). */
function convert(trackId = 0, bars = 3) {
  Song.currentTrackId = trackId
  notation.computeVexFlowDataStructures(trackId, 0)
  notation.syncLayoutMetrics()
  return {
    bars: notation.allNotes.slice(0, bars).map((bar) => bar.map(describeNote)),
    beatWidths: notation.blockBeatWidths.slice(0, bars).map((width) => Math.round(width)),
    extents: Object.fromEntries(
      Object.entries(layout.classicalNotationLayoutState.staffExtentsByBlock ?? {}).filter(
        ([block]) => Number(block) < bars,
      ),
    ),
  }
}

describe('classical notation conversion', () => {
  it('converts a guitar track', () => {
    const triplet = (fret: number) => beat('e', { 2: note(fret) }, { tuplet: 3, tupletId: 0 })
    Song.measures[0][0][0] = [
      beat('q', { 0: note(0), 1: note(2), 2: note(2), 3: note(1) }), // E major: g# gets a sharp
      beat('qr'),
      beat('q', { 5: note(3) }),
      beat('e', { 4: note(1, { graceObj: { fret: 3, duration: 's' } as never }) }),
    ]
    Song.measures[0][1][0] = [
      beat('h', { 3: note(2, { tieBegin: true }) }),
      beat('s', { 3: note(2, { tied: true }) }),
      beat('s', {}, { otherNotes: [{ ...note(0), height: 30 }] }),
    ]
    Song.measures[0][2][0] = [
      triplet(0),
      triplet(2),
      triplet(3),
      beat('h', { 5: note(12) }),
      beat('q', { 0: note(0) }),
    ]
    expect(convert()).toMatchSnapshot()
  })

  it('draws dots on dotted and double-dotted notes and rests', () => {
    // the old code called `addDotToAll`, which VexFlow 4 doesn't have: any dotted note threw
    Song.measures[0][0][0] = [
      beat('q', { 0: note(0), 2: note(2) }, { dotted: true }),
      beat('e', { 1: note(3) }),
      beat('q', { 3: note(0) }, { doubleDotted: true }),
      beat('s', { 3: note(2) }),
      beat('qr', {}, { dotted: true }),
    ]
    const { bars } = convert(0, 1)
    expect(bars[0].map((entry) => `${entry.duration} ${entry.keys} [${entry.modifiers}]`))
      .toMatchInlineSnapshot(`
      [
        "q e/3 e/4 [Dot@0 Dot@1]",
        "8 c/4 []",
        "q g/4 [Dot@0 Dot@0]",
        "16 a/4 []",
        "qr b/4 [Dot@0]",
      ]
    `)
  })

  it('uses the bass clef for four strings and the percussion clef for drums', () => {
    Song.tracks[0] = { ...Song.tracks[0], strings: [28, 33, 38, 43], numStrings: 4 }
    Song.measures[0][0][0] = [beat('h', { 0: note(0), 2: note(5) }), beat('h', { 3: note(7) })]
    const bass = convert()

    Song.initEmptySong()
    Song.playBackInstrument[0] = { ...Song.playBackInstrument[0], instrument: 'drums' }
    Song.measures[0][0][0] = [beat('q', { 0: note(36), 1: note(42) }), beat('q', { 0: note(38) }), beat('hr')]
    const drums = convert()
    expect({
      bass: bass.bars[0],
      drums: drums.bars[0],
      bassExtents: bass.extents[0],
      drumExtents: drums.extents[0],
    }).toMatchSnapshot()
  })
})
