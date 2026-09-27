import { expect, test } from '@playwright/test'
import { toggleClassicalNotation, waitForEditorShell } from './helpers'

test.describe('classical notation', () => {
  test('renders staff lines below the tab when enabled', async ({ page }) => {
    await waitForEditorShell(page)

    await toggleClassicalNotation(page)

    const vexflowSvg = page.locator('.vexFlowRow svg').first()
    await expect(vexflowSvg).toBeVisible({ timeout: 10_000 })

    const staffLineCount = await vexflowSvg.locator('path, line, rect').count()
    expect(staffLineCount).toBeGreaterThan(5)

    await page.screenshot({
      path: 'e2e/screenshots/classical-notation.png',
      fullPage: false,
    })
  })
})
