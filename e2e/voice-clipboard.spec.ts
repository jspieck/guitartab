import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

// Audit Big win 25: copy and paste work per voice. A beat copied in voice 1 pastes into voice 2
// at the cursor's time (the riff's two voices are both eighths here), and voice 1 stays as it was.

const cursor = (page: Page) =>
  page.evaluate(async () => ({ ...(await import('/src/stores/selectionState.ts')).selectionState.cursor }))

const frets = (page: Page, voice: number, blockId: number, beatId: number) =>
  page.evaluate(
    async ({ v, block, beat }) => {
      const { default: Song } = await import('/src/stores/song.ts')
      return Array.from(
        Song.measures[0][block][v][beat].notes,
        (note: { fret: number } | null) => note?.fret ?? null,
      )
    },
    { v: voice, block: blockId, beat: beatId },
  )

test('a beat copied in voice 1 pastes into voice 2; Ctrl+Z takes it out again', async ({ page }) => {
  await waitForEditorShell(page)
  await page
    .locator('.tab-row')
    .first()
    .locator('.string-click-area')
    .last()
    .click({ position: { x: 80, y: 6 } })
  const { blockId, beatId } = await cursor(page)
  const voice1 = await frets(page, 0, blockId, beatId)
  expect(voice1.some((fret) => fret != null)).toBe(true)

  await page.keyboard.press('Control+c')
  await page.keyboard.press('Alt+2')
  await expect.poll(async () => (await cursor(page)).voiceId).toBe(1)
  expect(await cursor(page)).toMatchObject({ blockId, beatId })
  await page.keyboard.press('Control+v')

  await expect.poll(() => frets(page, 1, blockId, beatId)).toEqual(voice1)
  expect(await frets(page, 0, blockId, beatId)).toEqual(voice1)

  await page.keyboard.press('Control+z')
  await expect
    .poll(async () => (await frets(page, 1, blockId, beatId)).every((fret) => fret == null))
    .toBe(true)
})
