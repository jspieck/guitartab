import { expect, test, type Page } from '@playwright/test'
import { toggleClassicalNotation, toggleTabView, waitForEditorShell } from './helpers'

/** Big win 24 in the app: clef changes, slash beats, rhythm on stems, multi-bar rests, note conventions. */

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
}

test.describe('tab notation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await waitForEditorShell(page, { demo: 'arrangement' })
  })

  test('the clef dialog changes the clef from a bar on, undoably, and the staff draws it', async ({
    page,
  }) => {
    await toggleClassicalNotation(page)
    await page.waitForSelector('.vexFlowRow svg')
    await page.evaluate(async () => {
      const { selectionState } = await import('/src/stores/selectionState.ts')
      selectionState.cursor.blockId = 1
      selectionState.cursor.beatId = 0
    })
    await page.locator('#barButton4').click()
    await page.locator('#clef').click()
    const dialog = page.locator('#clefModal')
    await expect(dialog).toHaveClass(/active/)
    await dialog.locator('#clef-select').selectOption('bass')
    await dialog.locator('#clefSubmit').click()

    const clefs = () =>
      page.evaluate(async () => {
        const { default: Song } = await import('/src/stores/song.ts')
        return JSON.parse(JSON.stringify(Song.tracks[Song.currentTrackId].clefs ?? null))
      })
    expect(await clefs()).toEqual({ 1: 'bass' })
    // the row's own clef plus the small one at bar 2
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('.vexFlowRow svg')?.querySelectorAll('.vf-clef').length),
      )
      .toBeGreaterThanOrEqual(2)

    await page.keyboard.press('Control+z')
    expect(await clefs()).toBeNull()
  })

  test('slash beats show a slash instead of the frets, in the tab and on the staff', async ({ page }) => {
    await toggleClassicalNotation(page)
    await page.waitForSelector('.vexFlowRow svg')
    const firstBarFrets = () =>
      page.locator('.tab-row').first().locator('.tab-measure').first().locator('.note-text')
    const frets = await firstBarFrets().count()
    expect(frets).toBeGreaterThan(0)
    await page.evaluate(async () => {
      const { selectionState } = await import('/src/stores/selectionState.ts')
      Object.assign(selectionState.cursor, { blockId: 0, beatId: 0 })
      const { toggleSlashBeats } = await import('/src/services/editor/rhythmCommands.ts')
      toggleSlashBeats()
    })
    await expect(page.locator('.tab-svg .slash-head')).toHaveCount(1)
    expect(await firstBarFrets().count()).toBeLessThan(frets)
    await page.keyboard.press('Control+z')
    await expect(page.locator('.tab-svg .slash-head')).toHaveCount(0)
  })

  test('rhythm on stems hangs the stems from the digits; voice 1 goes up beside a second voice', async ({
    page,
  }) => {
    const stemStarts = () =>
      page.evaluate(() =>
        [
          ...document
            .querySelectorAll('.tab-row')[0]
            .querySelectorAll('.tab-measure')[0]
            .querySelectorAll('.stem-line'),
        ].map((line) => Number(line.getAttribute('y1'))),
      )
    const band = new Set(await stemStarts())
    expect(band.size).toBe(1)
    await toggleTabView(page, 'rhythmStemsToggle')
    await expect.poll(async () => new Set(await stemStarts()).size).toBeGreaterThan(1)

    await page.evaluate(async () => {
      const { setFret } = await import('/src/services/editor/noteCommands.ts')
      setFret(0, 0, 1, 0, 0, 5)
    })
    // the first voice's beams now sit above the top string (y < 0)
    await expect
      .poll(() =>
        page.evaluate(() =>
          Number(document.querySelector('.tab-row .tab-measure .stem-line')?.getAttribute('y2')),
        ),
      )
      .toBeLessThan(0)
    await toggleTabView(page, 'rhythmStemsToggle')
  })

  test('multi-bar rests collapse empty bars and open again when a note is written', async ({ page }) => {
    await page.evaluate(async () => {
      const { insertBars } = await import('/src/services/editor/measureStructureCommands.ts')
      insertBars(2, 3)
    })
    await toggleTabView(page, 'multiRestToggle')
    const rest = page.locator('.tab-svg .multi-rest')
    await expect(rest).toHaveCount(1)
    await expect(rest.locator('.multi-rest-count')).toHaveText('3')
    await settle(page)

    // a note in the second empty bar splits the run: no run of two is left before it
    await page.evaluate(async () => {
      const { setFret } = await import('/src/services/editor/noteCommands.ts')
      const { barWidthChangesRows } = await import('/src/services/editor/measureLayoutEngine.ts')
      setFret(0, 3, 0, 0, 0, 7)
      barWidthChangesRows(0, 3, 0)
    })
    await expect(rest).toHaveCount(0)
    await toggleTabView(page, 'multiRestToggle')
  })

  test('dead and ghost notes look like Guitar Pro’s', async ({ page }) => {
    const texts = await page.evaluate(async () => {
      const { default: Song } = await import('/src/stores/song.ts')
      const { recordBarEdit } = await import('/src/services/editor/editCommands.ts')
      recordBarEdit('Conventions', { trackId: 0, blockIds: [0] }, () => {
        const beats = Song.measures[0][0][0]
        const first = (index: number) => Array.from(beats[index].notes).find((note) => note != null)!
        first(1).dead = true
        first(2).ghost = true
        first(3).artificialStyle = 'N.H.'
      })
      await new Promise((resolve) => setTimeout(resolve, 100))
      return [...document.querySelector('.tab-row .tab-measure')!.querySelectorAll('.note-text')].map((t) =>
        t.textContent?.trim(),
      )
    })
    expect(texts).toContain('x')
    expect(texts.some((text) => /^\(\d+\)$/.test(text ?? ''))).toBe(true)
    expect(texts.some((text) => /^<\d+>$/.test(text ?? ''))).toBe(true)
  })
})
