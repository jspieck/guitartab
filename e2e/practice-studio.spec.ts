import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell, waitForSoundFont } from './helpers'

// Big win 28: the fretboard/keyboard under the tab, A/B loop handles, the loop by bar
// numbers, and the big beat counter while the song actually plays.

async function openPracticeOptions(page: Page): Promise<void> {
  await page.locator('#speedTrainerToggle').click()
  await expect(page.getByRole('dialog', { name: 'Practice options' })).toBeVisible()
}

async function loopInterval(page: Page) {
  return page.evaluate(async () => {
    const { currentLoopInterval } = await import('/src/services/editor/rangeSelection.ts')
    const loop = currentLoopInterval()
    return loop && { startBlock: loop.startBlock, startBeat: loop.startBeat, endBlock: loop.endBlock }
  })
}

test.describe('practice studio', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditorShell(page)
  })

  test('the big beat counter counts the beats of the bar while the song plays', async ({ page }) => {
    await waitForSoundFont(page)
    await openPracticeOptions(page)
    await page.locator('#bigBeatEnabled').check()
    await page.keyboard.press('Escape')
    await page.locator('#play').click()
    // read the counter every animation frame for 3 s (the riff: 90 BPM, a beat every 0.67 s)
    const seen = await page.evaluate(async () => {
      const { beatClockState } = await import('/src/stores/beatClockState.ts')
      const values: string[] = []
      const end = performance.now() + 3000
      while (performance.now() < end) {
        const value = `${beatClockState.blockId}:${beatClockState.beat}/${beatClockState.beats}`
        if (values[values.length - 1] !== value) values.push(value)
        await new Promise(requestAnimationFrame)
      }
      return values
    })
    await page.locator('#play').click()
    const counted = seen.filter((value) => value.startsWith('0:'))
    expect(counted.slice(0, 4)).toEqual(['0:1/4', '0:2/4', '0:3/4', '0:4/4'])
    await expect(page.locator('.big-beat')).toHaveCount(0) // hidden again when stopped
  })

  test('the fretboard under the tab shows the cursor beat, the next beats, and follows playback', async ({
    page,
  }) => {
    await openPracticeOptions(page)
    await page.locator('#practiceDockSelect').selectOption('guitar')
    await page.keyboard.press('Escape')
    const dock = page.locator('#practiceDock')
    await expect(dock).toBeVisible()
    // the riff's first beat at the cursor, the two after it as rings
    await expect(dock.locator('.fretboard__mark.guitarNoteMarker')).not.toHaveCount(0)
    await expect(dock.locator('.fretboard__mark--ahead1')).not.toHaveCount(0)

    await waitForSoundFont(page)
    const positions = async () =>
      dock
        .locator('.guitarNoteMarker')
        .evaluateAll((marks) =>
          marks
            .map((mark) => `${mark.getAttribute('data-string')}:${mark.getAttribute('data-fret')}`)
            .join(' '),
        )
    const first = await positions()
    await page.locator('#play').click()
    await expect.poll(positions, { timeout: 5000 }).not.toBe(first)
    await page.locator('#play').click()

    // the keyboard instead, then hidden; the choice is remembered
    await dock.getByRole('radio', { name: 'Piano' }).click()
    await expect(dock.locator('.piano .activeKey')).not.toHaveCount(0)
    await dock.getByRole('button', { name: /hide the fretboard/i }).click()
    await expect(dock).toHaveCount(0)
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('guitartab:practiceDock') ?? '{}').instrument,
      ),
    ).toBe('off')
  })

  test('the Guitar dialog docks under the tab', async ({ page }) => {
    await page.evaluate(async () => {
      const { DIALOGS, openDialog } = await import('/src/services/dialogs/dialogs.ts')
      await openDialog(DIALOGS.GUITAR)
    })
    await page.locator('#guitarModal').getByRole('button', { name: 'Dock under the tab' }).click()
    await expect(page.locator('#guitarModal')).not.toHaveClass(/active/)
    await expect(page.locator('#practiceDock .fretboard')).toBeVisible()
  })

  test('the A/B handles move the loop’s ends beat by beat; bars can be typed in', async ({ page }) => {
    await page.evaluate(async () => {
      const { loopBars } = await import('/src/services/sectionLoops.ts')
      loopBars(0, 0)
    })
    expect(await loopInterval(page)).toEqual({ startBlock: 0, startBeat: 0, endBlock: 0 })
    const start = page.locator('.loop-handle--start')
    const end = page.locator('.loop-handle--end')
    await expect(start).toHaveCount(1)
    await expect(end).toHaveCount(1)

    // drag B into the second bar
    const secondBar = page.locator('.tab-row').first().locator('.tab-measure').nth(1)
    const bar = (await secondBar.boundingBox())!
    const handle = (await end.boundingBox())!
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 8)
    await page.mouse.down()
    await page.mouse.move(bar.x + bar.width / 2, handle.y + 20, { steps: 10 })
    await page.mouse.up()
    expect((await loopInterval(page))?.endBlock).toBe(1)

    // drag A right by about one beat: the start moves within bar 1
    const startBox = (await start.boundingBox())!
    await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + 8)
    await page.mouse.down()
    await page.mouse.move(startBox.x + 60, startBox.y + 20, { steps: 6 })
    await page.mouse.up()
    const moved = await loopInterval(page)
    expect(moved?.startBlock).toBe(0)
    expect(moved?.startBeat).toBeGreaterThan(0)

    await openPracticeOptions(page)
    await page.locator('#loopFromBar').fill('2')
    await page.locator('#loopToBar').fill('2')
    await page.locator('#loopBarsApply').click()
    expect(await loopInterval(page)).toEqual({ startBlock: 1, startBeat: 0, endBlock: 1 })
    await page.locator('#loopBarsClear').click()
    expect(await loopInterval(page)).toBeNull()
  })
})
