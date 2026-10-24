// @vitest-environment jsdom
// (jsdom for the GPIF parser in the round-trip property; happy-dom rejects CDATA.)
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import Song, { type Beat, type MeasureMetaInfo, type Note } from '../src/stores/song'
import { buildDemoArrangement } from '../src/data/demoArrangement'
import { extractGpifXml } from '../src/services/gpContainers'
import { buildGpif } from '../src/services/gpifExport'
import { parseGpif } from '../src/services/gpifImport'
import { buildGpxFile } from '../src/services/gpxWriter'
import { DurationReplacer, type Beat as RhythmBeat } from '../src/utils/durationReplacer'
import { songSummary } from './helpers/songSummary'

/**
 * Property tests: fast-check generates many inputs and shrinks a failure to a minimal case.
 * A failure prints the seed; rerun it with fc.assert(..., { seed, path }) to reproduce.
 */

const PLAIN_DURATIONS = ['w', 'h', 'q', 'e', 's', 't'] as const
const TUPLETS = [3, 5, 6, 7, 9, 10, 11, 12, 13] as const

const rhythmBeat = fc
  .record({
    duration: fc.constantFrom(...PLAIN_DURATIONS),
    dotted: fc.boolean(),
    hasNotes: fc.boolean(),
  })
  .map(({ duration, dotted, hasNotes }): RhythmBeat => ({
    duration: hasNotes ? duration : `${duration}r`,
    dotted,
    doubleDotted: false,
    tuplet: null,
    tupletId: 0,
    hasNotes,
  }))

describe('durations and bar filling (properties)', () => {
  it('rests for any free space add up exactly to it, using standard note values', () => {
    // Every multiple of a 128th up to four whole notes.
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 512 }), (halfTicks) => {
        const ticks = halfTicks / 2
        const rests = DurationReplacer.decompose(ticks)
        expect(rests.reduce((sum, rest) => sum + rest.ticks, 0)).toBeCloseTo(ticks, 9)
        for (const rest of rests) {
          expect(DurationReplacer.codeFromTicks(DurationReplacer.ticksOf(rest.duration))).toBe(rest.duration)
        }
        // Greedy from the longest value down: no two rests could merge into one plain note.
        const plain = rests.filter((rest) => !rest.dotted && !rest.doubleDotted).map((rest) => rest.ticks)
        expect(new Set(plain).size).toBe(plain.length)
      }),
    )
  })

  it('changing a note length keeps the bar length (or refuses the change)', () => {
    fc.assert(
      fc.property(
        fc.array(rhythmBeat, { minLength: 1, maxLength: 12 }),
        fc.nat(),
        fc.constantFrom(...PLAIN_DURATIONS),
        (beats, pick, newDuration) => {
          const index = pick % beats.length
          const before = DurationReplacer.measureTotalTicks(beats)
          const result = DurationReplacer.changeDuration(beats, index, newDuration)
          if (!result.success) {
            expect(result.beats).toEqual(beats)
            return
          }
          expect(DurationReplacer.measureTotalTicks(result.beats)).toBeCloseTo(before, 9)
          expect(DurationReplacer.baseDuration(result.beats[index].duration)).toBe(newDuration)
          // Only rests are added or removed around the changed beat.
          expect(result.beats.filter((beat) => beat.hasNotes).length).toBe(
            beats.filter((beat) => beat.hasNotes).length,
          )
        },
      ),
    )
  })

  it('shortening a note and lengthening it again restores the bar length', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('w', 'h', 'q', 'e'),
        fc.constantFrom('h', 'q', 'e', 's', 't'),
        (longer, shorter) => {
          fc.pre(DurationReplacer.ticksOf(shorter) < DurationReplacer.ticksOf(longer))
          const bar: RhythmBeat[] = [
            {
              duration: longer,
              dotted: false,
              doubleDotted: false,
              tuplet: null,
              tupletId: 0,
              hasNotes: true,
            },
          ]
          const shrunk = DurationReplacer.changeDuration(bar, 0, shorter)
          const grown = DurationReplacer.changeDuration(shrunk.beats, 0, longer)
          expect(grown.success).toBe(true)
          expect(grown.beats).toEqual(bar)
        },
      ),
    )
  })

  it('a full tuplet group lasts as long as the notes it replaces', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TUPLETS), fc.constantFrom('q', 'e', 's', 't'), (tuplet, duration) => {
        const member: RhythmBeat = {
          duration,
          dotted: false,
          doubleDotted: false,
          tuplet,
          tupletId: 1,
          hasNotes: true,
        }
        const group = Array.from({ length: tuplet }, () => member)
        const replaced = DurationReplacer.tupletSubstitutedNotes(tuplet) * DurationReplacer.ticksOf(duration)
        expect(DurationReplacer.measureTotalTicks(group)).toBeCloseTo(replaced, 9)
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Export → import round trip with generated songs

const STRINGS = 6
// The importer trims texts (GPIF is often pretty-printed), so generate trimmed, non-blank ones.
const text = (maxLength: number) =>
  fc
    .string({ minLength: 1, maxLength })
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
const NOTE_FLAGS = [
  'palmMute',
  'letRing',
  'dead',
  'ghost',
  'accentuated',
  'heavyAccentuated',
  'stacatto',
  'vibrato',
] as const

const noteArb = fc.record({
  fret: fc.integer({ min: 0, max: 24 }),
  flags: fc.subarray([...NOTE_FLAGS], { maxLength: 2 }),
})

const beatArb = fc.record({
  duration: fc.constantFrom(...PLAIN_DURATIONS),
  dotted: fc.boolean(),
  // string → note; an empty map is a rest
  notes: fc.dictionary(fc.integer({ min: 0, max: STRINGS - 1 }).map(String), noteArb, { maxKeys: 3 }),
  text: fc.option(text(12), { nil: undefined }),
})

const barArb = fc.record({
  numerator: fc.integer({ min: 1, max: 12 }),
  denominator: fc.constantFrom(2, 4, 8, 16),
  bpm: fc.integer({ min: 40, max: 240 }),
  repeatOpen: fc.boolean(),
  marker: fc.option(text(10), { nil: undefined }),
  beats: fc.array(beatArb, { minLength: 1, maxLength: 6 }),
})

function toBeat(spec: fc.ValueOf<typeof beatArb>): Beat {
  const beat = Song.defaultMeasure()
  beat.notes = new Array(STRINGS).fill(null)
  for (const [string, { fret, flags }] of Object.entries(spec.notes)) {
    const note: Note = { ...Song.defaultNote(), string: Number(string), fret }
    for (const flag of flags) (note as unknown as Record<string, boolean>)[flag] = true
    beat.notes[Number(string)] = note
  }
  const isRest = Object.keys(spec.notes).length === 0
  beat.duration = isRest ? `${spec.duration}r` : spec.duration
  beat.dotted = spec.dotted
  beat.tuplet = null
  beat.effects = Song.defaultMeasureEffects()
  if (spec.text) beat.text = spec.text
  return beat
}

function toMeta(
  spec: fc.ValueOf<typeof barArb>,
  index: number,
  previous?: fc.ValueOf<typeof barArb>,
): MeasureMetaInfo {
  const meta = Song.defaultMeasureMeta()
  meta.keySignature = 0
  meta.numerator = spec.numerator
  meta.denominator = spec.denominator
  meta.timeMeterPresent =
    index === 0 || previous?.numerator !== spec.numerator || previous?.denominator !== spec.denominator
  meta.bpm = spec.bpm
  meta.repeatOpen = spec.repeatOpen
  if (spec.marker) meta.marker = { text: spec.marker, color: { red: 200, green: 40, blue: 40 } }
  return meta
}

describe('GPIF export → import round trip (property)', () => {
  it('keeps every generated song', () => {
    const template = buildDemoArrangement()
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), text(20)),
        fc.array(barArb, { minLength: 1, maxLength: 6 }),
        (title, bars) => {
          const song = {
            ...template,
            description: { ...template.description, title },
            tracks: [template.tracks[1]],
            chords: [new Map()],
            measureMeta: bars.map((bar, index) => toMeta(bar, index, bars[index - 1])),
            measures: [bars.map((bar) => [bar.beats.map(toBeat)])],
          }
          const back = parseGpif(extractGpifXml(buildGpxFile(buildGpif(song)), 'gpx'), 'gpx')
          expect(JSON.parse(JSON.stringify(songSummary(back)))).toEqual(
            JSON.parse(JSON.stringify(songSummary(song))),
          )
        },
      ),
      { numRuns: 150 },
    )
  }, 30_000)
})
