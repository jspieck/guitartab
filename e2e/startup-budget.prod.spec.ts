import { expect, test, type Page } from '@playwright/test'

/**
 * First load of the production build (playwright.startup.config.ts serves `dist/` with
 * `vite preview`; the dev server's unbundled modules say nothing about startup). The limits are
 * generous because CI machines vary; the numbers are logged so a trend shows in the CI log.
 * Locally (2026-10-31, Windows, Chromium): editor ready ~470 ms, ~525 KB of JS before it.
 */
const LIMITS = {
  editorReadyMs: 3000,
  firstContentfulPaintMs: 2000,
  scriptBeforeReadyKb: 600,
  longestTaskMs: 800,
}

interface StartupNumbers {
  readyMs: number
  fcpMs: number
  scriptKb: number
  longestTaskMs: number
  dialogsMountedAtReady: boolean
  chunks: string[]
}

async function measureStartup(page: Page): Promise<StartupNumbers> {
  await page.addInitScript(() => {
    const state = window as unknown as { __startup: Record<string, unknown> }
    state.__startup = { longTasks: [] as number[] }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) (state.__startup.longTasks as number[]).push(entry.duration)
    }).observe({ type: 'longtask', buffered: true })
    const timer = setInterval(() => {
      if (!document.documentElement?.hasAttribute('data-editor-ready')) return
      clearInterval(timer)
      state.__startup.readyMs = performance.now()
      // Dialogs mount only when one opens (stores/dialogState.ts).
      state.__startup.dialogsMountedAtReady = document.getElementById('infoModal') != null
    }, 2)
  })
  await page.goto('/')
  await page.waitForSelector('html[data-editor-ready]', { timeout: 30_000 })
  // Let the idle work (dialogs, SoundFont) run, so its long tasks are counted too.
  await page.waitForTimeout(1500)
  return page.evaluate(() => {
    const state = (window as unknown as { __startup: Record<string, unknown> }).__startup
    const readyMs = state.readyMs as number
    const scripts = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
      (entry) => entry.name.endsWith('.js') && entry.responseEnd <= readyMs,
    )
    return {
      readyMs,
      fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1,
      scriptKb: scripts.reduce((sum, entry) => sum + entry.decodedBodySize, 0) / 1024,
      longestTaskMs: Math.max(0, ...(state.longTasks as number[])),
      dialogsMountedAtReady: state.dialogsMountedAtReady as boolean,
      chunks: scripts
        .map((entry) =>
          entry.name
            .split('/')
            .pop()!
            .replace(/-[0-9a-f]{8}\.js$/, ''),
        )
        .sort(),
    }
  })
}

for (const layout of [
  { name: 'desktop', viewport: { width: 1400, height: 900 } },
  { name: 'phone', viewport: { width: 412, height: 860 } },
]) {
  test(`first load stays within the startup budget (${layout.name})`, async ({ page }) => {
    await page.setViewportSize(layout.viewport)
    const numbers = await measureStartup(page)
    process.stdout.write(
      `[startup ${layout.name}] ready ${numbers.readyMs.toFixed(0)} ms, FCP ${numbers.fcpMs.toFixed(0)} ms, ` +
        `JS before ready ${numbers.scriptKb.toFixed(0)} KB, longest task ${numbers.longestTaskMs.toFixed(0)} ms; ` +
        `${numbers.chunks.join(', ')}\n`,
    )
    expect(numbers.readyMs).toBeLessThan(LIMITS.editorReadyMs)
    expect(numbers.fcpMs).toBeGreaterThan(0)
    expect(numbers.fcpMs).toBeLessThan(LIMITS.firstContentfulPaintMs)
    expect(numbers.scriptKb).toBeLessThan(LIMITS.scriptBeforeReadyKb)
    expect(numbers.longestTaskMs).toBeLessThan(LIMITS.longestTaskMs)
    expect(numbers.dialogsMountedAtReady).toBe(false)
    // On demand only: dragging/colour picker, VexFlow, exports.
    for (const lazy of ['interact', 'color-picker', 'notation', 'songExport', 'ModalsContainer'])
      expect(numbers.chunks).not.toContain(lazy)
  })
}
