import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

// Edits that used to skip the undo history: toolbar toggles that remove data
// and the toolbar tempo drag. Both now go through executeCommand().

async function cursorBeatText(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const { default: Song } = await import('/src/assets/js/songData.ts')
    const { selectionState } = await import('/src/stores/selectionState.ts')
    const { trackId, blockId, voiceId, beatId } = selectionState.cursor
    return Song.measures[trackId][blockId][voiceId][beatId].text ?? null
  })
}

test('removing beat text with the toolbar button can be undone with Ctrl+Z', async ({ page }) => {
  await waitForEditorShell(page)
  await page
    .locator('.string-click-area')
    .first()
    .click({ position: { x: 80, y: 4 } })

  await page.evaluate(async () => {
    const { default: Song } = await import('/src/assets/js/songData.ts')
    const { selectionState } = await import('/src/stores/selectionState.ts')
    const { trackId, blockId, voiceId, beatId } = selectionState.cursor
    Song.measures[trackId][blockId][voiceId][beatId].text = 'Intro'
  })

  // The button sits in a toolbar group that may be collapsed; click it through the DOM.
  await page.evaluate(() => (document.getElementById('addText') as HTMLButtonElement).click())
  expect(await cursorBeatText(page)).toBeNull()

  await page.keyboard.press('Control+z')
  await expect.poll(() => cursorBeatText(page)).toBe('Intro')

  await page.keyboard.press('Control+y')
  await expect.poll(() => cursorBeatText(page)).toBeNull()
})

test('a tempo drag is one undo step', async ({ page }) => {
  await waitForEditorShell(page)
  const bpm = () =>
    page.evaluate(async () => {
      const { default: Song } = await import('/src/assets/js/songData.ts')
      return Song.bpm
    })
  const before = await bpm()

  const meter = page.locator('#tempoMeter')
  const box = (await meter.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let step = 1; step <= 4; step += 1) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - step * 5)
  }
  await page.mouse.up()
  expect(await bpm()).toBe(before + 20)
  await expect(meter).toHaveText(String(before + 20))

  await page.keyboard.press('Control+z')
  await expect.poll(bpm).toBe(before)
  await expect(meter).toHaveText(String(before))
})
