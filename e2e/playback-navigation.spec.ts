import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell, waitForSoundFont } from './helpers'

async function openDemo(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 })
  await waitForEditorShell(page, { demo: 'arrangement' })
  await waitForSoundFont(page)
  await page.waitForFunction(() => document.body.innerText.includes('Open Road'), null, { timeout: 15_000 })
  await page.waitForTimeout(500)
}

test.describe('playback navigation', () => {
  test('autoscroll turns pages: forward only, row always visible, fewer scrolls than rows', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    // Desktop height: about three rows fit, so the next row is usually already on screen.
    await page.setViewportSize({ width: 1400, height: 1000 })
    await waitForEditorShell(page, { demo: 'arrangement' })
    await waitForSoundFont(page)
    await waitForSoundFont(page)
    await page.waitForFunction(() => document.body.innerText.includes('Open Road'), null, { timeout: 15_000 })
    await page.waitForTimeout(500)
    await page.locator('#play').click()
    const samples: {
      scrollTop: number
      rowId: number
      top: number | null
      bottom: number | null
      view: number
    }[] = []
    // 30 s of the 36 s demo: rows 0 → 1, the repeat back inside row 1, then row 2.
    // Timed by the clock (not a sample count) and only while playing, so a slow run can't
    // run past the end of the song.
    const started = Date.now()
    while (Date.now() - started < 30_000) {
      await page.waitForTimeout(150)
      const sample = await page.evaluate(async () => {
        const { default: Settings } = await import('/src/stores/settingsState.ts')
        if (!Settings.songPlaying) return null
        const { default: playBackLogic } = await import('/src/assets/js/playbackEngine.ts')
        const { tab } = await import('/src/assets/js/tab.ts')
        const main = document.querySelector('#mainContent')!
        const rowId = tab.blockToRow[0][0][Math.max(0, playBackLogic.getCurrentBlock())].rowId
        const box = document.querySelector(`.tab-row[data-row-id="${rowId}"]`)?.getBoundingClientRect()
        const mainTop = main.getBoundingClientRect().top
        return {
          scrollTop: Math.round(main.scrollTop),
          rowId,
          top: box ? Math.round(box.top - mainTop) : null,
          bottom: box ? Math.round(box.bottom - mainTop) : null,
          view: main.clientHeight,
        }
      })
      if (sample == null) break
      samples.push(sample)
    }
    await page.locator('#play').click()
    const trace = JSON.stringify(samples.map((sample) => [sample.scrollTop, sample.rowId, sample.top]))
    // The only jump back (the repeat) stays inside one row, so the view never scrolls up.
    samples
      .slice(1)
      .forEach((sample, i) => expect(sample.scrollTop, trace).toBeGreaterThanOrEqual(samples[i].scrollTop))
    // Once a scroll has settled, the playing row is on screen.
    samples.slice(1).forEach((sample, i) => {
      if (sample.scrollTop !== samples[i].scrollTop || sample.top == null) return
      expect(sample.top, trace).toBeGreaterThanOrEqual(-2)
      expect(sample.top, trace).toBeLessThan(sample.view)
    })
    const rowChanges = samples.slice(1).filter((sample, i) => sample.rowId !== samples[i].rowId).length
    const scrolls = samples
      .slice(1)
      .filter(
        (sample, i) =>
          sample.scrollTop !== samples[i].scrollTop &&
          samples[i].scrollTop === (samples[i - 1] ?? samples[i]).scrollTop,
      ).length
    expect(rowChanges, trace).toBeGreaterThanOrEqual(2)
    // The view doesn't follow every row: it only turns the page when the row would leave it.
    expect(scrolls, trace).toBeLessThan(rowChanges)
  })

  test('after the user scrolled away, play goes straight back without first scrolling the other way', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await openDemo(page)
    await page.evaluate(() => {
      document.querySelector('#mainContent')!.scrollTop = 900
    })
    await page.waitForTimeout(300)
    await page.locator('#play').click()
    const tops: number[] = []
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(50)
      tops.push(await page.evaluate(() => Math.round(document.querySelector('#mainContent')!.scrollTop)))
    }
    await page.locator('#play').click()
    // Playback starts in bar 1: the view only moves up, to the top row.
    tops.slice(1).forEach((top, i) => expect(top, JSON.stringify(tops)).toBeLessThanOrEqual(tops[i]))
    expect(tops.at(-1)!, JSON.stringify(tops)).toBeLessThan(300)
  })

  test('pausing leaves the note marker on the beat that was playing', async ({ page }) => {
    test.setTimeout(60_000)
    await openDemo(page)
    await page
      .locator('.string-click-area')
      .first()
      .click({ position: { x: 80, y: 4 } })
    await page.locator('#play').click()
    await page.waitForTimeout(5000)
    await page.locator('#play').click()
    await page.waitForTimeout(500)
    const state = await page.evaluate(async () => {
      const { selectionState } = await import('/src/stores/selectionState.ts')
      const main = document.querySelector('#mainContent')!.getBoundingClientRect()
      const marker = document.querySelector('.selection-indicator rect')?.getBoundingClientRect()
      return {
        blockId: selectionState.cursor.blockId,
        string: selectionState.cursor.string,
        visible: marker != null && marker.top >= main.top && marker.bottom <= main.bottom,
      }
    })
    expect(state.blockId).toBeGreaterThanOrEqual(1) // ~2 bars at 112 BPM
    expect(state.string).toBe(5) // the string that was selected
    expect(state.visible).toBe(true)
  })

  test('clicking a measure while playing jumps there', async ({ page }) => {
    test.setTimeout(60_000)
    await openDemo(page)
    await page.locator('#play').click()
    await page.waitForTimeout(800)
    // Click the third measure of the first row (bar 3) on its top string.
    const measure = page.locator('.tab-row[data-row-id="0"] .tab-measure').nth(2)
    const box = (await measure.boundingBox())!
    const strings = (await page
      .locator('.tab-row[data-row-id="0"] .string-click-area')
      .first()
      .boundingBox())!
    await page.mouse.click(box.x + box.width / 2, strings.y + 6)
    await page.waitForTimeout(600)
    const block = await page.evaluate(async () =>
      (await import('/src/assets/js/playbackEngine.ts')).default.getCurrentBlock(),
    )
    await page.locator('#play').click()
    expect(block).toBe(2)
  })

  test('the sequencer has no horizontal scrollbar when everything fits', async ({ page }) => {
    await openDemo(page)
    const overflow = await page.evaluate(() => {
      const body = document.querySelector('#sequencerMainBody') as HTMLElement
      return body.scrollWidth - body.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
