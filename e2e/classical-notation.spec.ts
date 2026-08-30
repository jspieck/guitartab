import { expect, test } from '@playwright/test'

async function waitForEditorShell(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('#content', { timeout: 30_000 })
  await page.waitForSelector('.guitar-tab-view', { timeout: 30_000 })
}

test.describe('classical notation', () => {
  test('renders staff lines below the tab when enabled', async ({ page }) => {
    await waitForEditorShell(page)

    const classicalToggle = page.locator('#classicalToggle, button.classicalButton').first()
    await classicalToggle.click()
    await page.waitForTimeout(800)

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
