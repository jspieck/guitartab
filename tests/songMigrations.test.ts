import { describe, expect, it } from 'vitest'
import { beatHasText, migrateMeasureMeta, migrateSongMeasures } from '../src/services/songMigrations'

function legacyBeat(fields: Record<string, unknown>) {
  return { duration: 'q', notes: [], ...fields }
}

describe('song migrations', () => {
  it('turns textPresent + text into an optional text', () => {
    const kept = legacyBeat({ textPresent: true, text: 'Verse' })
    const hidden = legacyBeat({ textPresent: false, text: 'stale' })
    const empty = legacyBeat({ textPresent: true, text: '' })
    migrateSongMeasures([[[[kept, hidden, empty]]]])

    expect(kept).toEqual({ duration: 'q', notes: [], text: 'Verse' })
    expect(hidden).not.toHaveProperty('text')
    expect(empty).not.toHaveProperty('text')
    expect(hidden).not.toHaveProperty('textPresent')
  })

  it('turns chordPresent + chord into an optional chord', () => {
    const chord = {
      name: 'E',
      capo: 0,
      frets: [0, 0, 1, 2, 2, 0],
      fingers: [],
      chordType: '',
      chordRoot: 'E',
      display: true,
    }
    const kept = legacyBeat({ chordPresent: true, chord })
    const hidden = legacyBeat({ chordPresent: false, chord })
    const nulled = legacyBeat({ chord: null })
    migrateSongMeasures([[[[kept, hidden, nulled]]]])

    expect(kept.chord).toBe(chord)
    expect(kept).not.toHaveProperty('chordPresent')
    expect(hidden).not.toHaveProperty('chord')
    expect(nulled).not.toHaveProperty('chord')
  })

  it('turns note effect flags into optional data and drops stale defaults', () => {
    const curve = [
      { bendPosition: 0, bendValue: 0, vibrato: 0 },
      { bendPosition: 60, bendValue: 100, vibrato: 0 },
    ]
    const bent = {
      fret: 5,
      bendPresent: true,
      bendObj: curve,
      trillPresent: false,
      trill: { fret: 0, period: 0 },
    }
    const harmonic = {
      fret: 12,
      artificialPresent: true,
      artificialStyle: 'N.H.',
      gracePresent: false,
      graceObj: { fret: 0 },
    }
    const beat = legacyBeat({ notes: [bent, null, harmonic], gracePresent: false, graceObj: '' })
    migrateSongMeasures([[[[beat]]]])

    expect(bent).toEqual({ fret: 5, bendObj: curve })
    expect(harmonic).toEqual({ fret: 12, artificialStyle: 'N.H.' })
    expect(beat).not.toHaveProperty('gracePresent')
    expect(beat).not.toHaveProperty('graceObj')
  })

  it('is idempotent and tolerates sparse or malformed data', () => {
    const beat = legacyBeat({ text: 'Bridge' })
    const measures = [[[[beat, null]], undefined], null]
    migrateSongMeasures(measures)
    migrateSongMeasures(measures)
    migrateSongMeasures('not an array')
    expect(beat.text).toBe('Bridge')
  })

  it('turns bar flags into optional fields and keeps the first tempo', () => {
    const marker = { text: 'Chorus', color: { red: 1, green: 2, blue: 3 } }
    const legacy = (fields: Record<string, unknown>) => ({
      bpmPresent: false,
      bpm: 90,
      markerPresent: false,
      marker: { text: '', color: { red: 0, green: 0, blue: 0 } },
      repeatAlternativePresent: false,
      repeatAlternative: 0,
      repeatClosePresent: false,
      repeatClose: 0,
      ...fields,
    })
    const bars = [
      legacy({ bpmPresent: false, bpm: 100 }),
      legacy({ bpmPresent: true, bpm: 140, markerPresent: true, marker }),
      legacy({
        repeatClosePresent: true,
        repeatClose: 2,
        repeatAlternativePresent: true,
        repeatAlternative: 1,
      }),
    ]
    migrateMeasureMeta(bars)

    expect(bars[0]).toEqual({ bpm: 100 })
    expect(bars[1]).toEqual({ bpm: 140, marker })
    expect(bars[2]).toEqual({ repeatClose: 2, repeatAlternative: 1 })
  })

  it('beatHasText ignores missing and empty text', () => {
    expect(beatHasText({ text: 'x' })).toBe(true)
    expect(beatHasText({ text: '' })).toBe(false)
    expect(beatHasText({})).toBe(false)
    expect(beatHasText(null)).toBe(false)
  })
})
