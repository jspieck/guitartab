import { expect, type Page } from '@playwright/test'

/**
 * Opens the editor. By default first-time visitors get the small one-track riff
 * (`src/data/demoSong.ts`), which most tests rely on; `demo: 'arrangement'` gives the
 * real multi-track demo song.
 */
export async function waitForEditorShell(page: Page, { demo = 'riff' }: { demo?: 'riff' | 'arrangement' } = {}): Promise<void> {
  if (demo === 'riff') {
    await page.addInitScript(() => localStorage.setItem('guitartab:demoSong', 'riff'))
  }
  await page.goto('/')
  // Set once the first song is on screen (after the lazy demo arrangement, if any).
  await page.waitForSelector('html[data-editor-ready]', { state: 'attached', timeout: 30_000 })
  await page.waitForSelector('#content', { timeout: 30_000 })
  await page.waitForSelector('.guitar-tab-view', { timeout: 30_000 })
  await page.waitForSelector('.tab-row', { timeout: 30_000 })
}

/** Waits until the SoundFont is parsed, for tests that listen to or schedule instrument notes. */
export async function waitForSoundFont(page: Page): Promise<void> {
  await page.waitForSelector('html[data-soundfont-ready]', { state: 'attached', timeout: 60_000 })
}

export async function toggleClassicalNotation(page: Page): Promise<void> {
  const classicalToggle = page.locator('#classicalToggleButton, #classicalToggle, button.classicalButton').first()
  await classicalToggle.click()
}

/** Append empty measures via the Measure toolbar so the song spans many rows. */
export async function growSong(page: Page, extraMeasures = 80): Promise<void> {
  await page.getByText('Measure', { exact: true }).first().click()
  const addMeasure = page.locator('#addMeasure')
  for (let index = 0; index < extraMeasures; index += 1) {
    await addMeasure.click()
  }
  await expect.poll(async () => Number(await page.locator('.tab-svg').getAttribute('height'))).toBeGreaterThan(2500)
}
