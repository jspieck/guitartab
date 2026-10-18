import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

/**
 * Song data stores strings lowest first (index 0 = low E); tablature shows the highest
 * string on the top line. These tests pin that down in the running app.
 */
test.describe('tab string order', () => {
  test('an E minor chord reads 0 0 0 2 2 0 from the top line down', async ({ page }) => {
    await waitForEditorShell(page)
    const frets = await page.evaluate(async () => {
      const { default: Song } = await import('/src/assets/js/songData.ts')
      const { default: editorCore } = await import('/src/services/editor/editorCore.ts')
      const { notifySongDataChanged } = await import('/src/services/appEvents.ts')
      // Em from the low E up: E B E G B E.
      ;[0, 2, 2, 0, 0, 0].forEach((fret, string) => editorCore.setNoteAtPosition(0, 5, 0, 0, string, fret))
      notifySongDataChanged()
      await new Promise((resolve) => setTimeout(resolve, 300))
      const beat = Song.measures[0][5][0][0]
      return beat.notes.map((note) => note?.fret ?? null)
    })
    expect(frets).toEqual([0, 2, 2, 0, 0, 0])

    const measure = page.locator('.tab-measure').nth(5)
    const drawn = await measure
      .locator('.tab-note')
      .first()
      .locator('.note-text')
      .evaluateAll((texts) =>
        texts
          .map((text) => ({ fret: text.textContent!.trim(), y: (text as SVGTextElement).getBBox().y }))
          .sort((a, b) => a.y - b.y)
          .map((entry) => entry.fret),
      )
    expect(drawn).toEqual(['0', '0', '0', '2', '2', '0'])
  })

  test('clicking the top line enters the note on the highest string', async ({ page }) => {
    await waitForEditorShell(page)
    // The first click area is the top line.
    await page
      .locator('.string-click-area')
      .first()
      .click({ position: { x: 80, y: 4 } })
    await page.keyboard.press('7')
    const strings = await page.evaluate(async () => {
      const { default: Song } = await import('/src/assets/js/songData.ts')
      return Song.measures[0][0][0]
        .flatMap((beat) => beat.notes.map((note, string) => (note?.fret === 7 ? string : -1)))
        .filter((string) => string >= 0)
    })
    expect(strings).toEqual([5])
  })
})
