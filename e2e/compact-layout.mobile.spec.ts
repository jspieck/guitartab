import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell, waitForSoundFont } from './helpers'

/** Runs in the `mobile` project (Pixel 7: 412 px wide, touch). */

async function openPhoneLayout(page: Page, options: { demo?: 'riff' | 'arrangement' } = {}): Promise<void> {
  await waitForEditorShell(page, options)
  await expect(page.locator('#compactBar')).toBeVisible()
  // The sheet is refitted by a lazily loaded module; wait until it matches the screen.
  await expect.poll(() => sheetWidth(page)).toBeLessThanOrEqual(page.viewportSize()!.width)
}

async function sheetWidth(page: Page): Promise<number> {
  return Number(await page.locator('.tab-svg').getAttribute('width'))
}

async function rowRightEdges(page: Page): Promise<number[]> {
  return page.locator('.tab-row').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().right))
}

async function firstBeatFrets(page: Page): Promise<(number | '-')[]> {
  return page.evaluate(async () => {
    const { default: Song } = await import('/src/assets/js/songData.ts')
    return Array.from(Song.measures[0][0][0][0].notes, (note) => note?.fret ?? '-')
  })
}

/** Rows of the whole track (only the visible ones are mounted). */
async function layoutRows(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const { default: renderBridge } = await import('/src/services/editor/renderBridge.ts')
    return renderBridge.getTrackLayout(0, 0)?.numRows ?? 0
  })
}

async function compactZoom(page: Page): Promise<number> {
  return page.evaluate(async () => (await import('/src/stores/tabViewportState.ts')).tabViewportState.zoom)
}

test.describe('phone layout', () => {
  test('shows the tab full width with one transport bar instead of the desktop chrome', async ({ page }) => {
    await openPhoneLayout(page)
    for (const desktopOnly of ['#completeBar', '#sideBarButtons', '#sequencerBar', '#footerBar']) {
      await expect(page.locator(desktopOnly)).toBeHidden()
    }
    const width = page.viewportSize()!.width
    for (const right of await rowRightEdges(page)) expect(right).toBeLessThanOrEqual(width)
    // Nothing scrolls sideways.
    const overflow = await page.locator('#mainContent').evaluate((element) => element.scrollWidth - element.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await expect(page.locator('#compactTrackSelect')).toHaveValue('0')
  })

  test('play and pause from the compact bar', async ({ page }) => {
    await openPhoneLayout(page)
    await waitForSoundFont(page)
    const play = page.locator('#compactPlay')
    await play.tap()
    await expect(play).toHaveAttribute('aria-label', 'Pause')
    await play.tap()
    await expect(play).toHaveAttribute('aria-label', 'Play')
  })

  test('the speed menu sets the practice speed', async ({ page }) => {
    await openPhoneLayout(page)
    await page.locator('#compactSpeed').selectOption('0.75')
    const rate = await page.evaluate(async () => (await import('/src/stores/practiceState.ts')).practiceState.playbackRate)
    expect(rate).toBe(0.75)
  })

  test('enters, shortens, undoes and deletes a note with the touch pad', async ({ page }) => {
    await openPhoneLayout(page)
    await page.locator('#compactEditToggle').tap()
    const pad = page.locator('#touchNotePad')
    await expect(pad).toBeVisible()
    // Without a tap in the tab the pad starts at the cursor: bar 1, beat 1, lowest string.
    await expect(pad.locator('.note-pad__position')).toHaveText('Bar 1 · Beat 1 · String 6')

    // Up five strings to the top line, then fret 7.
    for (let index = 0; index < 5; index += 1) await pad.getByRole('button', { name: 'Higher string' }).tap()
    await expect(pad.locator('.note-pad__position')).toHaveText('Bar 1 · Beat 1 · String 1')
    await pad.locator('[data-fret="7"]').tap()
    await expect.poll(() => firstBeatFrets(page)).toEqual([0, '-', '-', '-', '-', 7])
    await expect(pad.locator('[data-fret="7"]')).toHaveClass(/is-current/)

    // High frets are on the second page.
    await pad.getByRole('button', { name: 'Frets 12 to 24' }).tap()
    await pad.locator('[data-fret="15"]').tap()
    await expect.poll(() => firstBeatFrets(page)).toEqual([0, '-', '-', '-', '-', 15])

    await pad.locator('[data-length="s"]').tap()
    await expect(pad.locator('[data-length="s"]')).toHaveClass(/is-current/)

    await pad.getByRole('button', { name: 'Undo' }).tap()
    await pad.getByRole('button', { name: 'Undo' }).tap()
    await expect.poll(() => firstBeatFrets(page)).toEqual([0, '-', '-', '-', '-', 7])

    await pad.getByRole('button', { name: 'Delete note' }).tap()
    await expect.poll(() => firstBeatFrets(page)).toEqual([0, '-', '-', '-', '-', '-'])

    await pad.getByRole('button', { name: 'Done' }).tap()
    await expect(pad).toHaveCount(0)
  })

  test('tapping a string in the tab moves the pad to it', async ({ page }) => {
    await openPhoneLayout(page)
    await page.locator('#compactEditToggle').tap()
    // The first click area is the top line of the first bar.
    await page.locator('.string-click-area').first().tap({ position: { x: 60, y: 4 } })
    await expect(page.locator('.note-pad__position')).toHaveText(/String 1$/)
    await page.locator('[data-fret="3"]').tap()
    await expect.poll(async () => (await firstBeatFrets(page)).at(-1)).toBe(3)
  })

  test('pinch zoom reflows the rows and still fits the screen', async ({ page }) => {
    await openPhoneLayout(page)
    const rowsBefore = await layoutRows(page)
    const widthBefore = await sheetWidth(page)

    await pinch(page, 1.6)
    await expect.poll(() => compactZoom(page)).toBeCloseTo(1.6, 1)
    // A narrower sheet scaled up: fewer bars per row, still nothing off screen.
    await expect.poll(() => sheetWidth(page)).toBeLessThan(widthBefore)
    const width = page.viewportSize()!.width
    for (const right of await rowRightEdges(page)) expect(right).toBeLessThanOrEqual(width + 1)
    expect(await layoutRows(page)).toBeGreaterThanOrEqual(rowsBefore)

    // Remembered for the next visit.
    await page.reload()
    await expect.poll(() => compactZoom(page)).toBeCloseTo(1.6, 1)
  })

  test('switches to the desktop layout when the screen gets wide, and back', async ({ page }) => {
    await openPhoneLayout(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.locator('#compactBar')).toHaveCount(0)
    await expect(page.locator('#completeBar')).toBeVisible()
    await expect.poll(() => sheetWidth(page)).toBeGreaterThan(1000)

    await page.setViewportSize({ width: 412, height: 915 })
    await expect(page.locator('#compactBar')).toBeVisible()
    await expect.poll(() => sheetWidth(page)).toBeLessThanOrEqual(412)
  })

  test('a tablet in landscape keeps the desktop toolbar but fits the sheet to the window', async ({ page }) => {
    await openPhoneLayout(page)
    await page.setViewportSize({ width: 1024, height: 768 })
    await expect(page.locator('#completeBar')).toBeVisible()
    await expect(page.locator('#compactBar')).toHaveCount(0)
    await expect.poll(() => sheetWidth(page)).toBeLessThanOrEqual(1024)
    const containerRight = await page.locator('#mainContent').evaluate((element) => element.getBoundingClientRect().right)
    for (const right of await rowRightEdges(page)) expect(right).toBeLessThanOrEqual(containerRight + 1)
  })

  test('?layout=desktop forces the desktop layout on a phone', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('guitartab:demoSong', 'riff'))
    await page.goto('/?layout=desktop')
    await page.waitForSelector('html[data-editor-ready]', { state: 'attached' })
    await expect(page.locator('#completeBar')).toBeVisible()
    await expect(page.locator('#compactBar')).toHaveCount(0)
  })

  test('the track menu switches tracks and the first-run card speaks touch', async ({ page }) => {
    await openPhoneLayout(page, { demo: 'arrangement' })
    await expect(page.locator('#firstRunHint')).toContainText('Tap the pencil')
    await expect(page.locator('#firstRunHint')).not.toContainText('Space')
    await page.locator('#firstRunHint').getByRole('button', { name: 'Got it' }).tap()

    await expect(page.locator('#compactTrackSelect option')).toHaveCount(4)
    await page.locator('#compactTrackSelect').selectOption({ label: 'Bass' })
    await expect.poll(() => page.evaluate(async () => (await import('/src/assets/js/songData.ts')).default.currentTrackId)).toBe(2)
  })
})

/** Two-finger pinch on the tab with synthetic touch pointer events (Playwright has no multi-touch API). */
async function pinch(page: Page, factor: number): Promise<void> {
  await page.locator('#mainContent').evaluate(async (container, scale) => {
    const rect = container.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const send = (type: string, pointerId: number, x: number, y: number) => container.dispatchEvent(new PointerEvent(type, {
      pointerId, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: pointerId === 1,
    }))
    const start = 60
    send('pointerdown', 1, cx - start, cy)
    send('pointerdown', 2, cx + start, cy)
    for (let step = 1; step <= 6; step += 1) {
      const distance = start * (1 + ((scale - 1) * step) / 6)
      send('pointermove', 1, cx - distance, cy)
      send('pointermove', 2, cx + distance, cy)
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
    send('pointerup', 1, cx - start * scale, cy)
    send('pointerup', 2, cx + start * scale, cy)
  }, factor)
}
