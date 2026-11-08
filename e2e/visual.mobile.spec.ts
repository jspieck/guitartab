import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell, waitForSoundFont } from './helpers'

/** Phone layout baselines (`mobile` project, Pixel 7). Refresh: npx playwright test visual --update-snapshots */

const SCREENSHOT = { maxDiffPixelRatio: 0.01, animations: 'disabled' } as const

async function openPhoneLayout(page: Page): Promise<void> {
  await waitForEditorShell(page)
  await expect(page.locator('#compactBar')).toBeVisible()
  await expect
    .poll(async () => Number(await page.locator('.tab-svg').getAttribute('width')))
    .toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.evaluate(() => document.fonts.ready)
  // The Play button shows the SoundFont download until it is done; the baseline is after it.
  await waitForSoundFont(page)
}

test.describe('phone layout baselines', { tag: '@visual' }, () => {
  test('viewer: compact bar and tab', async ({ page }) => {
    await openPhoneLayout(page)
    await expect(page.locator('#compactBar')).toHaveScreenshot('compact-bar.png', SCREENSHOT)
    await expect(page.locator('.tab-row').first()).toHaveScreenshot('compact-tab-row.png', SCREENSHOT)
  })

  test('editing: touch note pad', async ({ page }) => {
    await openPhoneLayout(page)
    await page.locator('#compactEditToggle').tap()
    const pad = page.locator('#touchNotePad')
    await expect(pad).toBeVisible()
    await expect(pad).toHaveScreenshot('touch-note-pad.png', SCREENSHOT)
  })
})
