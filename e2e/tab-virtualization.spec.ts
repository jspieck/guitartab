import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { growSong, waitForEditorShell } from './helpers'

async function mountedRowOffsets(page: Page): Promise<number[]> {
  return page.locator('.tab-row').evaluateAll((rows) => rows.map((row) => {
    const match = /translate\(0,\s*([\d.]+)\)/.exec(row.getAttribute('transform') ?? '')
    return match ? Number(match[1]) : NaN
  }))
}

test.describe('tab row virtualization', () => {
  test('mounts only rows near the viewport and follows scrolling', async ({ page }) => {
    await waitForEditorShell(page)
    await growSong(page)

    const sheetHeight = Number(await page.locator('.tab-svg').getAttribute('height'))
    const atTop = await mountedRowOffsets(page)
    const firstRowOffset = Math.min(...atTop)
    expect(Math.max(...atTop)).toBeLessThan(sheetHeight / 2)

    await page.locator('#mainContent').evaluate((element) => { element.scrollTop = element.scrollHeight })
    // The first row is unmounted once the view is at the end of the song.
    await expect.poll(async () => Math.min(...await mountedRowOffsets(page))).toBeGreaterThan(firstRowOffset)

    const atBottom = await mountedRowOffsets(page)
    expect(Math.max(...atBottom)).toBeGreaterThan(sheetHeight / 2)
    await expect(page.locator('.tab-row').last()).toBeInViewport()
  })

  test('svg export includes every row, not only mounted ones', async ({ page }) => {
    await waitForEditorShell(page)
    await growSong(page)
    const mountedRows = await page.locator('.tab-row').count()

    const downloadPromise = page.waitForEvent('download')
    await page.evaluate(async () => {
      const module = await import('/src/services/pdfExport.ts')
      await module.exportTabAsSvg()
    })
    const download = await downloadPromise
    const markup = readFileSync(await download.path(), 'utf-8')
    const exportedRows = (markup.match(/class="tab-row"/g) ?? []).length

    expect(exportedRows).toBeGreaterThan(mountedRows)
    // Export only borrows the full render; the live view returns to the window.
    await expect.poll(async () => page.locator('.tab-row').count()).toBe(mountedRows)
  })
})
