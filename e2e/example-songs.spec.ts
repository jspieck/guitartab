import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations } from './axe'
import { waitForEditorShell } from './helpers'

// Example songs (audit Big win 23): MIDI files from public/examples/, converted on opening.

async function songInfo(page: Page) {
  return page.evaluate(async () => {
    const { default: Song } = await import('/src/stores/song.ts')
    const { isSongDirty } = await import('/src/services/songAutosave.ts')
    return {
      title: Song.songDescription.title,
      artist: Song.songDescription.artist,
      tracks: Song.tracks.map((track) => track.name),
      bars: Song.measures[0].length,
      dirty: isSongDirty(),
    }
  })
}

test.describe('example songs', () => {
  test('the File toolbar lists them with credits; Open loads one as a clean song', async ({ page }) => {
    await waitForEditorShell(page)
    await page.locator('#exampleSongs').click()
    const dialog = page.locator('#exampleSongsModal')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.example-song')).toHaveCount(14)
    await expectNoAxeViolations(page, '#exampleSongsModal')
    const romance = dialog.locator('.example-song', { hasText: 'Spanish Romance' })
    await expect(romance).toContainText('Typeset by Jeff Covey')
    await expect(romance.getByRole('link', { name: 'CC BY-SA 2.5' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/2.5/',
    )

    await romance.getByRole('button', { name: 'Open Spanish Romance' }).click()
    await expect(dialog).toBeHidden()
    await expect.poll(async () => (await songInfo(page)).title).toBe('Spanish Romance')
    expect(await songInfo(page)).toEqual({
      title: 'Spanish Romance',
      artist: 'Anonymous',
      tracks: ['Guitar'],
      bars: 32,
      dirty: false,
    })
    await expect(page.locator('.tab-row').first()).toBeVisible()
  })

  test('the first-run card offers them, and a duet opens with both parts', async ({ page }) => {
    // A first visit with the real demo shows the card.
    await page.goto('/')
    await page.waitForSelector('html[data-editor-ready]', { state: 'attached', timeout: 30_000 })
    await page.locator('#firstRunExampleSongs').click()
    await expect(page.locator('#firstRunHint')).toBeHidden()
    const dialog = page.locator('#exampleSongsModal')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Open Lullaby (Wiegenlied)' }).click()
    await expect.poll(async () => (await songInfo(page)).tracks).toEqual(['Recorder', 'Guitar'])
  })
})
