import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

// Throwaway (delete after the token work): records every chrome area in light and dark as a
// baseline (--update-snapshots), then reports pixel differences after the stylesheet changes.

// Tolerates text anti-aliasing noise between runs; real colour changes exceed it.
const SHOT = process.env.ZZ_STRICT
  ? ({ maxDiffPixels: 0, threshold: 0.02, animations: 'disabled' } as const)
  : ({ maxDiffPixelRatio: 0.004, threshold: 0.15, animations: 'disabled' } as const)

const DIALOGS: Array<[string, string, unknown?]> = [
  ['INFO', 'infoModal'],
  ['INSTRUMENT_SETTINGS', 'instrumentSettingsModal', { trackId: 0 }],
  ['MIXER', 'mixerModal'],
  ['EQUALIZER', 'equalizerModal'],
  ['COMPRESSOR', 'compressorModal'],
  ['TIME_METER', 'timeMeterModal', { trackId: 0, blockId: 1, voiceId: 0 }],
  ['TEMPO', 'tempoModal', { trackId: 0, blockId: 1, voiceId: 0 }],
  ['ADD_TRACK', 'addTrackModal'],
  ['CHORD_MANAGER', 'chordManagerModal', { trackId: 0 }],
  ['DRUM_INFO', 'drumInfoModal'],
  ['GUITAR', 'guitarModal'],
  ['PIANO', 'pianoModal'],
]

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.waitForTimeout(300)
}

async function setTheme(page: Page, dark: boolean): Promise<void> {
  await page.evaluate((d) => {
    document.body.id = d ? 'darkMode' : 'lightMode'
  }, dark)
}

for (const dark of [false, true]) {
  const theme = dark ? 'dark' : 'light'

  test(`desktop chrome, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await waitForEditorShell(page, { demo: 'arrangement' })
    await page
      .locator('#firstRunHint button')
      .last()
      .click({ timeout: 2000 })
      .catch(() => {})
    await setTheme(page, dark)
    await settle(page)
    await expect(page).toHaveScreenshot(`page-${theme}.png`, SHOT)
    for (const id of ['completeBar', 'sideBarButtons', 'sequencerBar', 'footerBar']) {
      await expect(page.locator(`#${id}`)).toHaveScreenshot(`${id}-${theme}.png`, SHOT)
    }
    for (const tab of [2, 3, 4, 5]) {
      await page.locator(`#barButton${tab}`).click()
      await settle(page)
      await expect(page.locator('#completeBar')).toHaveScreenshot(`toolbar-tab${tab}-${theme}.png`, SHOT)
    }
  })

  for (const [key, id, params] of DIALOGS) {
    test(`dialog ${id}, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 })
      await waitForEditorShell(page)
      await setTheme(page, dark)
      // The dialogs mount lazily; some handlers write into their markup when opened.
      await page.waitForSelector('#instrumentSettingsModal', { state: 'attached' })
      await page.evaluate(
        async ([k, p]) => {
          const { modalManager } = await import('/src/services/dialogs/modalManager.ts')
          const { MODALS } = await import('/src/services/dialogs/modalTypes.ts')
          modalManager.toggleByModal(MODALS[k as keyof typeof MODALS], p)
        },
        [key, params] as const,
      )
      await expect(page.locator(`#${id}`)).toHaveClass(/active/)
      await settle(page)
      await expect(page.locator(`#${id}`)).toHaveScreenshot(`dialog-${id}-${theme}.png`, SHOT)
    })
  }

  test(`popovers, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await waitForEditorShell(page)
    await setTheme(page, dark)
    await page.locator('#shortcutsHelpButton').click()
    await settle(page)
    await expect(page.locator('#shortcutsHelp')).toHaveScreenshot(`shortcuts-${theme}.png`, SHOT)
    await page.keyboard.press('Escape')
    await page.locator('#recoverDrafts').click()
    await settle(page)
    await expect(page).toHaveScreenshot(`drafts-${theme}.png`, SHOT)
  })

  test(`phone, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 900 })
    await waitForEditorShell(page)
    await expect(page.locator('#compactBar')).toBeVisible()
    await setTheme(page, dark)
    await page.locator('#compactEditToggle').click()
    await settle(page)
    await expect(page).toHaveScreenshot(`phone-edit-${theme}.png`, SHOT)
  })
}
