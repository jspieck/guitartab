import { describe, expect, it } from 'vitest'
import type { Beat, MeasureMetaInfo, Note, Track } from '../src/stores/song'
import {
  beatDivisions,
  buildMusicXml,
  escapeXml,
  fillerRests,
  musicXmlFileName,
  type MusicXmlSource,
} from '../src/services/musicXmlExport'

const QUARTER = 6720

function note(fret: number, extra: Partial<Note> = {}): Note {
  return {
    string: 0,
    fret,
    dead: false,
    height: 0,
    tied: false,
    tieBegin: false,
    tiedTo: { blockId: -1, beatId: -1 },
    palmMute: false,
    stacatto: false,
    tap: false,
    fadeIn: false,
    pop: false,
    slap: false,
    ghost: false,
    accentuated: false,
    heavyAccentuated: false,
    vibrato: false,
    tremoloPickingLength: 'e',
    tremoloPicking: false,
    pullDown: false,
    letRing: false,
    slide: false,
    velocity: 0,
    element: 0,
    octave: 0,
    tone: 0,
    ...extra,
  }
}

/** A beat; `notes` maps string index (0 = lowest) to a note. */
function beat(duration: string, notes: Record<number, Note> = {}, extra: Partial<Beat> = {}): Beat {
  const list: (Note | null)[] = new Array(6).fill(null)
  for (const [string, value] of Object.entries(notes)) list[Number(string)] = value
  const hasNotes = Object.keys(notes).length > 0
  return {
    duration: hasNotes ? duration : `${duration}r`,
    notes: list,
    effects: { vibrato: false, fadeIn: false, tap: false, slap: false, pop: false },
    dynamic: 'mf',
    otherNotes: [],
    tuplet: null,
    tupletId: 0,
    dotted: false,
    doubleDotted: false,
    dynamicPresent: false,
    empty: false,
    keySignature: '',
    noteIds: [],
    rhythmId: 0,
    ...extra,
  }
}

function meta(numerator: number, denominator: number, extra: Partial<MeasureMetaInfo> = {}): MeasureMetaInfo {
  return {
    numerator,
    denominator,
    timeMeterPresent: false,
    repeatOpen: false,
    keySignature: 0,
    automations: [],
    ...extra,
  }
}

function track(name: string, extra: Partial<Track> = {}): Track {
  return {
    name,
    numStrings: 6,
    capo: 0,
    strings: [40, 45, 50, 55, 59, 64],
    volume: 127,
    balance: 63,
    reverb: 0,
    color: { red: 0, green: 0, blue: 0 },
    channel: { index: 0, effectChannel: 0 },
    program: 25,
    primaryChannel: 0,
    ...extra,
  }
}

const description = {
  title: 'Test & <Song>',
  subtitle: '',
  artist: 'Someone',
  album: '',
  author: 'Me',
  music: '',
  copyright: '',
  writer: '',
  instructions: '',
  comments: [],
  wordsAndMusic: '',
}

function source(): MusicXmlSource {
  const guitar = [
    [
      [
        beat(
          'q',
          { 0: note(3, { pullDown: true }) },
          {
            dynamicPresent: true,
            dynamic: 'f',
            text: 'Riff',
            chord: {
              name: 'G',
              capo: 0,
              frets: [],
              chordType: '',
              chordRoot: '',
              fingers: [],
              display: true,
            },
          },
        ),
        beat('q', { 0: note(5) }),
        beat('e', { 3: note(2) }, { tuplet: 3 }),
        beat('e', { 3: note(4) }, { tuplet: 3 }),
        beat('e', { 3: note(2) }, { tuplet: 3 }),
        beat('q', { 5: note(7, { tieBegin: true }) }),
      ],
      [beat('w')],
    ],
    [
      [beat('h', { 5: note(7, { tied: true }), 4: note(5, { dead: true }) }, { dotted: true })],
      [
        beat('q', { 1: note(2) }),
        beat('h', {
          2: note(2, {
            bendObj: [
              { bendPosition: 0, bendValue: 0, vibrato: 0 },
              { bendPosition: 60, bendValue: 100, vibrato: 0 },
            ],
          }),
        }),
      ],
    ],
  ]
  const drums = [
    [[beat('h', { 0: note(36), 1: note(42) }), beat('h')], [beat('w')]],
    [[beat('h', {}, { dotted: true })], [beat('w')]],
  ]
  return {
    description,
    tracks: [
      track('Guitar'),
      track('Drums', { strings: [0, 0, 0, 0, 0, 0], channel: { index: 9, effectChannel: 9 } }),
    ],
    measureMeta: [
      meta(4, 4, {
        bpm: 120,
        repeatOpen: true,
        marker: { text: 'Intro', color: { red: 0, green: 0, blue: 0 } },
      }),
      meta(3, 4, { repeatClose: 1, repeatAlternative: 1 }),
    ],
    measures: [guitar, drums],
  }
}

/** Sums `<duration>` per voice in each measure of each part, skipping chord notes and graces. */
function voiceTotals(xml: string): number[][][] {
  return [...xml.matchAll(/<part id="[^"]+">(.*?)<\/part>/gs)].map(([, part]) =>
    [...part.matchAll(/<measure[^>]*>(.*?)<\/measure>/gs)].map(([, measure]) => {
      const totals = new Map<number, number>()
      for (const [, body] of measure.matchAll(/<note>(.*?)<\/note>/gs)) {
        if (body.includes('<chord/>') || body.includes('<grace')) continue
        const voice = Number(/<voice>(\d+)<\/voice>/.exec(body)![1])
        totals.set(voice, (totals.get(voice) ?? 0) + Number(/<duration>(\d+)<\/duration>/.exec(body)![1]))
      }
      return [...totals.keys()].sort().map((voice) => totals.get(voice)!)
    }),
  )
}

describe('MusicXML lyrics', () => {
  it('writes a lyric per verse on the first note of a beat, with syllabic across words and rests', () => {
    const source: MusicXmlSource = {
      description,
      tracks: [track('Guitar')],
      measureMeta: [meta(4, 4)],
      measures: [
        [
          [
            [
              beat('q', { 0: note(3), 1: note(5) }, { lyrics: ['Hel-', 'One'] }),
              beat('q'),
              beat('q', { 0: note(3) }, { lyrics: ['lo'] }),
              beat('q', { 0: note(3) }, { lyrics: ['you & me'] }),
            ],
          ],
        ],
      ],
    }
    const xml = buildMusicXml(source)
    const lyrics = [
      ...xml.matchAll(/<lyric number="(\d)"><syllabic>(\w+)<\/syllabic><text>([^<]*)<\/text><\/lyric>/g),
    ]
    expect(lyrics.map((m) => m.slice(1).join(' '))).toEqual([
      '1 begin Hel',
      '2 single One',
      '1 end lo',
      '1 single you &amp; me',
    ])
    // Once per beat, on its first (highest) note.
    expect(xml.split('<lyric ').length - 1).toBe(4)
  })
})

describe('MusicXML export', () => {
  it('computes beat lengths like the editor (dots, double dots, tuplets)', () => {
    expect(beatDivisions(beat('q'))).toBe(QUARTER)
    expect(beatDivisions(beat('h', {}, { dotted: true }))).toBe(QUARTER * 3)
    expect(beatDivisions(beat('q', {}, { doubleDotted: true }))).toBe(QUARTER * 1.75)
    expect(beatDivisions(beat('e', {}, { tuplet: 3 }))).toBe(QUARTER / 3)
    expect(beatDivisions(beat('s', {}, { tuplet: 7 }))).toBe(QUARTER / 7)
    expect(beatDivisions(beat('2'))).toBe(QUARTER / 64)
  })

  it('fills every voice of every bar exactly', () => {
    const totals = voiceTotals(buildMusicXml(source()))
    expect(totals).toEqual([
      [[QUARTER * 4], [QUARTER * 3, QUARTER * 3]], // guitar: voice 2 only where it plays
      [[QUARTER * 4], [QUARTER * 3]], // drums
    ])
  })

  it('pads short bars with rests', () => {
    const short = source()
    short.measures[0][0][0].pop() // the bar now holds 3 quarters of 4
    expect(voiceTotals(buildMusicXml(short))[0][0]).toEqual([QUARTER * 4])
    expect(fillerRests(QUARTER * 1.5, 1)).toBe(
      `<note><rest/><duration>${QUARTER}</duration><voice>1</voice><type>quarter</type></note>` +
        `<note><rest/><duration>${QUARTER / 2}</duration><voice>1</voice><type>eighth</type></note>`,
    )
  })

  it('writes pitch, string and fret with MusicXML string numbers (1 = highest)', () => {
    const xml = buildMusicXml(source())
    // Low E string, fret 3 = G2
    expect(xml).toContain('<pitch><step>G</step><octave>2</octave></pitch>')
    expect(xml).toContain('<string>6</string><fret>3</fret>')
    // High E string, fret 7 = B4
    expect(xml).toContain('<pitch><step>B</step><octave>4</octave></pitch>')
    expect(xml).toContain('<string>1</string><fret>7</fret>')
    expect(xml).toContain(
      '<staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>',
    )
  })

  it('pairs ties, hammer-ons and tuplets', () => {
    const xml = buildMusicXml(source())
    expect(xml.match(/<tie type="start"\/>/g)).toHaveLength(1)
    expect(xml.match(/<tie type="stop"\/>/g)).toHaveLength(1)
    expect(xml).toContain('<hammer-on type="start">H</hammer-on>')
    expect(xml).toContain('<hammer-on type="stop"/>')
    expect(xml.match(/<actual-notes>3<\/actual-notes><normal-notes>2<\/normal-notes>/g)).toHaveLength(3)
    expect(xml).toContain('<bend><bend-alter>2</bend-alter></bend>')
    expect(xml).toContain('<notehead>x</notehead>')
  })

  it('writes bar markings, directions and drums', () => {
    const xml = buildMusicXml(source())
    expect(xml).toContain('<repeat direction="forward"/>')
    expect(xml).toContain('<repeat direction="backward" times="2"/>')
    expect(xml).toContain('<ending number="1" type="start"/>')
    expect(xml).toContain('<ending number="1" type="stop"/>')
    expect(xml).toContain('<rehearsal>Intro</rehearsal>')
    expect(xml).toContain('<sound tempo="120"/>')
    expect(xml).toContain('<dynamics><f/></dynamics>')
    expect(xml).toContain('<words>Riff</words>')
    expect(xml).toContain('<time><beats>3</beats><beat-type>4</beat-type></time>')
    // Drum notes are unpitched, placed by their General MIDI note, on channel 10.
    expect(xml).toContain(
      '<unpitched><display-step>C</display-step><display-octave>2</display-octave></unpitched>',
    )
    expect(xml).toContain('<midi-channel>10</midi-channel>')
    // Each drum sound is an instrument with its exact MIDI note (the hi-hat's F♯ has no display-alter).
    expect(xml).toContain(
      '<midi-instrument id="P2-D42"><midi-channel>10</midi-channel><midi-unpitched>43</midi-unpitched>',
    )
    expect(xml).toContain('<instrument id="P2-D42"/>')
    // Tempo and rehearsal marks appear once, not per part.
    expect(xml.match(/<rehearsal>/g)).toHaveLength(1)
  })

  it('writes navigation signs with their playback meaning, once', () => {
    const song = source()
    song.measureMeta[0].directionTargets = ['Segno']
    song.measureMeta[1].directionTargets = ['Coda', 'Fine']
    song.measureMeta[1].directionJumps = ['DaSegnoAlCoda', 'DaCoda']
    const xml = buildMusicXml(song)
    expect(xml).toContain('<direction-type><segno/></direction-type><sound segno="segno"/>')
    expect(xml).toContain('<direction-type><coda/></direction-type><sound coda="coda"/>')
    expect(xml).toContain('<words>Fine</words></direction-type><sound fine="yes"/>')
    expect(xml).toContain('<words>D.S. al Coda</words></direction-type><sound dalsegno="segno"/>')
    expect(xml).toContain('<words>To Coda</words></direction-type><sound tocoda="coda"/>')
    expect(xml.match(/<segno\/>/g)).toHaveLength(1)
    // the jump comes after the bar's notes
    const bar2 = xml.split('<measure number="2">')[1].split('</measure>')[0]
    expect(bar2.lastIndexOf('<note')).toBeLessThan(bar2.indexOf('D.S. al Coda'))
  })

  it('escapes text and names the file after the title', () => {
    const xml = buildMusicXml(source())
    expect(xml).toContain('<work-title>Test &amp; &lt;Song&gt;</work-title>')
    expect(escapeXml(`a"b'c`)).toBe('a&quot;b&apos;c')
    expect(musicXmlFileName('My: Song?')).toBe('My Song.musicxml')
    expect(musicXmlFileName('[Title]')).toBe('song.musicxml')
  })
})
