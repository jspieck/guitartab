import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

test('phone: the ⋯ menu opens the example songs as a sheet and loads one', async ({ page }) => {
  await waitForEditorShell(page)
  await page.locator('#compactMoreButton').tap()
  await page.locator('#compactMoreMenu').getByRole('menuitem', { name: 'Example songs…' }).tap()
  const dialog = page.locator('#exampleSongsModal')
  await expect(dialog).toBeVisible()
  // A bottom sheet: as wide as the screen, buttons stacked under each piece.
  const box = (await dialog.boundingBox())!
  expect(box.width).toBeGreaterThan((page.viewportSize()!.width * 9) / 10)
  await dialog.getByRole('button', { name: 'Open Minuet in G, BWV Anh. 114' }).tap()
  await expect(dialog).toBeHidden()
  await expect
    .poll(() =>
      page.evaluate(async () => (await import('/src/stores/song.ts')).default.songDescription.title),
    )
    .toBe('Minuet in G, BWV Anh. 114')
})
