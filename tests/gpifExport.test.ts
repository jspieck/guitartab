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
