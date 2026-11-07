import { expect, test } from '@playwright/test'
import { toggleClassicalNotation, toggleTabView, waitForEditorShell } from './helpers'

/** Big wins 13 and 14 in the app: key signatures, tied notes in parentheses, print pages, section loops, tuner. */

test.describe('notation and practice', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await waitForEditorShell(page, { demo: 'arrangement' })
  })

  test('the key signature dialog sets the key until the next change, undoably, and the staff draws it', async ({
    page,
  }) => {
    await toggleClassicalNotation(page)
    await page.waitForSelector('.vexFlowRow svg')
    await page.locator('#barButton4').click()
    await page.locator('#keySignature').click()
    const dialog = page.locator('#keySignatureModal')
    await expect(dialog).toHaveClass(/active/)
    await dialog.locator('#key-signature-fifths').selectOption('-3')
    await dialog.locator('#keySignatureSubmit').click()

    const keys = () =>
      page.evaluate(async () => {
        const { default: Song } = await import('/src/stores/song.ts')
        return Song.measureMeta.map((meta) => meta.keySignature)
      })
    expect(new Set(await keys())).toEqual(new Set([-3]))
    // three flats at the start of each row's staff (VexFlow draws accidentals as glyph paths/text)
    const firstRowKeyGlyphs = await page.evaluate(
      () =>
        document.querySelector('.vexFlowRow svg')?.querySelectorAll('.vf-keysignature, g.vf-modifiers')
          .length ?? 0,
    )
    expect(firstRowKeyGlyphs).toBeGreaterThan(0)

    await page.keyboard.press('Control+z')
    expect(new Set(await keys())).toEqual(new Set([0]))
  })

  test('tied notes can show their fret in parentheses', async ({ page }) => {
    // tie the first note of beat 2 to the same string in beat 1
    const fret = await page.evaluate(async () => {
      const { default: Song } = await import('/src/stores/song.ts')
      const { redrawTrack } = await import('/src/services/editor/layoutInvalidation.ts')
      const beats = Song.measures[Song.currentTrackId][0][0]
      const string = Array.from(beats[1].notes).findIndex((note) => note != null)
      const note = beats[1].notes[string]!
      beats[0].notes[string] ??= { ...note }
      note.fret = beats[0].notes[string]!.fret
      note.tied = true
      redrawTrack(Song.currentTrackId, Song.currentVoiceId)
      return note.fret
    })
    const parenthesised = page.locator('.tab-svg text.tied-note')
    await expect(parenthesised).toHaveCount(0)
    await toggleTabView(page, 'tiedParenthesesToggle')
    await expect(parenthesised.first()).toHaveText(`(${fret})`)
    await toggleTabView(page, 'tiedParenthesesToggle')
    await expect(parenthesised).toHaveCount(0)
  })

  test('the print view puts whole rows on numbered A4 pages', async ({ page }) => {
    await page.evaluate(async () => {
      const { addBlock } = await import('/src/services/editor/measureStructureCommands.ts')
      for (let i = 0; i < 30; i += 1) addBlock()
    })
    const pages = await page.evaluate(async () => {
      const { composeFullTabExportSvg } = await import('/src/services/pdfExport.ts')
      const { buildPrintView } = await import('/src/services/printView.ts')
      const composed = await composeFullTabExportSvg()
      const view = buildPrintView(composed!)
      const rows = [...document.querySelectorAll('.tab-svg g.tab-row')].length
      return {
        count: view.querySelectorAll('.print-page').length,
        footers: [...view.querySelectorAll('.print-page__footer')].map((footer) => footer.textContent),
        viewBoxes: [...view.querySelectorAll('svg.print-page__tab')].map((svg) =>
          svg.getAttribute('viewBox')!.split(' ').map(Number),
        ),
        rows,
      }
    })
    expect(pages.count).toBeGreaterThan(1)
    expect(pages.footers[0]).toBe(`Page 1 of ${pages.count}`)
    // pages follow each other without overlapping
    for (let i = 1; i < pages.viewBoxes.length; i += 1) {
      const [, top] = pages.viewBoxes[i]
      const [, previousTop, , previousHeight] = pages.viewBoxes[i - 1]
      expect(top).toBeGreaterThanOrEqual(previousTop + previousHeight - 0.5)
    }
  })

  test('clicking a marker in the sequencer loops its section; clicking again ends the loop', async ({
    page,
  }) => {
    const marker = page.locator('#masterRowMain .beatText').nth(1)
    await expect(marker).toBeVisible()
    await marker.click()
    await expect(marker).toHaveAttribute('aria-pressed', 'true')
    const loop = await page.evaluate(async () => {
      const { currentLoopInterval } = await import('/src/services/editor/rangeSelection.ts')
      const { default: Song } = await import('/src/stores/song.ts')
      const markers = Song.measureMeta.flatMap((meta, blockId) => (meta.marker ? [blockId] : []))
      return { interval: currentLoopInterval(), markers }
    })
    expect(loop.interval).toMatchObject({ startBlock: loop.markers[1], endBlock: loop.markers[2] - 1 })
    await marker.click()
    await expect(marker).toHaveAttribute('aria-pressed', 'false')
  })

  test('the tuner explains when there is no microphone', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
      })
    })
    await page.locator('#tunerButton').click()
    const dialog = page.locator('#tunerModal')
    await expect(dialog).toHaveClass(/active/)
    await expect(dialog.getByRole('alert')).toContainText('Microphone access was denied')
  })
})
