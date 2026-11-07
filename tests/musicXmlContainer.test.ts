import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { decodeXmlBytes, extractMxl } from '../src/services/musicXmlImport'

// In node, not jsdom: fflate doesn't recognise jsdom's Uint8Array when zipping.
describe('compressed MusicXML (.mxl)', () => {
  const score = '<?xml version="1.0"?><score-partwise/>'

  it('reads the root file named in META-INF/container.xml', () => {
    const archive = zipSync({
      'META-INF/container.xml': strToU8(
        `<?xml version="1.0"?><container><rootfiles><rootfile full-path='score/song.musicxml' media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>`,
      ),
      'other.xml': strToU8('<not-it/>'),
      'score/song.musicxml': strToU8(score),
    })
    expect(extractMxl(archive)).toBe(score)
  })

  it('falls back to the first score file when there is no container', () => {
    expect(extractMxl(zipSync({ 'song.xml': strToU8(score) }))).toBe(score)
  })

  it('reports archives without a score, and bytes that are no archive', () => {
    expect(() => extractMxl(zipSync({ 'META-INF/container.xml': strToU8('<container/>') }))).toThrow(
      /no score/,
    )
    expect(() => extractMxl(new Uint8Array([1, 2, 3]))).toThrow(/not a valid \.mxl/)
  })

  it('decodes UTF-16 files with a byte-order mark', () => {
    const utf16 = new Uint8Array([0xff, 0xfe, ...[...'<a/>'].flatMap((c) => [c.charCodeAt(0), 0])])
    expect(decodeXmlBytes(utf16)).toBe('<a/>')
  })
})
