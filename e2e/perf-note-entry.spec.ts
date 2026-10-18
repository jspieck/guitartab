import { existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { toggleClassicalNotation, waitForEditorShell } from './helpers'

/**
 * Keystroke-to-paint latency benchmark for note entry on a long song.
 *
 * Opt-in: set GT_PERF_FILE to a local GP3/4/5/GPX file (not committed), e.g.
 *   GT_PERF_FILE="../my-long-song.gp5" npx playwright test perf-note-entry
 * Add GT_PERF_CLASSICAL=1 to measure with classical notation shown.
 */
const perfFile = process.env.GT_PERF_FILE
const withClassical = process.env.GT_PERF_CLASSICAL === '1'
const SAMPLES = 15

test.describe('perf: note entry latency', () => {
  test.skip(!perfFile || !existsSync(perfFile), 'GT_PERF_FILE not set or missing')

  test('keystroke to paint on a long song', async ({ page }) => {
    await waitForEditorShell(page)

    await page
      .locator('input[type="file"][accept*=".gp5"]')
      .first()
      .setInputFiles(perfFile as string)
    const svgHeight = async () => Number(await page.locator('.tab-svg').getAttribute('height'))
    // Rows are virtualized, so wait on the full sheet height rather than mounted measures.
    await expect.poll(svgHeight, { timeout: 30_000 }).toBeGreaterThan(2000)

    if (withClassical) {
      await toggleClassicalNotation(page)
      await expect(page.locator('.vexFlowRow svg').first()).toBeVisible({ timeout: 10_000 })
      await page.waitForTimeout(1_500)
      await page.locator('#mainContent').evaluate((element) => {
        element.scrollTop = 0
      })
      await page.waitForTimeout(300)
    }

    const sheetHeight = await svgHeight()
    const measureCount = await page.locator('.tab-measure').count()
    const rowCount = await page.locator('.tab-row').count()

    const stringArea = page.locator('.string-click-area').first()
    await stringArea.click({ position: { x: 80, y: 4 } })

    const samples: number[] = []
    for (let index = 0; index < SAMPLES; index += 1) {
      const fret = String(index % 10)
      const latency = await page.evaluate(async (key) => {
        const target = document.activeElement ?? document.body
        const start = performance.now()
        target.dispatchEvent(
          new KeyboardEvent('keydown', {
            key,
            code: `Digit${key}`,
            keyCode: 48 + Number(key),
            which: 48 + Number(key),
            bubbles: true,
          }),
        )
        // Two frames: classical staves are drawn in the frame after the tab update.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))),
        )
        return performance.now() - start
      }, fret)
      samples.push(latency)
      // Let multi-digit fret buffering expire between entries.
      await page.waitForTimeout(600)
    }

    samples.sort((a, b) => a - b)
    const median = samples[Math.floor(samples.length / 2)]
    const p90 = samples[Math.floor(samples.length * 0.9)]
    console.log(
      `[perf] classical=${withClassical} sheetHeight=${sheetHeight} mountedMeasures=${measureCount} mountedRows=${rowCount} median=${median.toFixed(1)}ms p90=${p90.toFixed(1)}ms`,
    )
  })
})
