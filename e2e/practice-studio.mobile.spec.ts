import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

/** Big win 28 on phones (the `mobile` project): practice options, tuner and print in the ⋯ menu. */

test.describe('practice on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditorShell(page)
    await expect(page.locator('#compactBar')).toBeVisible()
  })

  test('the ⋯ menu opens the practice options as a sheet', async ({ page }) => {
    await page.locator('#compactMoreButton').click()
    await page.locator('#compactPracticeOptions').click()
    const sheet = page.locator('#practiceModal')
    await expect(sheet).toHaveClass(/active/)
    await sheet.locator('#practiceSheetSpeed').selectOption('0.5')
    expect(
      await page.evaluate(
        async () => (await import('/src/stores/practiceState.ts')).practiceState.playbackRate,
      ),
    ).toBe(0.5)
    await sheet.locator('#practiceDockSelect').selectOption('guitar')
    await page.keyboard.press('Escape')
    await expect(sheet).not.toHaveClass(/active/)
    await expect(page.locator('#practiceDock .fretboard')).toBeVisible()
  })

  test('the ⋯ menu opens the tuner and toggles the fretboard', async ({ page }) => {
    await page.locator('#compactMoreButton').click()
    await page.locator('#compactTuner').click()
    await expect(page.locator('#tunerModal')).toHaveClass(/active/)
    await page.keyboard.press('Escape')
    await page.locator('#compactMoreButton').click()
    await page.locator('#compactDockToggle').click()
    await expect(page.locator('#practiceDock')).toBeVisible()
    await page.locator('#compactMoreButton').click()
    await expect(page.locator('#compactDockToggle')).toHaveText(/hide/i)
  })
})
