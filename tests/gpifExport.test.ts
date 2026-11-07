// @vitest-environment jsdom
// (jsdom for the XML parser the importer needs; happy-dom rejects CDATA.)
import { describe, expect, it } from 'vitest'
import { buildDemoArrangement } from '../src/data/demoArrangement'
import { buildGpif } from '../src/services/gpifExport'
import { parseGpif } from '../src/services/gpifImport'
import { decompressBcfz, extractGpifXml, readBcfsFiles } from '../src/services/gpContainers'
import { buildBcfs, buildGpxFile, compressBcfz } from '../src/services/gpxWriter'
import { songSummary as summary } from './helpers/songSummary'

describe('GPIF / .gpx export', () => {
  it('the demo song survives .gpx export and import unchanged', () => {
    const demo = buildDemoArrangement()
    const file = buildGpxFile(buildGpif(demo))
    const back = parseGpif(extractGpifXml(file, 'gpx'), 'gpx')
    expect(JSON.parse(JSON.stringify(summary(back)))).toEqual(JSON.parse(JSON.stringify(summary(demo))))
  })

  it('writes lyrics as track lines and reads them back, as GP7 beat lyrics too', () => {
    const demo = buildDemoArrangement()
    const noteBeats = demo.measures[0].flatMap((bar) => bar[0].filter((beat) => beat.notes.some((n) => n)))
    noteBeats[2].lyrics = ['Hel-', 'two']
    noteBeats[3].lyrics = ['lo']
    noteBeats[5].lyrics = ['oh yeah ]]>']
    const lyrics = (song: typeof demo) =>
      song.measures.map((bars) => bars.map((bar) => bar[0].map((b) => b.lyrics)))
    const back = parseGpif(buildGpif(demo), 'gpx')
    expect(lyrics(back)).toEqual(lyrics(demo))

    // GP7 keeps a copy on each beat; those win over the track lines.
    const gp7 = buildGpif(demo).replace(
      /(<Beat id="\d+">)/,
      '$1<Lyrics><Line><![CDATA[First]]></Line><Line><![CDATA[]]></Line></Lyrics>',
    )
    const fromBeats = parseGpif(gp7, 'gp')
    const all = fromBeats.measures.flat(3).filter((beat) => beat.lyrics)
    expect(all.map((beat) => beat.lyrics)).toEqual([['First']])
  })

  it('writes navigation signs and reads them back', () => {
    const demo = buildDemoArrangement()
    demo.measureMeta[1].directionTargets = ['Segno', 'Fine']
    demo.measureMeta[2].directionJumps = ['DaSegnoAlFine']
    const back = parseGpif(buildGpif(demo), 'gp')
    expect(back.measureMeta.map((meta) => [meta.directionTargets, meta.directionJumps])).toEqual(
      demo.measureMeta.map((meta) => [meta.directionTargets, meta.directionJumps]),
    )
  })

  it('writes key signatures and reads them back', () => {
    const demo = buildDemoArrangement()
    demo.measureMeta.forEach((meta, i) => {
      meta.keySignature = i < 2 ? 0 : -3
      if (i >= 2) meta.keyMinor = true
    })
    const back = parseGpif(buildGpif(demo), 'gp')
    const keys = (bars: typeof demo.measureMeta) =>
      bars.map((meta) => [meta.keySignature, meta.keyMinor ?? false])
    expect(keys(back.measureMeta)).toEqual(keys(demo.measureMeta))
  })

  it('writes clef changes and slash beats and reads them back', () => {
    const demo = buildDemoArrangement()
    demo.tracks[0].clefs = { 1: 'bass', 3: 'treble8vb' }
    const slashed = demo.measures[0][2][0]
    slashed.forEach((beat) => (beat.slash = true))
    const xml = buildGpif(demo)
    expect(xml).toContain('<Clef>F4</Clef>')
    expect(xml).toContain('<Clef>G2</Clef><Ottavia>8vb</Ottavia>')
    const back = parseGpif(xml, 'gp')
    expect(back.tracks[0].clefs).toEqual({ 1: 'bass', 3: 'treble8vb' })
    // the bass keeps its automatic bass clef: no change recorded
    expect(back.tracks[2].clefs).toBeUndefined()
    expect(back.measures[0][2][0].map((beat) => beat.slash === true)).toEqual(slashed.map(() => true))
    expect(back.measures[0][1][0].some((beat) => beat.slash)).toBe(false)
  })

  it('writes well-formed GPIF with text safely wrapped', () => {
    const demo = buildDemoArrangement()
    demo.description.title = 'A <b>&</b> ]]> test'
    const xml = buildGpif(demo)
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
    expect(parseGpif(xml, 'gpx').description.title).toBe('A <b>&</b> ]]> test')
  })

  it('compresses BCFZ that the reader expands back exactly', () => {
    const text = new TextEncoder().encode('abcabcabcabc-xyz-'.repeat(500))
    const packed = compressBcfz(text)
    expect(Array.from(decompressBcfz(packed))).toEqual(Array.from(text))
    expect(packed.length).toBeLessThan(text.length / 5)
    // Mostly-empty BCFS sectors shrink to almost nothing.
    const image = buildBcfs({ 'score.gpif': text })
    expect(Array.from(readBcfsFiles(decompressBcfz(compressBcfz(image))).get('score.gpif')!)).toEqual(
      Array.from(text),
    )
  })
})
