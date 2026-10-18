// @vitest-environment jsdom
// (jsdom for the XML parser the importer needs; happy-dom rejects CDATA.)
import { describe, expect, it } from 'vitest'
import type { Beat, Note } from '../src/assets/js/songData'
import { buildDemoArrangement } from '../src/data/demoArrangement'
import { buildGpif } from '../src/services/gpifExport'
import { parseGpif } from '../src/services/gpifImport'
import { decompressBcfz, extractGpifXml, readBcfsFiles } from '../src/services/gpContainers'
import { buildBcfs, buildGpxFile, compressBcfz } from '../src/services/gpxWriter'

const NOTE_KEYS: (keyof Note)[] = [
  'fret', 'tied', 'dead', 'ghost', 'accentuated', 'heavyAccentuated', 'palmMute', 'stacatto', 'letRing',
  'vibrato', 'slide', 'pullDown', 'tap', 'tremoloPicking', 'artificialStyle',
]

/** What a file format should keep of a song, per bar / beat / note (first voice). */
function summary(song: ReturnType<typeof buildDemoArrangement>) {
  const note = (value: Note | null) => (value == null ? null : {
    ...Object.fromEntries(NOTE_KEYS.filter((key) => value[key] != null && value[key] !== false).map((key) => [key, value[key]])),
    bend: value.bendObj?.map((point) => point.bendValue),
    grace: value.graceObj ? [value.graceObj.fret, value.graceObj.duration] : undefined,
    trill: value.trill?.fret,
  })
  const beat = (value: Beat) => ({
    d: value.duration,
    dotted: value.dotted,
    tuplet: value.tuplet != null && value.tuplet > 1 ? value.tuplet : null,
    text: value.text,
    chord: value.chord ? [value.chord.name, value.chord.frets.slice(0, 6)] : undefined,
    dynamic: value.dynamic,
    // The importer gives every brush a 16th; the length itself isn't stored in GPIF.
    stroke: value.effects.stroke?.strokeType,
    fadeIn: value.effects.fadeIn,
    slap: value.effects.slap,
    pop: value.effects.pop,
    whammy: value.effects.tremoloBar?.map((point) => point.value),
    notes: value.notes.map(note),
  })
  return {
    title: song.description.title,
    tracks: song.tracks.map((track) => [track.name, track.strings, track.program, track.channel.index]),
    bars: song.measureMeta.map((meta) => [meta.numerator, meta.denominator, meta.bpm, meta.repeatOpen, meta.repeatClose, meta.repeatAlternative, meta.marker?.text]),
    measures: song.measures.map((track) => track.map((block) => block[0].map(beat))),
  }
}

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
    expect(Array.from(readBcfsFiles(decompressBcfz(compressBcfz(image))).get('score.gpif')!)).toEqual(Array.from(text))
  })
})
