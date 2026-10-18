// @vitest-environment jsdom
// (jsdom, not happy-dom: happy-dom's XML parser rejects CDATA, which GPIF uses for all text.)
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseGpif } from '../src/services/gpifImport'
import { ImportError } from '../src/services/importErrors'

const showcase = readFileSync('e2e/fixtures/files/showcase.gpif', 'utf-8')

/** The smallest score with one track and `bars` bars of quarter-note E's, with `extra` XML spliced in. */
function score({ track = '', masterBar = '', beat = '', note = '', bars = 1 } = {}): string {
  const masterBars = Array.from(
    { length: bars },
    (_, i) => `<MasterBar><Time>4/4</Time><Bars>${i}</Bars>${i === 0 ? masterBar : ''}</MasterBar>`,
  ).join('')
  const barList = Array.from(
    { length: bars },
    (_, i) => `<Bar id="${i}"><Voices>0 -1 -1 -1</Voices></Bar>`,
  ).join('')
  return `<GPIF><Tracks><Track id="0"><Name><![CDATA[T]]></Name>${track}</Track></Tracks>
    <MasterBars>${masterBars}</MasterBars><Bars>${barList}</Bars>
    <Voices><Voice id="0"><Beats>0 0 0 0</Beats></Voice></Voices>
    <Beats><Beat id="0"><Rhythm ref="0"/><Notes>0</Notes>${beat}</Beat></Beats>
    <Notes><Note id="0"><Properties><Property name="String"><String>0</String></Property><Property name="Fret"><Fret>0</Fret></Property></Properties>${note}</Note></Notes>
    <Rhythms><Rhythm id="0"><NoteValue>Quarter</NoteValue></Rhythm></Rhythms></GPIF>`
}

describe('GPIF import', () => {
  it('reads the showcase fixture without a browser', () => {
    const song = parseGpif(showcase, 'gp')
    expect(song.description.title).toBe('GPIF Showcase')
    expect(song.tracks.map((track) => track.name)).toEqual(['Lead Guitar', 'Drums'])
    expect(song.measureMeta.map((bar) => bar.bpm)).toEqual([100, undefined, 135, undefined])
    expect(song.measures[0][0][0].map((beat) => beat.duration)).toEqual(['q', 'q', 'q', 'qr'])
    expect(song.measures[1][0][0][0].notes.filter((note) => note != null).map((note) => note!.fret)).toEqual([
      36, 42,
    ])
  })

  it('reads GP6 track settings: tuning and capo on the track, GeneralMidi sound', () => {
    const song = parseGpif(
      score({
        track: `<Properties><Property name="Tuning"><Pitches>38 45 50 55 59 64</Pitches></Property>
        <Property name="CapoFret"><Fret>3</Fret></Property></Properties>
        <GeneralMidi table="Instrument"><Program>24</Program><PrimaryChannel>2</PrimaryChannel></GeneralMidi>`,
      }),
      'gpx',
    )
    expect(song.tracks[0]).toMatchObject({
      strings: [38, 45, 50, 55, 59, 64],
      capo: 3,
      program: 24,
      channel: { index: 2 },
    })
  })

  it('splits GP6 grand-staff instruments into two tracks', () => {
    const xml = score({ track: '<Instrument ref="a-piano-gs"/>' }).replace(
      '<Bars>0</Bars>',
      '<Bars>0 0</Bars>',
    )
    const song = parseGpif(xml, 'gpx')
    expect(song.tracks.map((track) => track.name)).toEqual(['T 1', 'T 2'])
    expect(song.measures).toHaveLength(2)
  })

  it('places pitch-only (piano) notes on free strings at the lowest fret', () => {
    const xml = score().replace(
      '<Properties><Property name="String"><String>0</String></Property><Property name="Fret"><Fret>0</Fret></Property></Properties>',
      '<Properties><Property name="Midi"><Number>69</Number></Property></Properties>',
    )
    const notes = parseGpif(xml, 'gp').measures[0][0][0][0].notes
    // A4 (69) fits lowest on the high E string, fret 5.
    expect(notes.map((note) => note?.fret ?? null)).toEqual([null, null, null, null, null, 5])
  })

  it('reads tempo units, repeats and endings', () => {
    const song = parseGpif(
      score({
        bars: 2,
        masterBar: '<Repeat start="true" end="true" count="4"/><AlternateEndings>2 3</AlternateEndings>',
      }).replace(
        '</MasterBars>',
        '</MasterBars><MasterTrack><Automations><Automation><Type>Tempo</Type><Bar>1</Bar><Value>60 4</Value></Automation></Automations></MasterTrack>',
      ),
      'gp',
    )
    expect(song.measureMeta[0]).toMatchObject({
      bpm: 120,
      repeatOpen: true,
      repeatClose: 3,
      repeatAlternative: 0b110,
    })
    // 60 half notes per minute = 120 quarters
    expect(song.measureMeta[1].bpm).toBe(120)
  })

  it('rejects scores that are not GPIF or have nothing in them', () => {
    expect(() => parseGpif('<html></html>', 'gp')).toThrow(ImportError)
    expect(() => parseGpif('<GPIF><Tracks>', 'gp')).toThrow(ImportError)
    expect(() => parseGpif('<GPIF><Tracks></Tracks></GPIF>', 'gp')).toThrow(/no tracks/)
    expect(() =>
      parseGpif(score().replace(/<MasterBars>.*<\/MasterBars>/s, '<MasterBars></MasterBars>'), 'gp'),
    ).toThrow(/no bars/)
  })
})
