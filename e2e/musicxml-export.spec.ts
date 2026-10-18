import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { waitForEditorShell } from './helpers'
import { loadEffectsShowcase } from './fixtures/effectsShowcase'
import { buildGpArchive, readShowcaseGpif } from './fixtures/gpFiles'

/**
 * Exports the current song as MusicXML and checks it the way a notation program would read it:
 * well-formed XML, every voice filling its bar exactly, and every note of the song present at
 * the right pitch.
 */
async function checkExport(page: Page) {
  return page.evaluate(async () => {
    const { songAsMusicXml } = await import('/src/services/songExport.ts')
    const { default: Song } = await import('/src/assets/js/songData.ts')
    const { default: Duration } = await import('/src/assets/js/duration.ts')
    const xml = songAsMusicXml()
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    if (doc.getElementsByTagName('parsererror').length > 0) return { error: 'not well-formed' }

    const divisions = Number(doc.querySelector('divisions')?.textContent)
    const problems: string[] = []
    const parts = [...doc.querySelectorAll('part')]
    let exportedNotes = 0
    const exportedPitches: number[] = []
    const steps: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
    parts.forEach((part, trackId) => {
      const measures = [...part.querySelectorAll(':scope > measure')]
      if (measures.length !== Song.measureMeta.length)
        problems.push(`part ${trackId}: ${measures.length} measures`)
      measures.forEach((measure, blockId) => {
        // Bar length in quarters, from the editor's own duration math (64 = whole note).
        const barQuarters = Duration.getDurationOfBlock(blockId) / 16
        const totals = new Map<string, number>()
        for (const note of measure.querySelectorAll(':scope > note')) {
          if (note.querySelector('grace')) continue
          const pitch = note.querySelector('pitch')
          if (pitch) {
            const midi =
              (Number(pitch.querySelector('octave')!.textContent) + 1) * 12 +
              steps[pitch.querySelector('step')!.textContent!] +
              Number(pitch.querySelector('alter')?.textContent ?? 0)
            exportedPitches.push(midi)
          }
          if (pitch || note.querySelector('unpitched')) exportedNotes += 1
          if (note.querySelector('chord')) continue
          const voice = note.querySelector('voice')!.textContent!
          totals.set(voice, (totals.get(voice) ?? 0) + Number(note.querySelector('duration')!.textContent))
        }
        for (const [voice, total] of totals) {
          if (Math.abs(total / divisions - barQuarters) > 1e-6) {
            problems.push(
              `track ${trackId} bar ${blockId + 1} voice ${voice}: ${total / divisions} of ${barQuarters} quarters`,
            )
          }
        }
      })
    })

    // The song's own notes (voices 0 and 1), with the pitch the editor plays them at.
    const songPitches: number[] = []
    let songNotes = 0
    Song.measures.forEach((track, trackId) => {
      const { strings, capo } = Song.tracks[trackId]
      const drums = Song.tracks[trackId].channel.index === 9
      for (const block of track) {
        for (const voice of block.slice(0, 2)) {
          for (const beat of voice) {
            if (beat.duration.endsWith('r')) continue
            beat.notes.forEach((note, string) => {
              if (note == null) return
              songNotes += 1
              if (!drums) songPitches.push(strings[string] + note.fret + capo)
            })
          }
        }
      }
    })
    const sorted = (list: number[]) => [...list].sort((a, b) => a - b).join(',')
    return {
      error: '',
      parts: parts.length,
      problems,
      sameNoteCount: exportedNotes === songNotes,
      notes: songNotes,
      samePitches: sorted(exportedPitches) === sorted(songPitches),
    }
  })
}

test.describe('MusicXML export', () => {
  test('the effects showcase exports complete, well-formed bars', async ({ page }) => {
    await waitForEditorShell(page)
    await loadEffectsShowcase(page)
    const result = await checkExport(page)
    expect(result).toMatchObject({ error: '', problems: [], sameNoteCount: true, samePitches: true })
    expect(result.notes).toBeGreaterThan(20)
  })

  test('an imported GP7 song with drums, tuplets and two voices exports completely', async ({ page }) => {
    await waitForEditorShell(page)
    await page.evaluate(
      async (bytes) => {
        const { gProReader } = await import('/src/assets/js/GProReader.ts')
        gProReader.importSongBytes('showcase.gp', new Uint8Array(bytes))
      },
      Array.from(buildGpArchive(readShowcaseGpif())),
    )
    const result = await checkExport(page)
    expect(result).toMatchObject({
      error: '',
      parts: 2,
      problems: [],
      sameNoteCount: true,
      samePitches: true,
    })
  })

  test('the GP5 fixture exports complete bars', async ({ page }) => {
    await waitForEditorShell(page)
    await page.evaluate(
      async (bytes) => {
        const { gProReader } = await import('/src/assets/js/GProReader.ts')
        gProReader.importSongBytes('showcase.gp5', new Uint8Array(bytes))
      },
      Array.from(readFileSync('e2e/fixtures/files/showcase.gp5')),
    )
    expect(await checkExport(page)).toMatchObject({
      error: '',
      problems: [],
      sameNoteCount: true,
      samePitches: true,
    })
  })

  test('the download menu saves MusicXML and Guitar Pro 5 files', async ({ page }) => {
    await waitForEditorShell(page)
    await page.locator('#downloadGP').click()
    await expect(page.locator('#download-musicxml')).toBeVisible()
    const xmlDownload = page.waitForEvent('download')
    await page.locator('#download-musicxml').click()
    const xmlFile = await xmlDownload
    expect(xmlFile.suggestedFilename()).toMatch(/\.musicxml$/)
    expect(readFileSync((await xmlFile.path())!, 'utf-8')).toContain('<score-partwise version="4.0">')
    await expect(page.locator('#download-musicxml')).toHaveCount(0)

    await page.locator('#downloadGP').click()
    const gpDownload = page.waitForEvent('download')
    await page.locator('#download-gp5').click()
    const gpFile = await gpDownload
    expect(gpFile.suggestedFilename()).toMatch(/\.gp5$/)
    expect(
      readFileSync((await gpFile.path())!)
        .subarray(1, 25)
        .toString('latin1'),
    ).toMatch(/^FICHIER GUITAR PRO v5\.\d\d$/)

    // Escape and outside clicks close the menu.
    await page.locator('#downloadGP').click()
    await page.keyboard.press('Escape')
    await expect(page.locator('#download-gt')).toHaveCount(0)
  })
})
