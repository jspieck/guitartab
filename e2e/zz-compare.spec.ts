import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { waitForEditorShell } from './helpers'

// Throwaway: renders before (zz-token-areas baselines) next to after into ZZ_OUT/compare-*.png.

const OUT = process.env.ZZ_OUT ?? 'test-results'
const BEFORE = 'e2e/zz-token-areas.spec.ts-snapshots'

async function compose(page: Page, name: string, beforeFile: string, after: Buffer): Promise<void> {
  const before = readFileSync(`${BEFORE}/${beforeFile}`).toString('base64')
  const sheet = await page.context().newPage()
  await sheet.setViewportSize({ width: 1600, height: 600 })
  await sheet.setContent(`<body style="margin:0;font:14px sans-serif;background:#888">
    <div style="display:flex;gap:12px;padding:12px;align-items:flex-start">
      <figure style="margin:0;flex:1"><figcaption style="color:#fff">Before</figcaption>
        <img style="width:100%;border:1px solid #444" src="data:image/png;base64,${before}"></figure>
      <figure style="margin:0;flex:1"><figcaption style="color:#fff">After</figcaption>
        <img style="width:100%;border:1px solid #444" src="data:image/png;base64,${after.toString('base64')}"></figure>
    </div></body>`)
  await sheet.screenshot({ path: `${OUT}/compare-${name}.png`, fullPage: true })
  await sheet.close()
}

async function theme(page: Page, dark: boolean): Promise<void> {
  await page.evaluate((d) => (document.body.id = d ? 'darkMode' : 'lightMode'), dark)
  await page.waitForTimeout(300)
}

test('compare pages', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await waitForEditorShell(page, { demo: 'arrangement' })
  await page
    .locator('#firstRunHint button')
    .last()
    .click({ timeout: 2000 })
    .catch(() => {})
  for (const dark of [false, true]) {
    await theme(page, dark)
    const t = dark ? 'dark' : 'light'
    await compose(page, `page-${t}`, `page-${t}-chromium-win32.png`, await page.screenshot())
  }
})

test('compare dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 })
  await waitForEditorShell(page)
  await page.waitForSelector('#instrumentSettingsModal', { state: 'attached' })
  await page.evaluate(async () => {
    const { modalManager } = await import('/src/services/dialogs/modalManager.ts')
    const { MODALS } = await import('/src/services/dialogs/modalTypes.ts')
    modalManager.toggleByModal(MODALS.INSTRUMENT_SETTINGS, { trackId: 0 })
  })
  await expect(page.locator('#instrumentSettingsModal')).toHaveClass(/active/)
  for (const dark of [false, true]) {
    await theme(page, dark)
    const t = dark ? 'dark' : 'light'
    const shot = await page.locator('#instrumentSettingsModal').screenshot()
    await compose(page, `dialog-${t}`, `dialog-instrumentSettingsModal-${t}-chromium-win32.png`, shot)
  }
})
