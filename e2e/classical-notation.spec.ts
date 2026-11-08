import { expect, test, type Page } from '@playwright/test'
import { growSong, toggleClassicalNotation, waitForEditorShell } from './helpers'

interface RowGeometry {
  stringsTop: number
  stringsBottom: number
}

interface StaffGeometry {
  top: number
  bottom: number
  linesTop: number
  linesBottom: number
}

/** Screen geometry of every mounted tab row and classical row, in document order. */
async function readRowGeometry(page: Page): Promise<{ tab: RowGeometry[]; staves: StaffGeometry[] }> {
  return page.evaluate(() => {
    const tab = [...document.querySelectorAll('.tab-row')].map((row) => {
      const lines = [...row.querySelectorAll('.tab-string-line')].map((line) => line.getBoundingClientRect())
      return {
        stringsTop: Math.min(...lines.map((rect) => rect.top)),
        stringsBottom: Math.max(...lines.map((rect) => rect.bottom)),
      }
    })
    const staves = [...document.querySelectorAll<HTMLElement>('.vexFlowRow')].map((row) => {
      const box = row.getBoundingClientRect()
      const staveLines = [...row.querySelectorAll('.vf-stave path')].map((line) =>
        line.getBoundingClientRect(),
      )
      return {
        top: box.top,
        bottom: box.bottom,
        linesTop: Math.min(...staveLines.map((rect) => rect.top)),
        linesBottom: Math.max(...staveLines.map((rect) => rect.bottom)),
      }
    })
    return { tab, staves }
  })
}

/** Toggling classical scrolls (animated) to the selected measure; wait until it stops. */
async function waitForScrollIdle(page: Page): Promise<void> {
  let previous = -1
  await expect
    .poll(
      async () => {
        const current = await page.locator('#mainContent').evaluate((element) => element.scrollTop)
        const idle = current === previous
        previous = current
        return idle
      },
      { intervals: [250] },
    )
    .toBe(true)
}

async function expectOneStaffUnderEachRow(page: Page): Promise<void> {
  // Row heights change when classical turns on, so wait until both counts settle together.
  await expect
    .poll(async () => {
      const [tabRows, staves] = await Promise.all([
        page.locator('.tab-row').count(),
        page.locator('.vexFlowRow svg').count(),
      ])
      return tabRows > 0 && tabRows === staves
    })
    .toBe(true)
  const { tab, staves } = await readRowGeometry(page)

  expect(staves.length).toBe(tab.length)
  tab.forEach((row, index) => {
    const staff = staves[index]
    const context = JSON.stringify({ index, row, staff })
    // Staff lines sit below this row's strings ...
    expect(staff.linesTop, context).toBeGreaterThan(row.stringsBottom)
    // ... and the whole classical area ends before the next row begins.
    const next = tab[index + 1]
    if (next) {
      expect(staff.bottom, context).toBeLessThan(next.stringsTop)
    }
  })
}

test.describe('classical notation', () => {
  test('renders staff lines below the tab when enabled', { tag: '@visual' }, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await waitForEditorShell(page)

    await toggleClassicalNotation(page)

    const vexflowSvg = page.locator('.vexFlowRow svg').first()
    await expect(vexflowSvg).toBeVisible({ timeout: 10_000 })

    const staffLineCount = await vexflowSvg.locator('path, line, rect').count()
    expect(staffLineCount).toBeGreaterThan(5)

    // Pixel comparison against the committed baseline (the riff's first row, tab and staff).
    // After an intended visual change, refresh it: npx playwright test classical-notation --update-snapshots
    await page.evaluate(() => document.fonts.ready)
    await waitForScrollIdle(page)
    await expect(page.locator('.vexFlowRow').first()).toHaveScreenshot('first-staff.png', {
      maxDiffPixelRatio: 0.01,
    })
    await expect(page.locator('.tab-row').first()).toHaveScreenshot('first-tab-row.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('aligns note heads with the tab digits above them', async ({ page }) => {
    await waitForEditorShell(page)
    await toggleClassicalNotation(page)
    await expect(page.locator('.vexFlowRow .vf-notehead').first()).toBeVisible({ timeout: 10_000 })

    const { tabCenters, headCenters } = await page.evaluate(() => {
      const center = (element: Element) => {
        const rect = element.getBoundingClientRect()
        return rect.left + rect.width / 2
      }
      return {
        tabCenters: [...document.querySelectorAll('.tab-row .note-text')].map(center),
        // First path of a notehead group is the head glyph itself.
        headCenters: [...document.querySelectorAll('.vexFlowRow .vf-notehead > path:first-child')].map(
          center,
        ),
      }
    })

    expect(tabCenters.length).toBeGreaterThan(0)
    for (const x of tabCenters) {
      const nearest = Math.min(...headCenters.map((headX) => Math.abs(headX - x)))
      expect(nearest, `tab note at x=${x.toFixed(1)}`).toBeLessThanOrEqual(1.5)
    }
  })

  test('redraws the staff when a note is entered while classical is on', async ({ page }) => {
    await waitForEditorShell(page)
    await toggleClassicalNotation(page)
    await waitForScrollIdle(page)
    await expect(page.locator('.vexFlowRow .vf-notehead').first()).toBeVisible({ timeout: 10_000 })

    // Row 1 starts with empty measures in the demo song.
    const secondRowStrings = page.locator('.tab-row').nth(1).locator('.string-click-area')
    await secondRowStrings.first().click({ position: { x: 40, y: 4 } })
    await page.keyboard.press('7')

    const enteredDigit = page.locator('.tab-row').nth(1).locator('.note-text').filter({ hasText: /^7$/ })
    await expect(enteredDigit).toHaveCount(1)
    const digitX = await enteredDigit.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left + rect.width / 2
    })

    await expect
      .poll(async () =>
        page
          .locator('.vexFlowRow')
          .nth(1)
          .locator('.vf-notehead > path:first-child')
          .evaluateAll(
            (heads, x) =>
              heads.some((head) => {
                const rect = head.getBoundingClientRect()
                return Math.abs(rect.left + rect.width / 2 - x) <= 1.5
              }),
            digitX,
          ),
      )
      .toBe(true)
  })

  test('draws exactly one non-overlapping staff under every row, also deep into a long song', async ({
    page,
  }) => {
    await waitForEditorShell(page)
    await growSong(page)
    await toggleClassicalNotation(page)
    await waitForScrollIdle(page)

    await page.locator('#mainContent').evaluate((element) => {
      element.scrollTop = 0
    })
    await expectOneStaffUnderEachRow(page)

    await page.locator('#mainContent').evaluate((element) => {
      element.scrollTop = element.scrollHeight / 2
    })
    await expectOneStaffUnderEachRow(page)

    await page.locator('#mainContent').evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expectOneStaffUnderEachRow(page)
    await expect(page.locator('.vexFlowRow').last()).toBeInViewport()
  })
})
