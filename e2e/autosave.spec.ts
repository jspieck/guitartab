import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

const AUTOSAVE_DEBOUNCE_MS = 3000

async function enterNote(page: Page, fret: string): Promise<void> {
  await page.locator('.tab-row').first().locator('.string-click-area').first().click({ position: { x: 80, y: 4 } })
  await page.keyboard.press(fret)
  await expect(page.locator('.tab-row').first().locator('.note-text').filter({ hasText: new RegExp(`^${fret}$`) })).toHaveCount(1)
}

/** Close the page the way a user would; returns whether a leave-page prompt appeared. */
async function closeAndDetectPrompt(page: Page): Promise<boolean> {
  let prompted = false
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'beforeunload') {
      prompted = true
    }
    await dialog.accept()
  })
  await page.close({ runBeforeUnload: true })
  await expect.poll(() => page.isClosed()).toBe(true)
  return prompted
}

async function reopen(page: Page): Promise<Page> {
  const next = await page.context().newPage()
  await waitForEditorShell(next)
  return next
}

test.describe('autosave and recovery', () => {
  test('offers unsaved work after the tab was closed, and restores it', async ({ page }) => {
    await waitForEditorShell(page)
    await enterNote(page, '7')
    await page.waitForTimeout(AUTOSAVE_DEBOUNCE_MS + 500)

    expect(await closeAndDetectPrompt(page)).toBe(true)
    const next = await reopen(page)

    const banner = next.locator('#autosaveBanner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('Restore unsaved changes')
    await banner.getByRole('button', { name: 'Restore' }).click()

    await expect(next.locator('.tab-row').first().locator('.note-text').filter({ hasText: /^7$/ })).toHaveCount(1)
    // The restored work is still not saved to a file.
    expect(await closeAndDetectPrompt(next)).toBe(true)
  })

  test('captures edits made just before closing, before the autosave delay', async ({ page }) => {
    await waitForEditorShell(page)
    await enterNote(page, '4')

    expect(await closeAndDetectPrompt(page)).toBe(true)
    const next = await reopen(page)

    await expect(next.locator('#autosaveBanner')).toBeVisible()
  })

  test('does not warn or offer recovery when nothing was edited', async ({ page }) => {
    await waitForEditorShell(page)
    // A click gives the page user activation, so a prompt would be allowed to show.
    await page.locator('.tab-row').first().locator('.string-click-area').first().click({ position: { x: 80, y: 4 } })

    expect(await closeAndDetectPrompt(page)).toBe(false)
    const next = await reopen(page)
    await next.waitForTimeout(500)
    await expect(next.locator('#autosaveBanner')).toHaveCount(0)
  })

  test('saving clears the warning and the recovery offer', async ({ page }) => {
    await waitForEditorShell(page)
    await enterNote(page, '5')
    await page.waitForTimeout(AUTOSAVE_DEBOUNCE_MS + 500)

    const download = page.waitForEvent('download')
    await page.locator('#downloadGP').click()
    await page.locator('#download-gt').click()
    await download

    expect(await closeAndDetectPrompt(page)).toBe(false)
    const next = await reopen(page)
    await next.waitForTimeout(500)
    await expect(next.locator('#autosaveBanner')).toHaveCount(0)
  })

  test('opening a file does not count as an unsaved change', async ({ page }) => {
    await waitForEditorShell(page)
    await enterNote(page, '9')
    const downloadPromise = page.waitForEvent('download')
    await page.locator('#downloadGP').click()
    await page.locator('#download-gt').click()
    const savedFile = await (await downloadPromise).path()

    const next = await reopen(page)
    await next.locator('input[type="file"][accept*=".gt"]').first().setInputFiles({
      name: 'saved.gt',
      mimeType: 'application/octet-stream',
      buffer: await import('node:fs').then((fs) => fs.readFileSync(savedFile)),
    })
    await expect(next.locator('.tab-row').first().locator('.note-text').filter({ hasText: /^9$/ })).toHaveCount(1)
    await next.waitForTimeout(AUTOSAVE_DEBOUNCE_MS + 500)

    expect(await closeAndDetectPrompt(next)).toBe(false)
  })

  test('lists drafts and restores an older one without losing current edits', async ({ page }) => {
    await waitForEditorShell(page)
    await enterNote(page, '8')
    await page.waitForTimeout(AUTOSAVE_DEBOUNCE_MS + 500)

    await page.locator('#recoverDrafts').click()
    const items = page.locator('.autosave-drafts .autosave-drafts__item')
    await expect(items).toHaveCount(1)

    // Change the note, then restore the earlier draft from the panel.
    await page.locator('#recoverDrafts').click()
    await enterNote(page, '6')
    await page.locator('#recoverDrafts').click()
    // Opening the panel captured the current edit as the newest draft.
    await expect(items).toHaveCount(2)
    await items.nth(1).getByRole('button', { name: 'Restore' }).click()

    await expect(page.locator('.tab-row').first().locator('.note-text').filter({ hasText: /^8$/ })).toHaveCount(1)
  })
})
