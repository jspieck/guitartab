import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

/** Bar 1, beat 1 of the riff as `duration:frets` (string 0 first), plus the cursor. */
async function readFirstBeats(page: Page) {
  return page.evaluate(async () => {
    const { default: Song } = await import('/src/assets/js/songData.ts')
    const { selectionState } = await import('/src/stores/selectionState.ts')
    const beats = Song.measures[0][0][0]
    return {
      cursor: { beatId: selectionState.cursor.beatId, string: selectionState.cursor.string },
      beats: beats.map(
        (beat) => `${beat.duration}:${Array.from(beat.notes, (note) => note?.fret ?? '-').join(',')}`,
      ),
    }
  })
}

async function isPlaying(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const { playbackTransportState } = await import('/src/stores/playbackTransportState.ts')
    return playbackTransportState.isPlaying
  })
}

async function selectTopStringOfFirstBeat(page: Page): Promise<void> {
  await page
    .locator('.string-click-area')
    .first()
    .click({ position: { x: 80, y: 4 } })
}

test.describe('keyboard shortcuts', () => {
  test('two quick digits enter a two-digit fret; a slow second digit replaces it', async ({ page }) => {
    await waitForEditorShell(page)
    await selectTopStringOfFirstBeat(page)

    await page.keyboard.press('1')
    await page.keyboard.press('2')
    await expect.poll(async () => (await readFirstBeats(page)).beats[0]).toBe('e:0,-,-,-,-,12')

    await page.waitForTimeout(1100)
    await page.keyboard.press('5')
    await expect.poll(async () => (await readFirstBeats(page)).beats[0]).toBe('e:0,-,-,-,-,5')

    // Too high for a guitar fret: 5 then 5 is 5, not 55.
    await page.keyboard.press('5')
    await page.waitForTimeout(200)
    expect((await readFirstBeats(page)).beats[0]).toBe('e:0,-,-,-,-,5')
  })

  test('letters set the note length, arrows move, Delete removes', async ({ page }) => {
    await waitForEditorShell(page)
    await selectTopStringOfFirstBeat(page)
    await page.keyboard.press('7')
    await expect.poll(async () => (await readFirstBeats(page)).beats[0]).toBe('e:0,-,-,-,-,7')

    await page.keyboard.press('s')
    await expect.poll(async () => (await readFirstBeats(page)).beats[0]).toMatch(/^s:/)

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    await expect.poll(async () => (await readFirstBeats(page)).cursor).toEqual({ beatId: 1, string: 4 })
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowUp')
    await expect.poll(async () => (await readFirstBeats(page)).cursor).toEqual({ beatId: 0, string: 5 })

    await page.keyboard.press('Delete')
    await expect.poll(async () => (await readFirstBeats(page)).beats[0]).toMatch(/:0,-,-,-,-,-$/)
  })

  test('Space plays and pauses, but not while typing in a field', async ({ page }) => {
    await waitForEditorShell(page)
    await selectTopStringOfFirstBeat(page)

    await page.keyboard.press('Space')
    await expect.poll(() => isPlaying(page)).toBe(true)
    await page.keyboard.press('Space')
    await expect.poll(() => isPlaying(page)).toBe(false)

    await page.evaluate(() => {
      const input = document.createElement('input')
      input.id = 'zzTypingField'
      document.body.append(input)
      input.focus()
    })
    await page.keyboard.type('3 4')
    await expect(page.locator('#zzTypingField')).toHaveValue('3 4')
    await page.waitForTimeout(300)
    expect(await isPlaying(page)).toBe(false)
    expect((await readFirstBeats(page)).beats[0]).toBe('e:0')
  })

  test('? and the toolbar button open the shortcut list; Escape closes it', async ({ page }) => {
    await waitForEditorShell(page)
    await page.locator('#tabBar').click({ position: { x: 600, y: 10 } })

    await page.keyboard.press('Shift+Slash')
    const sheet = page.locator('#shortcutsHelp')
    await expect(sheet).toBeVisible()
    await expect(sheet.locator('[data-shortcut="playPause"]')).toContainText('Space')
    await expect(sheet.locator('[data-shortcut="undo"] kbd').first()).toHaveText(/Ctrl|âŒ˜/)
    // The sheet lists every shortcut in the table.
    const { SHORTCUTS } = await page.evaluate(async () => {
      const module = await import('/src/utils/keyboardShortcuts.ts')
      return { SHORTCUTS: module.SHORTCUTS.map((shortcut) => shortcut.id) }
    })
    await expect(sheet.locator('[data-shortcut]')).toHaveCount(SHORTCUTS.length)

    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)

    await page.locator('#shortcutsHelpButton').click()
    await expect(sheet).toBeVisible()
    await page.locator('#shortcutsHelp [aria-label="Close"]').click()
    await expect(sheet).toHaveCount(0)
  })
})

test.describe('first-run hint', () => {
  test('shows with the demo song until dismissed', async ({ page }) => {
    await waitForEditorShell(page, { demo: 'arrangement' })
    const hint = page.locator('#firstRunHint')
    await expect(hint).toBeVisible()
    await expect(hint.locator('li')).toHaveCount(3)

    // Still there after a reload, until the user dismisses it.
    await page.reload()
    await expect(hint).toBeVisible()
    await hint.getByRole('button', { name: 'Got it' }).click()
    await expect(hint).toHaveCount(0)
    await page.reload()
    await page.waitForSelector('.tab-row')
    await expect(hint).toHaveCount(0)
  })

  test('"All shortcuts" opens the shortcut list', async ({ page }) => {
    await waitForEditorShell(page, { demo: 'arrangement' })
    await page
      .locator('#firstRunHint')
      .getByRole('button', { name: /All shortcuts/ })
      .click()
    await expect(page.locator('#shortcutsHelp')).toBeVisible()
    await expect(page.locator('#firstRunHint')).toHaveCount(0)
  })
})
