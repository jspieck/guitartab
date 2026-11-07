import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

/** Palm mute on the note at the cursor (null when there is no note). */
async function cursorNote(page: Page) {
  return page.evaluate(async () => {
    const { default: Song } = await import('/src/stores/song.ts')
    const { selectionState } = await import('/src/stores/selectionState.ts')
    const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
    const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string]
    return note ? { fret: note.fret, palmMute: note.palmMute === true, beatId, string } : null
  })
}

/** Clicks the n-th note of the tab (the string's click area lies on top of the digits). */
async function clickNote(page: Page, index: number, button: 'left' | 'right' = 'left') {
  const box = (await page.locator('.note-text').nth(index).boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button })
}

const rightClickNote = (page: Page, index: number) => clickNote(page, index, 'right')

test.describe('note menu', () => {
  test('right-click selects the note; palm mute toggles it and Ctrl+Z undoes it', async ({ page }) => {
    await waitForEditorShell(page)
    await rightClickNote(page, 1)
    const menu = page.locator('#noteMenu')
    await expect(menu).toBeVisible()
    const before = (await cursorNote(page))!
    expect(before.palmMute).toBe(false)
    await expect(menu).toContainText(`fret ${before.fret}`)

    const palmMute = menu.getByRole('menuitemcheckbox', { name: 'Palm mute' })
    await palmMute.click()
    await expect.poll(async () => (await cursorNote(page))?.palmMute).toBe(true)
    // The menu stays open for further toggles and shows the new state.
    await expect(palmMute).toHaveAttribute('aria-checked', 'true')

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await cursorNote(page))?.palmMute).toBe(false)
  })

  test('Shift+F10 opens it at the cursor; arrow keys move, Escape closes', async ({ page }) => {
    await waitForEditorShell(page)
    await clickNote(page, 0)
    await page.keyboard.press('Shift+F10')
    const menu = page.locator('#noteMenu')
    await expect(menu).toBeVisible()
    const first = menu.getByRole('menuitemcheckbox', { name: 'Hammer-on / pull-off' })
    await expect(first).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Slide' })).toBeFocused()
    // The arrows stay in the menu: the cursor did not move to another string.
    const cursor = await cursorNote(page)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    expect(await cursorNote(page)).toEqual(cursor)
  })

  test('"All effects" switches the edit bar to the Effects tab', async ({ page }) => {
    await waitForEditorShell(page)
    await rightClickNote(page, 0)
    await page.locator('#noteMenu').getByRole('menuitem', { name: 'All effects…' }).click()
    await expect(page.locator('#barButton2')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#palmMute')).toBeVisible()
  })

  test('dynamics are disabled on a rest instead of failing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await waitForEditorShell(page)
    await page.locator('#barButton3').click()
    // An empty string of the first beat.
    await page.evaluate(async () => {
      const { selectionState } = await import('/src/stores/selectionState.ts')
      selectionState.cursor = { ...selectionState.cursor, blockId: 0, beatId: 0, string: 3 }
    })
    expect(await cursorNote(page)).toBeNull()
    await expect(page.locator('#pDynamic')).toBeDisabled()
    expect(errors).toEqual([])
  })
})

test.describe('toolbar at narrow widths', () => {
  /** Every visible button lies inside the bar (nothing clipped). */
  async function clippedButtons(page: Page) {
    return page.evaluate(() => {
      const out: string[] = []
      for (const bar of Array.from(document.querySelectorAll('#tabBar, #statusBars'))) {
        const box = bar.getBoundingClientRect()
        for (const el of Array.from(bar.querySelectorAll<HTMLElement>('button, select, [role="button"]'))) {
          const rect = el.getBoundingClientRect()
          if (rect.width === 0) continue
          if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5)
            out.push(el.id || el.textContent!.trim())
        }
      }
      return out
    })
  }

  for (const [width, folded] of [
    [1400, []],
    [1024, ['#fileMenuButton']],
    [900, ['#fileMenuButton', '#viewMenuButton']],
  ] as const) {
    test(`${width} px: groups fold into menus instead of clipping`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await waitForEditorShell(page)
      for (const tab of [1, 2, 3, 4, 5]) {
        await page.locator(`#barButton${tab}`).click()
        await expect.poll(() => clippedButtons(page)).toEqual([])
      }
      for (const menu of folded) await expect(page.locator(menu)).toBeVisible()
      if (folded.length === 0) {
        await expect(page.locator('#openFile')).toBeVisible()
        await expect(page.locator('#classicalToggleButton')).toBeVisible()
      }
    })
  }

  test('1024 px: the folded File menu opens files and offers Save as', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 })
    await waitForEditorShell(page)
    await page.locator('#fileMenuButton').click()
    const menu = page.getByRole('menu', { name: 'File' })
    await expect(menu.getByRole('menuitem', { name: 'GuitarTab (.gt)' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Open file' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(page.locator('#fileMenuButton')).toBeFocused()
  })

  test('Effects folds its last groups into More, which runs the same commands', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 })
    await waitForEditorShell(page)
    await clickNote(page, 1)
    await page.locator('#barButton2').click()
    await page.locator('#editMoreButton').click()
    await page.getByRole('menuitemcheckbox', { name: 'Let ring' }).click()
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const { default: Song } = await import('/src/stores/song.ts')
          const { selectionState } = await import('/src/stores/selectionState.ts')
          const { trackId, blockId, voiceId, beatId, string } = selectionState.cursor
          return Song.measures[trackId][blockId][voiceId][beatId].notes[string]?.letRing === true
        }),
      )
      .toBe(true)
  })
})

test('the tempo pill takes a typed tempo as one undo step', async ({ page }) => {
  await waitForEditorShell(page)
  const bpm = () => page.evaluate(async () => (await import('/src/stores/song.ts')).default.bpm)
  const before = await bpm()
  await page.locator('#tempoMeter').click()
  const input = page.getByRole('spinbutton', { name: 'Song tempo in beats per minute' })
  await input.fill('133')
  await input.press('Enter')
  await expect(page.locator('#tempoMeter')).toHaveText('133')
  expect(await bpm()).toBe(133)
  await page.keyboard.press('Control+z')
  await expect.poll(bpm).toBe(before)
})
