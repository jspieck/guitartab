import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

/** Bars 1–2 of the riff's first voice as `syllable` per note beat (`_` none, `.` rest), verses joined by `/`. */
async function lyricsOf(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const { default: Song } = await import('/src/stores/song.ts')
    return Song.measures[0]
      .slice(0, 2)
      .map((bar) =>
        bar[0]
          .map((beat) => (beat.notes.some((note) => note != null) ? beat.lyrics?.join('/') || '_' : '.'))
          .join(' '),
      )
      .join(' | ')
  })
}

async function selectFirstBeat(page: Page): Promise<void> {
  await page
    .locator('.string-click-area')
    .first()
    .click({ position: { x: 80, y: 4 } })
}

test.describe('lyrics', () => {
  test('L opens the field; a typed line flows over the notes; Tab, ↓ and Enter; one undo per entry', async ({
    page,
  }) => {
    await waitForEditorShell(page)
    await selectFirstBeat(page)

    await page.keyboard.press('Shift+L')
    const field = page.locator('#lyricsEntryField')
    await expect(field).toBeFocused()
    await page.keyboard.type('Hel-lo  you')
    await page.keyboard.press('Tab')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.type('two')
    await page.keyboard.press('Enter')
    await expect(field).toHaveCount(0)

    // The double space skipped a note; Tab stored "you" and moved to bar 2, where ↓ chose verse 2.
    await expect.poll(() => lyricsOf(page)).toMatch(/^Hel- lo _ you[ .]* \| \/two _ _ _/)

    // Drawn under the tab, the hyphen between "Hel" and "lo".
    await expect(page.locator('.lyric-text').first()).toHaveText('Hel')
    await expect(page.locator('.lyric-text').nth(1)).toHaveText('-')

    await page.locator('#mainContent').focus()
    await page.keyboard.press('Control+z')
    await expect.poll(() => lyricsOf(page)).toMatch(/^Hel- lo _ you[ .]* \| _ _ _ _/)
  })

  test('lyrics survive GP5 and MusicXML export', async ({ page }) => {
    await waitForEditorShell(page)
    await selectFirstBeat(page)
    await page.keyboard.press('Shift+L')
    await page.keyboard.type('Hel-lo wör-ld ')
    await page.keyboard.press('Escape')
    const before = await lyricsOf(page)
    expect(before).toMatch(/^Hel- lo wör- ld/)

    const result = await page.evaluate(async () => {
      const { currentSongAsGp5 } = await import('/src/services/gp5Export.ts')
      const { buildMusicXml } = await import('/src/services/musicXmlExport.ts')
      const { importSongFile } = await import('/src/services/songImport.ts')
      const { default: Song } = await import('/src/stores/song.ts')
      const xml = buildMusicXml({
        description: Song.songDescription,
        tracks: Song.tracks,
        measureMeta: Song.measureMeta,
        measures: Song.measures,
      })
      await importSongFile('lyrics.gp5', currentSongAsGp5(), { quiet: true })
      return {
        lyricXml: (xml.match(/<lyric /g) ?? []).length,
        syllabic: xml.includes('<syllabic>begin</syllabic>'),
      }
    })
    expect(result).toEqual({ lyricXml: 4, syllabic: true })
    await expect.poll(() => lyricsOf(page)).toBe(before)
  })
})
