import { expect, test } from '@playwright/test'

async function waitForEditorShell(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('#content', { timeout: 30_000 })
  await page.waitForSelector('#completeBar', { timeout: 30_000 })
}

test.describe('app smoke', () => {
  test('loads the editor shell', async ({ page }) => {
    await waitForEditorShell(page)

    await expect(page.locator('#sequencerBar')).toBeVisible()
    await expect(page.locator('#play')).toBeVisible()
  })

  test('shows transport controls and tab bar buttons', async ({ page }) => {
    await waitForEditorShell(page)

    await expect(page.locator('#barButtons')).toBeVisible()
    await expect(page.locator('#statusBars')).toBeVisible()
    await expect(page.locator('#stopButton')).toBeVisible()
  })
})
