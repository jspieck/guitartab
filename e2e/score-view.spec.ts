import { expect, test, type Page } from '@playwright/test'
import { toggleClassicalNotation, toggleTabView, waitForEditorShell } from './helpers'

// Audit Big win 25: the score view (several tracks per system) and editing both voices.

async function editorState(page: Page) {
  return page.evaluate(async () => {
    const { default: Song } = await import('/src/stores/song.ts')
    const { selectionState } = await import('/src/stores/selectionState.ts')
    const { default: Settings } = await import('/src/stores/settingsState.ts')
    return {
      track: Song.currentTrackId,
      voice: Song.currentVoiceId,
      cursor: { ...selectionState.cursor },
      scoreView: Settings.scoreView,
    }
  })
}

/** Bar-line x positions of each staff of the first system, by track. */
async function firstSystemBarLines(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<SVGGElement>('.tab-row[data-row-id="0"]')].map((row) => ({
      track: Number(row.dataset.trackId),
      xs: [...row.querySelectorAll('.tab-separator-line')].map((line) => line.getAttribute('x1')),
    })),
  )
}

test.describe('score view', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditorShell(page, { demo: 'arrangement' })
    await toggleTabView(page, 'scoreViewToggle')
    await expect(page.locator('.score-track-name').first()).toBeVisible()
  })

  test('stacks every track per system with the same bar lines, names and a bracket', async ({ page }) => {
    const staves = await firstSystemBarLines(page)
    expect(staves.map((staff) => staff.track)).toEqual([0, 1, 2, 3])
    for (const staff of staves) expect(staff.xs).toEqual(staves[0].xs)
    await expect(page.locator('.score-track-name').nth(2)).toHaveText('Bass')
    await expect(page.locator('.score-bracket').first()).toBeAttached()
  })

  test('the track menu hides a track; the edited one stays', async ({ page }) => {
    await page.locator('#tabViewMenuButton').click()
    await page.locator('#scoreTrack-1').click()
    expect((await firstSystemBarLines(page)).map((staff) => staff.track)).toEqual([0, 2, 3])
    await page.locator('#tabViewMenuButton').click()
    await expect(page.locator('#scoreTrack-0')).toHaveAttribute('aria-checked', 'true')
    await page.locator('#scoreTrack-0').click()
    expect((await firstSystemBarLines(page)).map((staff) => staff.track)).toEqual([0, 2, 3])
  })

  test('a click in another staff edits that track; Alt+↑/↓ moves between staves', async ({ page }) => {
    const bassTopString = page
      .locator('.tab-row[data-track-id="2"][data-row-id="0"] .string-click-area')
      .first()
    await bassTopString.click({ position: { x: 120, y: 6 } })
    await expect.poll(async () => (await editorState(page)).track).toBe(2)
    const { cursor } = await editorState(page)
    expect(cursor).toMatchObject({ trackId: 2, voiceId: 0, string: 3 })

    await page.keyboard.press('7')
    await expect
      .poll(() =>
        page.evaluate(async ({ blockId, beatId }) => {
          const { default: Song } = await import('/src/stores/song.ts')
          return Song.measures[2][blockId][0][beatId].notes[3]?.fret ?? null
        }, cursor),
      )
      .toBe(7)

    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(async () => (await editorState(page)).track).toBe(3)
    expect((await editorState(page)).cursor.blockId).toBe(cursor.blockId)
    await page.keyboard.press('Alt+ArrowUp')
    await page.keyboard.press('Alt+ArrowUp')
    await expect.poll(async () => (await editorState(page)).track).toBe(1)
    // the edited staff's name is marked
    await expect(page.locator('.score-track-name--edited').first()).toHaveText('Lead')
  })

  test('classical notation and the score view exclude each other', async ({ page }) => {
    await toggleClassicalNotation(page)
    await expect.poll(async () => (await editorState(page)).scoreView).toBe(false)
    await expect(page.locator('.score-track-name')).toHaveCount(0)
  })

  test('print pages break between systems', async ({ page }) => {
    const { slices, systems } = await page.evaluate(async () => {
      const { printPageSlices } = await import('/src/services/printView.ts')
      const { scoreSystems } = await import('/src/stores/scoreViewState.ts')
      return { slices: printPageSlices(20_000, 700), systems: scoreSystems.length }
    })
    expect(systems).toBeGreaterThan(1)
    expect(slices.length).toBeGreaterThan(1)
    // the pages are cut from whole systems (one band each), not from the staves' rows
    expect(slices.at(-1)!.endRow).toBe(systems)
    slices.forEach((slice, index) => index > 0 && expect(slice.firstRow).toBe(slices[index - 1].endRow))
  })
})

test('a click on a faint voice-2 note edits voice 2 there, and the cursor says so', async ({ page }) => {
  await waitForEditorShell(page)
  // a voice-2 note in the first beat, on a string voice 1 leaves free there (entered as a user would)
  const string = await page.evaluate(async () => {
    const { default: Song } = await import('/src/stores/song.ts')
    const { notes } = Song.measures[0][0][0][0]
    return [0, 1, 2, 3, 4, 5].find((string) => notes[string] == null)!
  })
  await page.keyboard.press('Alt+2')
  // the cursor goes with the voice switch, keeping its beat
  await expect(page.locator('.selection-indicator--voice2')).toBeVisible()
  expect((await editorState(page)).cursor).toMatchObject({ voiceId: 1, beatId: 0 })
  await page.evaluate(async (free) => {
    const { typedEventBus } = await import('/src/utils/typedEventBus.ts')
    typedEventBus.emit('navigation.setClickedPos', {
      trackId: 0,
      voiceId: 1,
      blockId: 0,
      beatId: 0,
      string: free,
    })
  }, string)
  await page.keyboard.press('9')
  await page.waitForTimeout(700)
  await page.keyboard.press('Alt+1')
  await expect.poll(async () => (await editorState(page)).voice).toBe(0)

  const faint = page.locator('.other-voice-note').first()
  await expect(faint).toHaveText('9')
  const box = (await faint.boundingBox())!
  // the digit's centre is on its string line
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

  await expect.poll(async () => (await editorState(page)).voice).toBe(1)
  expect((await editorState(page)).cursor).toMatchObject({ voiceId: 1, blockId: 0, beatId: 0, string })
  await expect(page.locator('.selection-indicator--voice2')).toBeVisible()
  // voice 1's notes are faint now
  await expect(page.locator('.other-voice-notes').first()).toBeAttached()
})
