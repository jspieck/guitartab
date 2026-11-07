import { test, type Page } from '@playwright/test'
import { toggleTabView, waitForEditorShell } from './helpers'

/**
 * Score view benchmark (audit Big win 25): the four-track demo grown to 140 bars, keystroke to
 * paint while editing, and the frame after scrolling a screen down, with and without the score view.
 *
 * Opt-in: GT_PERF_SCORE=1 npx playwright test perf-score-view --project=chromium
 */
const SAMPLES = 15
const BARS = 140

test.skip(process.env.GT_PERF_SCORE !== '1', 'GT_PERF_SCORE not set')

async function loadLongSong(page: Page) {
  await page.evaluate(async (bars) => {
    const { buildDemoArrangement } = await import('/src/data/demoArrangement.ts')
    const { loadBuiltSong } = await import('/src/services/songImport.ts')
    const song = buildDemoArrangement()
    const length = song.measureMeta.length
    const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
    song.measures = song.measures.map((track) =>
      Array.from({ length: bars }, (_, bar) => clone(track[bar % length])),
    )
    song.measureMeta = Array.from({ length: bars }, (_, bar) => {
      const meta = clone(song.measureMeta[bar % length])
      if (bar >= length) {
        // plain bars after the first pass: no repeats, signs, markers or tempo changes
        for (const key of [
          'repeatOpen',
          'repeatClose',
          'repeatAlternative',
          'marker',
          'bpm',
          'directionTargets',
          'directionJumps',
        ]) {
          delete (meta as Record<string, unknown>)[key]
        }
      }
      return meta
    })
    loadBuiltSong(song)
  }, BARS)
  await page.waitForTimeout(800)
}

async function keystrokeLatency(page: Page): Promise<number[]> {
  await page
    .locator('.string-click-area')
    .first()
    .click({ position: { x: 120, y: 6 } })
  const samples: number[] = []
  for (let index = 0; index < SAMPLES; index += 1) {
    const key = String(index % 10)
    samples.push(
      await page.evaluate(async (digit) => {
        const target = document.activeElement ?? document.body
        const start = performance.now()
        target.dispatchEvent(
          new KeyboardEvent('keydown', { key: digit, code: `Digit${digit}`, bubbles: true }),
        )
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))),
        )
        return performance.now() - start
      }, key),
    )
    await page.waitForTimeout(600)
  }
  return samples
}

async function scrollLatency(page: Page): Promise<number[]> {
  return page.evaluate(async () => {
    const main = document.getElementById('mainContent')!
    const samples: number[] = []
    main.scrollTop = 0
    await new Promise((resolve) => setTimeout(resolve, 300))
    for (let step = 0; step < 12; step += 1) {
      const start = performance.now()
      main.scrollTop += main.clientHeight
      // the visible window is measured in a frame, the rows mount in the next
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))),
      )
      samples.push(performance.now() - start)
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    return samples
  })
}

const summary = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b)
  return `median=${sorted[Math.floor(sorted.length / 2)].toFixed(1)}ms p90=${sorted[Math.floor(sorted.length * 0.9)].toFixed(1)}ms`
}

for (const score of [false, true]) {
  test(`${BARS} bars, four tracks, score view ${score ? 'on' : 'off'}`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 })
    await waitForEditorShell(page)
    await loadLongSong(page)
    if (score) await toggleTabView(page, 'scoreViewToggle')
    await page.waitForTimeout(500)
    const rows = await page.locator('.tab-row').count()
    const height = await page.locator('.tab-svg').getAttribute('height')
    const keys = await keystrokeLatency(page)
    const scrolls = await scrollLatency(page)
    console.log(
      `[perf] score=${score} sheetHeight=${height} mountedRows=${rows} keystroke ${summary(keys)} scroll ${summary(scrolls)}`,
    )
  })
}
