import { devices, expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

/**
 * Makes the pictures of the static site (Big win 34): the link preview `public/og-image.png`
 * (1200×630) and the screenshots in `public/site/`. Opt-in, because it overwrites files:
 *
 *   GT_SITE_IMAGES=1 npx playwright test site-images --project=chromium
 *
 * Run it again after a visible change to the editor; check the pictures before committing.
 */
test.skip(!process.env.GT_SITE_IMAGES, 'Set GT_SITE_IMAGES=1 to regenerate the site pictures')

async function openDemo(page: Page): Promise<void> {
  await waitForEditorShell(page, { demo: 'arrangement' })
  const gotIt = page.locator('#firstRunHint').getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible()) await gotIt.click()
  await expect(page.locator('#firstRunHint')).toHaveCount(0)
}

/** Lets fonts, lazy notation and row mounting settle before a picture. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)
}

test.describe('site pictures', () => {
  test.use({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })

  test('link preview: the score view with the name', async ({ page }) => {
    await openDemo(page)
    await page.evaluate(async () => {
      const { setScoreView } = await import('/src/services/editor/scoreViewCommands.ts')
      await setScoreView(true)
      const { zoomTab } = await import('/src/services/editor/zoom.ts')
      zoomTab(false)
      zoomTab(false)
    })
    await page.locator('#sequencerToggle').click()
    await settle(page)
    // Start at the first system, under the title and chord diagrams.
    await page.evaluate(() => document.querySelector('.tab-row')?.scrollIntoView({ block: 'start' }))
    // Zooming shows the new percentage as a banner.
    await page.evaluate(async () => {
      const { hideNotification } = await import('/src/stores/notificationState.ts')
      hideNotification()
    })
    await settle(page)
    // A banner over the lower part of the editor, so the picture says what it is in a chat.
    await page.evaluate(() => {
      const banner = document.createElement('div')
      banner.innerHTML = `
        <img src="/favicon.svg" width="72" height="72" alt="">
        <div>
          <div style="font-size: 52px; font-weight: 700; line-height: 1.1">SereneTab</div>
          <div style="font-size: 26px; opacity: 0.9">Guitar tab editor and player in your browser</div>
        </div>`
      Object.assign(banner.style, {
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: '0',
        height: '150px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        padding: '0 56px',
        background: 'linear-gradient(90deg, rgba(20, 44, 110, 0.96), rgba(37, 88, 200, 0.92))',
        color: '#ffffff',
        font: '16px system-ui, -apple-system, "Segoe UI", sans-serif',
        zIndex: '100000',
      })
      document.body.append(banner)
    })
    await page.screenshot({ path: 'public/og-image.png' })
  })
})

test.describe('site screenshots (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })

  test('editor with tab and notation', async ({ page }) => {
    await openDemo(page)
    await page.evaluate(async () => {
      const { toggleClassicalNotation } = await import('/src/services/editor/scoreViewCommands.ts')
      await toggleClassicalNotation()
    })
    await page.waitForSelector('.vexFlowRow svg', { timeout: 30_000 })
    await settle(page)
    await page.screenshot({ path: 'public/site/editor.jpg', type: 'jpeg', quality: 82 })
  })

  test('a loop with the speed trainer', async ({ page }) => {
    await openDemo(page)
    await page.evaluate(async () => {
      const { startRange, extendRange, applyRangeAsLoop } =
        await import('/src/services/editor/rangeSelection.ts')
      const { default: Song } = await import('/src/stores/song.ts')
      const lastBeat = Song.measures[0][2][0].length - 1
      startRange(0, 1, 0, 0)
      extendRange(0, 2, 0, lastBeat)
      applyRangeAsLoop()
    })
    await page.locator('#playbackSpeed').selectOption('0.7')
    await page.locator('#speedTrainerToggle, #practiceMenuButton').first().click()
    await page.locator('#speedTrainerEnabled').check()
    await settle(page)
    await page.screenshot({ path: 'public/site/practice.jpg', type: 'jpeg', quality: 82 })
  })
})

test('site screenshot (phone): tab and fret pad', async ({ browser }) => {
  const { viewport: _viewport, deviceScaleFactor: _scale, ...phone } = devices['Pixel 7']
  const context = await browser.newContext({
    ...phone,
    viewport: { width: 412, height: 860 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await openDemo(page)
  await page.locator('#compactEditToggle').tap()
  await expect(page.locator('#touchNotePad')).toBeVisible()
  await settle(page)
  await page.screenshot({ path: 'public/site/phone.jpg', type: 'jpeg', quality: 82 })
  await context.close()
})
