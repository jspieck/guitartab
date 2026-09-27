import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

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
