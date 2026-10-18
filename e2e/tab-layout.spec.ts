import { expect, test } from '@playwright/test'
import { growSong, toggleClassicalNotation, waitForEditorShell } from './helpers'

test.describe('tab layout', () => {
  test('renders multiple tab rows with classical notation off', async ({ page }) => {
    await waitForEditorShell(page)

    await expect(page.locator('.vexFlowRow')).toHaveCount(0)

    const tabRows = page.locator('.tab-row')
    await expect(tabRows.first()).toBeVisible()
    expect(await tabRows.count()).toBeGreaterThan(1)

    const measures = page.locator('.tab-measure')
    expect(await measures.count()).toBeGreaterThanOrEqual(12)
  })

  test('places a note after clicking a string and typing a fret', async ({ page }) => {
    await waitForEditorShell(page)

    const stringArea = page.locator('.string-click-area').first()
    await stringArea.click({ position: { x: 80, y: 4 } })
    await page.keyboard.press('5')

    const noteText = page.locator('.note-text').filter({ hasText: '5' }).first()
    await expect(noteText).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('classical notation layout', () => {
  test('creates one vexFlow row per tab row when enabled', async ({ page }) => {
    await waitForEditorShell(page)

    const rowsBefore = await page.locator('.tab-row').count()
    expect(rowsBefore).toBeGreaterThan(1)

    await toggleClassicalNotation(page)
    await expect(page.locator('.vexFlowRow svg').first()).toBeVisible({ timeout: 10_000 })

    const tabRowCount = await page.locator('.tab-row').count()
    const vexRowCount = await page.locator('.vexFlowRow').count()

    expect(tabRowCount).toBeGreaterThan(1)
    expect(vexRowCount).toBe(tabRowCount)

    for (let index = 0; index < vexRowCount; index += 1) {
      await expect(page.locator('.vexFlowRow').nth(index).locator('svg')).toBeVisible()
    }
  })

  test('keeps stave layers under matching tab rows after toggle', async ({ page }) => {
    await waitForEditorShell(page)
    await toggleClassicalNotation(page)
    await expect(page.locator('.vexFlowRow svg').first()).toBeVisible({ timeout: 10_000 })

    const alignment = await page.evaluate(() => {
      const tabRows = Array.from(document.querySelectorAll<SVGGElement>('.tab-row'))
      const vexRows = Array.from(document.querySelectorAll<HTMLElement>('.vexFlowRow'))
      if (tabRows.length === 0 || tabRows.length !== vexRows.length) {
        return { ok: false, reason: 'row-count-mismatch', tabRows: tabRows.length, vexRows: vexRows.length }
      }

      const results: Array<{ rowId: number; tabTop: number; vexTop: number; delta: number }> = []
      for (let index = 0; index < tabRows.length; index += 1) {
        const tabBox = tabRows[index].getBoundingClientRect()
        const vexBox = vexRows[index].getBoundingClientRect()
        results.push({
          rowId: index,
          tabTop: tabBox.top,
          vexTop: vexBox.top,
          delta: vexBox.top - tabBox.bottom,
        })
      }

      // Classical staff should sit below its tab row (small gap allowed).
      const allBelow = results.every((entry) => entry.delta >= -2 && entry.delta < 80)
      return { ok: allBelow, reason: allBelow ? 'ok' : 'stave-not-below-tab', results }
    })

    expect(alignment.ok, JSON.stringify(alignment)).toBe(true)
  })

  test('removes classical rows when toggled off', async ({ page }) => {
    await waitForEditorShell(page)

    await toggleClassicalNotation(page)
    await expect(page.locator('.vexFlowRow').first()).toBeVisible({ timeout: 10_000 })

    await toggleClassicalNotation(page)
    await expect(page.locator('.vexFlowRow')).toHaveCount(0)
    expect(await page.locator('.tab-row').count()).toBeGreaterThan(1)
  })
})

test.describe('incremental tab rendering', () => {
  test('updates notes in place across entry, undo and redo without remounting rows', async ({ page }) => {
    await waitForEditorShell(page)

    const firstRow = page.locator('.tab-row').first()
    await firstRow.evaluate((element) => { element.setAttribute('data-e2e-marker', 'kept') })

    await page.locator('.string-click-area').first().click({ position: { x: 80, y: 4 } })
    await page.keyboard.press('7')
    const note = page.locator('.tab-row').first().locator('.note-text').filter({ hasText: /^7$/ })
    await expect(note).toHaveCount(1, { timeout: 5_000 })

    await page.waitForTimeout(600)
    await page.keyboard.press('Control+z')
    await expect(note).toHaveCount(0, { timeout: 5_000 })

    await page.keyboard.press('Control+y')
    await expect(note).toHaveCount(1, { timeout: 5_000 })

    // Row elements are patched, not recreated, by edits inside them.
    await expect(page.locator('.tab-row[data-e2e-marker="kept"]')).toHaveCount(1)
  })
})

test.describe('pointer hit-testing on long songs', () => {
  test('enters the note in the clicked row when the song is longer than one page', async ({ page }) => {
    await waitForEditorShell(page)
    await growSong(page)
    await page.locator('#mainContent').evaluate((element) => { element.scrollTop = 0 })

    await page.locator('.tab-row').first().locator('.string-click-area').first().click({ position: { x: 80, y: 4 } })
    await page.keyboard.press('9')

    await expect(page.locator('.tab-row').first().locator('.note-text').filter({ hasText: /^9$/ })).toHaveCount(1)
  })
})

test.describe('selection indicator', () => {
  test('is centred on the note for every beat, including the last beat of a measure', async ({ page }) => {
    await waitForEditorShell(page)

    // Measure 2 of the demo song is empty; click its right end to select the last beat.
    const measure = page.locator('.tab-row').first().locator('.tab-measure').nth(2)
    const measureBox = (await measure.boundingBox())!
    const strings = page.locator('.tab-row').first().locator('.string-click-area').first()
    const stringsBox = (await strings.boundingBox())!
    await strings.click({ position: { x: measureBox.x + measureBox.width - 8 - stringsBox.x, y: 6 } })
    await page.keyboard.press('5')

    const digit = measure.locator('.note-text').filter({ hasText: /^5$/ })
    await expect(digit).toHaveCount(1)
    const indicator = page.locator('.tab-row').first().locator('.selection-indicator rect')
    await expect(indicator).toHaveCount(1)

    const center = async (locator: typeof digit) => {
      const box = (await locator.boundingBox())!
      return box.x + box.width / 2
    }
    expect(Math.abs(await center(indicator) - await center(digit))).toBeLessThanOrEqual(1)
  })
})
