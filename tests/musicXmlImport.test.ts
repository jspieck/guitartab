// @vitest-environment jsdom
// (jsdom for the XML parser, as in the GPIF import tests.)
import { describe, expect, it } from 'vitest'
import { buildMusicXml, type MusicXmlSource } from '../src/services/musicXmlExport'
import { parseMusicXml, splitQuarters } from '../src/services/musicXmlImport'
import type { Beat } from '../src/types/song'
import { beat, description, meta, note, track } from './helpers/songBuilders'

/** What a voice holds, compactly: duration code (+ . for dots, /n for tuplets) and string:fret per note. */
function shape(beats: Beat[]): string[] {
  return beats.map((b) => {
    const notes = b.notes.flatMap((n, s) => (n ? [`${s}:${n.fret}${n.tied ? '~' : ''}`] : []))
    const length = `${b.duration}${b.dotted ? '.' : ''}${b.doubleDotted ? '..' : ''}${b.tuplet ? `/${b.tuplet}` : ''}`
    return notes.length > 0 ? `${length} ${notes.join(',')}` : length
  })
}

function exported(source: MusicXmlSource) {
  return parseMusicXml(buildMusicXml(source))
}

function guitarSong(): MusicXmlSource {
  return {
    description: description({
      title: 'Round & Trip',
      artist: 'Composer',
      writer: 'Poet',
      author: 'Arranger',
      copyright: '2026',
    }),
    tracks: [
      track('Guitar', { capo: 2 }),
      track('Drums', { strings: [0, 0, 0, 0, 0, 0], channel: { index: 9, effectChannel: 9 } }),
    ],
    measureMeta: [
      meta(4, 4, {
        bpm: 132,
        repeatOpen: true,
        marker: { text: 'Verse', color: { red: 0, green: 0, blue: 0 } },
        directionTargets: ['Segno'],
      }),
      meta(3, 4, { repeatClose: 2, repeatAlternative: 1 }),
      meta(3, 4, { repeatAlternative: 2, directionJumps: ['DaSegnoAlCoda'] }),
    ],
    measures: [
      [
        [
          [
            beat(
              'q',
              { 0: note(3, { pullDown: true }) },
              { dynamic: 'f', dynamicPresent: true, lyrics: ['Hel-'] },
            ),
            beat('q', { 0: note(5) }, { lyrics: ['lo'] }),
            beat('e', { 3: note(2) }, { tuplet: 3 }),
            beat('e', { 3: note(4, { stacatto: true }) }, { tuplet: 3 }),
            beat('e', { 3: note(2, { accentuated: true }) }, { tuplet: 3 }),
            beat('q', { 5: note(7, { tieBegin: true }) }),
          ],
          [beat('h'), beat('h', { 1: note(2) })],
        ],
        [
          [beat('h', { 5: note(7, { tied: true }), 4: note(5, { dead: true }) }, { dotted: true })],
          [beat('w')],
        ],
        [
          [
            beat('q', {
              2: note(2, {
                bendObj: [
                  { bendPosition: 0, bendValue: 0, vibrato: 0 },
                  { bendPosition: 60, bendValue: 100, vibrato: 0 },
                ],
              }),
            }),
            beat(
              'q',
              { 1: note(5, { artificialStyle: 'N.H.' }), 2: note(5, { ghost: true }) },
              { dotted: true },
            ),
            beat('s', { 4: note(3, { slide: true }) }),
            beat('s', { 4: note(5) }),
          ],
          [beat('w')],
        ],
      ],
      [
        [[beat('h', { 0: note(36), 1: note(42) }), beat('h')], [beat('w')]],
        [[beat('h', {}, { dotted: true })], [beat('w')]],
        [[beat('q', { 2: note(38) }), beat('h')], [beat('w')]],
      ],
    ],
  }
}

describe('MusicXML import: our own export reads back', () => {
  const song = exported(guitarSong())

  it('keeps title and credits, tracks, tuning, capo and the drum channel', () => {
    expect(song.description).toMatchObject({
      title: 'Round & Trip',
      artist: 'Composer',
      writer: 'Poet',
      author: 'Arranger',
      copyright: '2026',
    })
    expect(song.tracks.map((t) => [t.name, t.strings, t.capo, t.channel.index])).toEqual([
      ['Guitar', [40, 45, 50, 55, 59, 64], 2, 0],
      ['Drums', [0, 0, 0, 0, 0, 0], 0, 9],
    ])
    expect(song.tracks[0].program).toBe(25)
  })

  it('keeps bars: time signatures, tempo, repeats, voltas, marker and navigation signs', () => {
    expect(song.bpm).toBe(132)
    expect(song.measureMeta.map((bar) => [bar.numerator, bar.denominator, bar.timeMeterPresent])).toEqual([
      [4, 4, true],
      [3, 4, true],
      [3, 4, false],
    ])
    expect(song.measureMeta[0]).toMatchObject({
      repeatOpen: true,
      marker: { text: 'Verse' },
      directionTargets: ['Segno'],
    })
    expect(song.measureMeta[1]).toMatchObject({ repeatClose: 2, repeatAlternative: 1 })
    expect(song.measureMeta[2]).toMatchObject({ repeatAlternative: 2, directionJumps: ['DaSegnoAlCoda'] })
  })

  it('keeps key signatures, carried on to bars without a <key>', () => {
    const source = guitarSong()
    source.measureMeta.forEach((bar, i) => {
      bar.keySignature = i === 0 ? 3 : -2
      if (i > 0) bar.keyMinor = true
    })
    const xml = buildMusicXml(source)
    // the first part writes bar 1 and the change in bar 2, not bar 3
    expect(xml.split('<key>').length - 1).toBe(2 * source.tracks.length)
    const back = parseMusicXml(xml)
    expect(back.measureMeta.map((bar) => [bar.keySignature, bar.keyMinor ?? false])).toEqual([
      [3, false],
      [-2, true],
      [-2, true],
    ])
  })

  it('keeps clef changes and slashed beats', () => {
    const source = guitarSong()
    source.tracks[0].clefs = { 1: 'bass' }
    source.measures[0][2][0].forEach((beat) => (beat.slash = true))
    const xml = buildMusicXml(source)
    expect(xml).toContain('<clef><sign>F</sign><line>4</line>')
    expect(xml).toContain('<notehead>slash</notehead>')
    const back = parseMusicXml(xml)
    expect(back.tracks[0].clefs).toEqual({ 1: 'bass' })
    // slashed notes keep their strings and frets
    expect(shape(back.measures[0][2][0])).toEqual(shape(source.measures[0][2][0]))
    expect(back.measures[0][2][0].every((beat) => beat.slash)).toBe(true)
  })

  it('reads rhythm slashes from other programs as slashed rests', () => {
    const xml = buildMusicXml(guitarSong()).replace(
      /<note><pitch>(.*?)<\/pitch><duration>(\d+)<\/duration>(.*?)<\/note>/,
      '<note><pitch>$1</pitch><duration>$2</duration><voice>1</voice><type>quarter</type><notehead>slash</notehead></note>',
    )
    const first = parseMusicXml(xml).measures[0][0][0][0]
    expect(first.slash).toBe(true)
    expect(first.duration).toBe('qr')
  })

  it('keeps every beat on its string and fret, with lengths, tuplets, dots and ties', () => {
    const guitar = song.measures[0]
    expect(shape(guitar[0][0])).toEqual(['q 0:3', 'q 0:5', 'e/3 3:2', 'e/3 3:4', 'e/3 3:2', 'q 5:7'])
    expect(shape(guitar[0][1])).toEqual(['hr', 'h 1:2'])
    expect(shape(guitar[1][0])).toEqual(['h. 4:5,5:7~'])
    expect(shape(guitar[2][0])).toEqual(['q 2:2', 'q. 1:5,2:5', 's 4:3', 's 4:5'])
  })

  it('keeps note effects, dynamics and lyrics', () => {
    const [first, second, , triplet2, triplet3] = song.measures[0][0][0]
    expect(first.notes[0]).toMatchObject({ pullDown: true })
    expect(first).toMatchObject({ dynamic: 'f', dynamicPresent: true, lyrics: ['Hel-'] })
    expect(second).toMatchObject({ dynamic: 'f', dynamicPresent: false, lyrics: ['lo'] })
    expect(triplet2.notes[3]).toMatchObject({ stacatto: true })
    expect(triplet3.notes[3]).toMatchObject({ accentuated: true })
    expect(song.measures[0][1][0][0].notes[4]).toMatchObject({ dead: true })
    const [bent, harmonics, slid] = song.measures[0][2][0]
    expect(bent.notes[2]?.bendObj?.at(-1)?.bendValue).toBe(100)
    expect(harmonics.notes[1]).toMatchObject({ artificialStyle: 'N.H.' })
    expect(harmonics.notes[2]).toMatchObject({ ghost: true })
    expect(slid.notes[4]).toMatchObject({ slide: true })
  })

  it('reads drums as drum notes on their own lines', () => {
    const drums = song.measures[1]
    const hits = (beats: Beat[]) => beats.map((b) => b.notes.flatMap((n) => (n ? [n.fret] : [])).sort())
    expect(hits(drums[0][0])).toEqual([[36, 42], []])
    expect(hits(drums[2][0])).toEqual([[38], [], []].slice(0, drums[2][0].length))
  })

  it('keeps chord symbols and the trill partner', () => {
    const chord = (name: string) => ({
      name,
      capo: 0,
      frets: [],
      chordType: '',
      chordRoot: '',
      fingers: [],
      display: true,
    })
    const read = exported({
      description: description(),
      tracks: [track('Guitar')],
      measureMeta: [meta(4, 4)],
      measures: [
        [
          [
            [
              beat('q', { 0: note(3) }, { chord: chord('F#m7/C#') }),
              beat('q', { 0: note(3) }, { chord: chord('Bbsus4') }),
              beat('q', { 2: note(9, { trill: { fret: 11, period: 4 } }) }, { chord: chord('N.C.') }),
              beat('q', { 2: note(9, { trill: { fret: 10, period: 4 } }) }),
            ],
            [beat('w')],
          ],
        ],
      ],
    })
    const beats = read.measures[0][0][0]
    expect(beats.map((b) => b.chord?.name ?? b.text)).toEqual(['F#m7/C#', 'Bbsus4', 'N.C.', undefined])
    expect([beats[2].notes[2]?.trill?.fret, beats[3].notes[2]?.trill?.fret]).toEqual([11, 10])
  })

  it('reads grace notes and strokes', () => {
    const graced = note(5, {
      graceObj: {
        fret: 3,
        string: 3,
        height: 0,
        dynamic: 'mf',
        transition: 'none',
        duration: 's',
        setOnBeat: 'before',
        dead: false,
      },
    })
    const strum = {
      vibrato: false,
      fadeIn: false,
      tap: false,
      slap: false,
      pop: false,
      stroke: { strokeType: 'down' as const, strokeLength: 8 },
    }
    const read = exported({
      description: description(),
      tracks: [track('Guitar')],
      measureMeta: [meta(4, 4)],
      measures: [
        [
          [
            [beat('h', { 3: graced }), beat('h', { 0: note(0), 1: note(2) }, { effects: strum })],
            [beat('w')],
          ],
        ],
      ],
    })
    const [first, second] = read.measures[0][0][0]
    expect(first.notes[3]?.graceObj).toMatchObject({ fret: 3, setOnBeat: 'before', duration: 's' })
    expect(second.effects.stroke?.strokeType).toBe('down')
  })
})

const HEADER = '<?xml version="1.0" encoding="UTF-8"?>'

/** A MuseScore-style piano/lead sheet part: pitches only, small divisions, two voices via backup. */
const PITCH_ONLY = `${HEADER}
<score-partwise version="3.1">
  <work><work-title>Lead sheet</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name>
    <midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument>
  </score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions><key><fifths>-1</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <direction placement="above"><direction-type><metronome><beat-unit>half</beat-unit><per-minute>50</per-minute></metronome></direction-type></direction>
      <harmony><root><root-step>F</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type></note>
      <note><chord/><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type></note>
      <direction><direction-type><words>let ring</words></direction-type></direction>
      <direction><direction-type><dynamics><p/></dynamics></direction-type></direction>
      <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>3</duration><voice>1</voice><type>quarter</type><dot/></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>eighth</type><tie type="start"/></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type><tie type="stop"/></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>F</step><octave>2</octave></pitch><duration>8</duration><voice>2</voice><type>whole</type></note>
    </measure>
    <measure number="2">
      <note><rest measure="yes"/><duration>8</duration><voice>1</voice></note>
    </measure>
  </part>
</score-partwise>`

describe('MusicXML import: files from other programs', () => {
  it('places pitch-only notes on the strings, ties on the same string, a second voice and markings', () => {
    const song = parseMusicXml(PITCH_ONLY)
    expect(song.description.title).toBe('Lead sheet')
    expect(song.bpm).toBe(100)
    expect(song.measureMeta[0].keySignature).toBe(-1)
    const tuning = song.tracks[0].strings
    const pitches = (b: Beat) =>
      b.notes.flatMap((n, s) => (n ? [tuning[s] + n.fret] : [])).sort((x, y) => x - y)
    const [chord, dotted, tieStart, tieEnd] = song.measures[0][0][0]
    expect(pitches(chord)).toEqual([65, 69])
    expect(pitches(dotted)).toEqual([70])
    expect(dotted.dotted).toBe(true)
    expect(tieEnd.notes.findIndex((n) => n != null)).toBe(tieStart.notes.findIndex((n) => n != null))
    expect(tieEnd.notes.find((n) => n != null)?.tied).toBe(true)
    // Below the guitar's range: moved up an octave onto the low E string.
    expect(shape(song.measures[0][0][1])).toEqual(['w 0:1'])
    expect(chord.chord?.name).toBe('F')
    expect(dotted).toMatchObject({ text: 'let ring', dynamic: 'p', dynamicPresent: true })
    expect(shape(song.measures[0][1][0])).toEqual(['wr'])
  })

  it('applies <transpose> to written pitches (guitar parts written an octave up)', () => {
    const xml = `${HEADER}<score-partwise><part-list><score-part id="P1"><part-name>Gtr</part-name></score-part></part-list>
      <part id="P1"><measure number="1"><attributes><divisions>1</divisions><transpose><chromatic>0</chromatic><octave-change>-1</octave-change></transpose></attributes>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`
    expect(shape(parseMusicXml(xml).measures[0][0][0])).toEqual(['w 0:0'])
  })

  it('splits a length without a usable note type into tied values', () => {
    expect(splitQuarters(2.5).map((v) => `${v.code}${v.dotted ? '.' : ''}`)).toEqual(['h', 'e'])
    const xml = `${HEADER}<score-partwise><part-list><score-part id="P1"><part-name>Gtr</part-name></score-part></part-list>
      <part id="P1"><measure number="1"><attributes><divisions>2</divisions></attributes>
      <note><pitch><step>E</step><octave>2</octave></pitch><duration>5</duration></note>
      <note><rest/><duration>3</duration></note></measure></part></score-partwise>`
    expect(shape(parseMusicXml(xml).measures[0][0][0])).toEqual(['h 0:0', 'e 0:0~', 'qr.'])
  })

  it('maps drum instruments through midi-unpitched', () => {
    const xml = `${HEADER}<score-partwise><part-list><score-part id="P1"><part-name>Drumset</part-name>
      <score-instrument id="P1-I37"><instrument-name>Snare</instrument-name></score-instrument>
      <midi-instrument id="P1-I37"><midi-channel>10</midi-channel><midi-unpitched>39</midi-unpitched></midi-instrument></score-part></part-list>
      <part id="P1"><measure number="1"><attributes><divisions>1</divisions><clef><sign>percussion</sign></clef></attributes>
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>4</duration><instrument id="P1-I37"/><type>whole</type></note>
      </measure></part></score-partwise>`
    const song = parseMusicXml(xml)
    expect(song.tracks[0].channel.index).toBe(9)
    expect(song.measures[0][0][0][0].notes.find((n) => n != null)?.fret).toBe(38)
  })

  it('reports files it cannot read', () => {
    expect(() => parseMusicXml('<score-partwise><part')).toThrow(/well-formed/)
    // Timewise scores are read (turned into partwise first); an empty one has no parts.
    expect(() => parseMusicXml(`${HEADER}<score-timewise/>`)).toThrow(/no parts/)
    expect(() => parseMusicXml(`${HEADER}<html/>`)).toThrow(/not a MusicXML score/)
    expect(() => parseMusicXml(`${HEADER}<score-partwise><part-list/></score-partwise>`)).toThrow(/no parts/)
  })
})
