import type { Page } from '@playwright/test'

export async function waitForEditorShell(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('#content', { timeout: 30_000 })
  await page.waitForSelector('.guitar-tab-view', { timeout: 30_000 })
  await page.waitForSelector('.tab-row', { timeout: 30_000 })
}

export async function toggleClassicalNotation(page: Page): Promise<void> {
  const classicalToggle = page.locator('#classicalToggleButton, #classicalToggle, button.classicalButton').first()
  await classicalToggle.click()
}
