import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { waitForEditorShell } from './helpers'
import { loadEffectsShowcase } from './fixtures/effectsShowcase'
import { songFingerprintSource } from './fixtures/songFingerprint'

/**
 * Audit Big win 7: MIDI export and MusicXML import, through the app's own modules and its
 * menus. The MusicXML round trip compares what MusicXML can hold; the effects it has no
 * element for (let ring, palm mute, vibrato, whammy bar…) are listed in HANDOVER.
 */

// Fingerprint fields MusicXML doesn't carry, or carries differently (see HANDOVER 3.41).
const NOT_IN_MUSICXML = new Set([
  'letRing',
  'palmMute',
  'vibrato',
  'tremoloBar',
  'fadeIn',
  'tap',
  'slap',
  'pop',
  // MusicXML has no strum speed; the importer uses a 16th, as for GPIF.
  'strokeLength',
])

function withoutLostFields(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value), (key, entry) => {
    if (NOT_IN_MUSICXML.has(key)) return undefined
    // Notes by string; a missing entry and a null (both: nothing on that string) are the same.
    if (key === 'notes' && Array.isArray(entry))
      return Object.fromEntries(entry.flatMap((note, string) => (note == null ? [] : [[string, note]])))
    return entry
  })
}

/** Lists differing paths between two JSON values. */
function diff(a: unknown, b: unknown, path = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return []
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
    return [...keys].flatMap((key) =>
      diff((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}/${key}`),
    )
  }
  return [`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`]
}

test('the effects showcase survives a MusicXML export and re-import', async ({ page }) => {
  await waitForEditorShell(page)
  await loadEffectsShowcase(page)
  const before = await page.evaluate(songFingerprintSource())
  await page.evaluate(async () => {
    const { songAsMusicXml } = await import('/src/services/songExport.ts')
    const { importSongFile } = await import('/src/services/songImport.ts')
    await importSongFile('showcase.musicxml', new TextEncoder().encode(songAsMusicXml()))
  })
  const after = await page.evaluate(songFingerprintSource())
  expect(diff(withoutLostFields(before), withoutLostFields(after))).toEqual([])
})

test('a .musicxml file opens through the file picker', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await waitForEditorShell(page, { demo: 'arrangement' })
  const { xml, tracks } = await page.evaluate(async () => {
    const { songAsMusicXml } = await import('/src/services/songExport.ts')
    const { default: Song } = await import('/src/stores/song.ts')
    return { xml: songAsMusicXml(), tracks: Song.tracks.map((track) => track.name) }
  })
  await page.evaluate(async () => {
    const { default: Song } = await import('/src/stores/song.ts')
    Song.initEmptySong()
  })
  page.on('dialog', (dialog) => void dialog.accept())
  await page
    .locator('input[type="file"][accept*=".musicxml"]')
    .first()
    .setInputFiles({ name: 'arrangement.musicxml', mimeType: 'application/xml', buffer: Buffer.from(xml) })
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await import('/src/stores/song.ts')).default.tracks.map((track) => track.name),
      ),
    )
    .toEqual(tracks)
  expect(errors).toEqual([])
})

test('Save as → MIDI downloads a file that reads back to the same notes', async ({ page }) => {
  await waitForEditorShell(page)
  const pitches = () =>
    page.evaluate(async () => {
      const { default: Song } = await import('/src/stores/song.ts')
      const strings = Song.tracks[0].strings
      return Song.measures[0].map((block) =>
        block[0].flatMap((beat) =>
          beat.notes.flatMap((note, string) => (note ? [strings[string] + note.fret] : [])),
        ),
      )
    })
  const before = await pitches()

  await page.locator('#downloadGP').click()
  const downloading = page.waitForEvent('download')
  await page.locator('#download-midi-bars').click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/\.mid$/)
  const bytes = readFileSync((await download.path())!)
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('MThd')

  await page.evaluate(
    async (data) => {
      const { importSongFile } = await import('/src/services/songImport.ts')
      await importSongFile('riff.mid', new Uint8Array(data))
    },
    [...bytes],
  )
  // The MIDI reader quantizes to sixteenths and picks its own strings; the pitches stay. It
  // builds bars up to the last note, so the riff's empty bars at the end are not there.
  const after = await pitches()
  expect(after).toEqual(before.slice(0, after.length))
  expect(before.slice(after.length).flat()).toEqual([])
})
