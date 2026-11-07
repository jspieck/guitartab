import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

const SHOWCASE_GP5 = 'e2e/fixtures/files/showcase.gp5'

const songState = (page: Page) =>
  page.evaluate(async () => {
    const { default: Song } = await import('/src/stores/song.ts')
    return { bars: Song.numMeasures, title: Song.songDescription.title }
  })

async function enterFret(page: Page, fret: string): Promise<void> {
  await page
    .locator('.tab-row')
    .first()
    .locator('.string-click-area')
    .first()
    .click({ position: { x: 80, y: 4 } })
  await page.keyboard.press(fret)
  await expect(
    page
      .locator('.tab-row')
      .first()
      .locator('.note-text')
      .filter({ hasText: new RegExp(`^${fret}$`) }),
  ).toHaveCount(1)
}

test.describe('destructive actions', () => {
  test('removing a bar offers Undo, which brings the bar back', async ({ page }) => {
    await waitForEditorShell(page)
    await page.locator('#barButton4').click()
    await page.locator('#addMeasure').click()
    const { bars } = await songState(page)

    await page.locator('#removeMeasure').click()
    await expect.poll(async () => (await songState(page)).bars).toBe(bars - 1)
    await expect(page.locator('#notificationLabel')).toHaveText(`Removed bar ${bars}`)
    const undo = page.locator('#notificationAction')
    await expect(undo).toBeVisible()
    await expect(undo).toHaveText('Undo')

    await undo.click()
    await expect.poll(async () => (await songState(page)).bars).toBe(bars)
    await expect(page.locator('#notificationEmblem')).toBeHidden()
  })

  test('the Undo button does nothing once another edit came after the removal', async ({ page }) => {
    await waitForEditorShell(page)
    await page.locator('#barButton4').click()
    await page.locator('#addMeasure').click()
    await page.locator('#addMeasure').click()
    const { bars } = await songState(page)

    await page.locator('#removeMeasure').click()
    await page.locator('#addMeasure').click()
    await expect.poll(async () => (await songState(page)).bars).toBe(bars)
    // The banner now belongs to an edit that is no longer the last one.
    await page.evaluate(() => (document.getElementById('notificationAction') as HTMLButtonElement).click())
    expect((await songState(page)).bars).toBe(bars)
  })

  test('other notifications have no action button', async ({ page }) => {
    await waitForEditorShell(page)
    await page.evaluate(async () => {
      const { showNotification } = await import('/src/stores/notificationState.ts')
      showNotification('Saved!')
    })
    await expect(page.locator('#notificationLabel')).toHaveText('Saved!')
    await expect(page.locator('#notificationAction')).toBeHidden()
  })

  test('opening a file over unsaved edits asks first, and keeps the song on cancel', async ({ page }) => {
    await waitForEditorShell(page)
    await enterFret(page, '7')
    await expect
      .poll(() => page.evaluate(async () => (await import('/src/services/songAutosave.ts')).isSongDirty()))
      .toBe(true)
    const before = await songState(page)
    const fileInput = page.locator('input[type=file][accept*=".gp5"]')
    const file = {
      name: 'showcase.gp5',
      mimeType: 'application/octet-stream',
      buffer: readFileSync(SHOWCASE_GP5),
    }

    const messages: string[] = []
    page.once('dialog', (dialog) => {
      messages.push(dialog.message())
      void dialog.dismiss()
    })
    await fileInput.setInputFiles(file)
    await expect.poll(() => messages.length).toBe(1)
    expect(messages[0]).toContain('Open "showcase.gp5"?')
    expect(messages[0]).toContain('unsaved changes')
    expect(await songState(page)).toEqual(before)

    page.once('dialog', (dialog) => void dialog.accept())
    await fileInput.setInputFiles(file)
    await expect.poll(async () => (await songState(page)).title).not.toBe(before.title)
  })

  test('opening a file without unsaved edits does not ask', async ({ page }) => {
    await waitForEditorShell(page)
    const dialogs: string[] = []
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message())
      void dialog.dismiss()
    })
    const before = await songState(page)
    await page.locator('input[type=file][accept*=".gp5"]').setInputFiles({
      name: 'showcase.gp5',
      mimeType: 'application/octet-stream',
      buffer: readFileSync(SHOWCASE_GP5),
    })
    await expect.poll(async () => (await songState(page)).title).not.toBe(before.title)
    expect(dialogs).toEqual([])
  })
})
