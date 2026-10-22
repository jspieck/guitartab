import { describe, expect, it } from 'vitest'
import Duration from '../src/utils/duration'
import { buildDemoArrangement } from '../src/data/demoArrangement'

const song = buildDemoArrangement()
const PITCH_CLASSES: Record<string, number[]> = {
  Am: [9, 0, 4],
  Fmaj7: [5, 9, 0, 4],
  F: [5, 9, 0],
  C: [0, 4, 7],
  G: [7, 11, 2],
  Dm: [2, 5, 9],
  E: [4, 8, 11],
}

describe('demo song "Open Road"', () => {
  it('has four tracks on separate channels, drums on channel 10', () => {
    expect(song.tracks.map((track) => [track.name, track.channel.index, track.program])).toEqual([
      ['Acoustic Guitar', 0, 24],
      ['Lead Guitar', 1, 29],
      ['Bass', 2, 33],
      ['Drums', 9, 0],
    ])
    expect(song.measures.every((track) => track.length === song.measureMeta.length)).toBe(true)
  })

  it('fills every bar of every track exactly (4/4)', () => {
    const problems: string[] = []
    song.measures.forEach((track, t) =>
      track.forEach((block, bar) => {
        const total = block[0].reduce((sum, beat) => sum + Duration.getDurationOfNote(beat, false), 0)
        if (Math.abs(total - 64) > 1e-9)
          problems.push(`${song.tracks[t].name} bar ${bar + 1}: ${total / 16} quarters`)
      }),
    )
    expect(problems).toEqual([])
  })

  it('uses playable frets and only strings the track has', () => {
    for (const [t, track] of song.measures.entries()) {
      const drums = song.tracks[t].channel.index === 9
      for (const beat of track.flatMap((block) => block[0])) {
        expect(beat.notes).toHaveLength(song.tracks[t].numStrings)
        for (const note of beat.notes) {
          if (note == null) continue
          if (drums) expect(note.fret).toBeGreaterThanOrEqual(35)
          else expect(note.fret).toBeLessThanOrEqual(15)
        }
      }
    }
  })

  it('strums and arpeggiates the chords it names', () => {
    const { strings } = song.tracks[0]
    let current = ''
    for (const block of song.measures[0]) {
      for (const beat of block[0]) {
        if (beat.chord) current = beat.chord.name
        // Muted "x" strums have no pitch.
        const classes = beat.notes.flatMap((note, string) =>
          note == null || note.dead ? [] : [(strings[string] + note.fret) % 12],
        )
        for (const pitchClass of classes)
          expect(PITCH_CLASSES[current], `${current}: ${pitchClass}`).toContain(pitchClass)
      }
    }
  })

  it('plays the chord root in the bass on beat 1', () => {
    const roots = ['Am', 'Fmaj7', 'C', 'G', 'Am', 'F', 'C', 'G', 'G', 'Dm', 'F', 'E', 'E', 'Am'].map(
      (name) => PITCH_CLASSES[name][0],
    )
    const bass = song.tracks[2].strings
    song.measures[2].forEach((block, bar) => {
      const first = block[0][0].notes.findIndex((note) => note != null)
      expect((bass[first] + block[0][0].notes[first]!.fret) % 12, `bar ${bar + 1}`).toBe(roots[bar])
    })
  })

  it('only uses drum sounds the app has, and markers, repeat and tempo are set', () => {
    const kit = new Set([35, 36, 37, 38, 42, 45, 46, 48, 49, 51])
    const used = new Set(
      song.measures[3].flatMap((block) =>
        block[0].flatMap((beat) => beat.notes.flatMap((note) => (note ? [note.fret] : []))),
      ),
    )
    for (const note of used) expect(kit).toContain(note)
    expect(song.measureMeta.map((bar) => bar.marker?.text).filter(Boolean)).toEqual([
      'Intro',
      'Riff',
      'Solo',
      'Outro',
    ])
    expect(song.measureMeta).toHaveLength(14)
    expect([song.measureMeta[4].repeatOpen, song.measureMeta[7].repeatClose]).toEqual([true, 1])
    // 1st ending on bar 8, 2nd ending on bar 9
    expect([song.measureMeta[7].repeatAlternative, song.measureMeta[8].repeatAlternative]).toEqual([1, 2])
    expect([song.measureMeta[0].bpm, song.measureMeta[13].bpm]).toEqual([112, 100])
  })

  it('labels the techniques it shows', () => {
    const texts = song.measures.flatMap((track) =>
      track.flatMap((block) => block[0].flatMap((beat) => (beat.text ? [beat.text] : []))),
    )
    expect(texts).toEqual(
      expect.arrayContaining([
        'natural harmonics',
        'volume swell',
        'tapping',
        'tremolo picking',
        'whammy dip',
        'slap & pop',
        'ghost notes',
        'muted upstrokes',
      ]),
    )
    const lead = song.measures[1].flatMap((block) =>
      block[0].flatMap((beat) => beat.notes.filter((note) => note != null)),
    )
    // The full bend on the 8th fret of the G string is gone from the riff.
    expect(song.measures[1][5][0].some((beat) => beat.notes.some((note) => note?.bendObj != null))).toBe(
      false,
    )
    expect(lead.some((note) => note!.graceObj?.transition === 'slide')).toBe(true)
  })

  it('gives every beat its own effects, so editing one stroke leaves the rest alone', () => {
    const [first, second] = song.measures[0][4][0]
    expect(first.effects.stroke).toEqual(second.effects.stroke)
    expect(first.effects).not.toBe(second.effects)
    expect(first.effects.stroke).not.toBe(second.effects.stroke)
  })
})
