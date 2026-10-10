import { expect, test } from '@playwright/test'
import { toggleClassicalNotation, waitForEditorShell } from './helpers'

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
