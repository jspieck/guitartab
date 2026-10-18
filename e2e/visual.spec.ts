import { expect, test, type Locator, type Page } from '@playwright/test'
import { toggleClassicalNotation, waitForEditorShell } from './helpers'
import { loadEffectsShowcase } from './fixtures/effectsShowcase'

/**
 * Pixel baselines for the main surfaces, per platform (`*-chromium-win32.png`, `*-chromium-linux.png`).
 * After an intended visual change: npx playwright test visual --update-snapshots
 * CI writes missing Linux baselines and uploads them as the `linux-snapshots` artifact.
 */

const SCREENSHOT = { maxDiffPixelRatio: 0.01, animations: 'disabled' } as const

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  // Two frames, so layout writes queued with fastdom/requestAnimationFrame are painted.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
}

async function openEffectsShowcase(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 1600 })
  await waitForEditorShell(page)
  await loadEffectsShowcase(page)
  await expect(page.locator('.beat-text').first()).toBeVisible()
}

function tabRow(page: Page, index: number): Locator {
  return page.locator('.tab-row').nth(index)
}

async function enableDarkMode(page: Page): Promise<void> {
  await page.locator('#modeSwitcher').click()
  await expect(page.locator('body')).toHaveAttribute('id', 'darkMode')
}

test.describe('visual baselines', () => {
  test('tab rows with every effect', async ({ page }) => {
    await openEffectsShowcase(page)
    await settle(page)
    for (const index of [0, 1, 2]) {
      await expect(tabRow(page, index)).toHaveScreenshot(`effects-row-${index + 1}.png`, SCREENSHOT)
    }
  })

  test('tab rows with every effect, with classical notation', async ({ page }) => {
    await openEffectsShowcase(page)
    await toggleClassicalNotation(page)
    await expect(page.locator('.vexFlowRow svg').first()).toBeVisible({ timeout: 10_000 })
    await settle(page)
    await expect(page.locator('.vexFlowRow').first()).toHaveScreenshot(
      'effects-classical-staff-1.png',
      SCREENSHOT,
    )
    await expect(tabRow(page, 0)).toHaveScreenshot('effects-classical-row-1.png', SCREENSHOT)
  })

  test('dark mode: toolbar and tab', async ({ page }) => {
    await openEffectsShowcase(page)
    await enableDarkMode(page)
    await settle(page)
    await expect(page.locator('#completeBar')).toHaveScreenshot('dark-toolbar.png', SCREENSHOT)
    await expect(tabRow(page, 0)).toHaveScreenshot('dark-effects-row-1.png', SCREENSHOT)
  })

  test('light toolbar', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await waitForEditorShell(page)
    await settle(page)
    await expect(page.locator('#completeBar')).toHaveScreenshot('toolbar.png', SCREENSHOT)
  })

  test('keyboard shortcut sheet', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 })
    await waitForEditorShell(page)
    await page.locator('#shortcutsHelpButton').click()
    const sheet = page.locator('#shortcutsHelp')
    await expect(sheet).toBeVisible()
    await settle(page)
    await expect(sheet).toHaveScreenshot('shortcut-sheet.png', SCREENSHOT)
  })
})
