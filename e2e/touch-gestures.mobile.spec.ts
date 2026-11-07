import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

/**
 * Swipe, long-press, the ⋯ menu and dialogs on a phone (`mobile` project, Pixel 7, 412 px).
 * Single-finger gestures go through Chrome's touch input (CDP), so the browser's own touch
 * handling (touch-action, emulated mouse events) takes part as on a device.
 */

async function openPhone(page: Page): Promise<CDPSession> {
  await waitForEditorShell(page)
  await expect(page.locator('#compactBar')).toBeVisible()
  await expect
    .poll(async () => Number(await page.locator('.tab-svg').getAttribute('width')))
    .toBeLessThanOrEqual(page.viewportSize()!.width)
  return page.context().newCDPSession(page)
}

const touch = (cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })

async function swipe(cdp: CDPSession, from: { x: number; y: number }, dx: number): Promise<void> {
  await touch(cdp, 'touchStart', from.x, from.y)
  for (let step = 1; step <= 4; step += 1) await touch(cdp, 'touchMove', from.x + (dx * step) / 4, from.y)
  await touch(cdp, 'touchEnd')
}

async function longPress(page: Page, cdp: CDPSession, at: { x: number; y: number }): Promise<void> {
  await touch(cdp, 'touchStart', at.x, at.y)
  await page.waitForTimeout(700)
  await touch(cdp, 'touchEnd')
}

/** Centre of the n-th fret digit in the tab. */
async function noteCentre(page: Page, index: number) {
  const box = (await page.locator('.note-text').nth(index).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function cursor(page: Page) {
  return page.evaluate(async () => {
    const { selectionState } = await import('/src/stores/selectionState.ts')
    const { blockId, beatId, string } = selectionState.cursor
    return { blockId, beatId, string }
  })
}

test('a sideways swipe moves the cursor a beat while editing, and does nothing otherwise', async ({
  page,
}) => {
  const cdp = await openPhone(page)
  await page.locator('#compactEditToggle').tap()
  // The note pad opens and the sheet refits to the smaller space (debounced); swipe after that.
  await expect(page.locator('#touchNotePad')).toBeVisible()
  await page.waitForTimeout(500)
  const start = await noteCentre(page, 1)
  await page.touchscreen.tap(start.x, start.y)
  const before = await cursor(page)

  await swipe(cdp, start, -120)
  await expect.poll(() => cursor(page)).toEqual({ ...before, beatId: before.beatId + 1 })
  await swipe(cdp, start, 120)
  await expect.poll(() => cursor(page)).toEqual(before)

  // Out of edit mode a swipe changes nothing. (Left through the store: Chrome sends no click for
  // a tap right after a swipe, as that tap only stops the fling.)
  await page.evaluate(async () => (await import('/src/stores/layoutModeState.ts')).setCompactEditing(false))
  await expect(page.locator('#touchNotePad')).toBeHidden()
  await page.waitForTimeout(500)
  const resting = await noteCentre(page, 1)
  await swipe(cdp, resting, -120)
  await page.waitForTimeout(300)
  expect(await cursor(page)).toEqual(before)
})

test('a long-press opens the note menu as a bottom sheet on that note', async ({ page }) => {
  const cdp = await openPhone(page)
  const at = await noteCentre(page, 2)
  await longPress(page, cdp, at)

  const sheet = page.locator('#noteMenu')
  await expect(sheet).toBeVisible()
  await expect(sheet).toHaveClass(/note-menu--sheet/)
  const box = (await sheet.boundingBox())!
  const viewport = page.viewportSize()!
  expect(Math.round(box.x)).toBe(0)
  expect(Math.round(box.x + box.width)).toBe(viewport.width)
  expect(Math.round(box.y + box.height)).toBe(viewport.height)
  const selected = await cursor(page)

  // The phone has no edit bar: "All effects" lists every effect in the sheet.
  await sheet.getByRole('menuitem', { name: 'All effects…' }).tap()
  await expect(sheet.getByRole('menuitemcheckbox')).toHaveCount(21 + 8)
  const palmMute = sheet.getByRole('menuitemcheckbox', { name: 'Palm mute' })
  await palmMute.tap()
  await expect(palmMute).toHaveAttribute('aria-checked', 'true')

  // A tap on the dimmed tab closes the sheet without moving the cursor.
  await page.touchscreen.tap(viewport.width / 2, 60 + 100)
  await expect(sheet).toBeHidden()
  expect(await cursor(page)).toEqual(selected)
})

test('the ⋯ menu has the song tempo and the track actions, and closes on a tap outside', async ({ page }) => {
  await openPhone(page)
  const bpm = () => page.evaluate(async () => (await import('/src/stores/song.ts')).default.bpm)
  const before = await bpm()

  await page.locator('#compactMoreButton').tap()
  const menu = page.locator('#compactMoreMenu')
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Faster' }).tap()
  await expect.poll(bpm).toBe(before + 5)
  await expect(page.locator('#compactTempo')).toContainText(String(before + 5))

  // Left of the menu, which hangs from the right edge.
  await page.touchscreen.tap(30, 400)
  await expect(menu).toBeHidden()

  await page.locator('#compactMoreButton').tap()
  await menu.getByRole('menuitem', { name: 'Track settings and tuning…' }).tap()
  const dialog = page.locator('#instrumentSettingsModal')
  await expect(dialog).toBeVisible()
  // A full-width sheet at the bottom of the screen.
  const box = (await dialog.boundingBox())!
  expect(Math.round(box.x)).toBe(0)
  expect(Math.round(box.width)).toBe(page.viewportSize()!.width)
  await expect(page.locator('#tuningAreaModal')).toBeVisible()
})

test('the bend editor fits the phone and takes taps', async ({ page }) => {
  await openPhone(page)
  const start = await noteCentre(page, 1)
  await page.touchscreen.tap(start.x, start.y)
  await page.evaluate(async () => {
    const { noteEffectSelect } = await import('/src/services/editor/noteEffectCommands.ts')
    noteEffectSelect('bend')
  })
  const editor = page.locator('#bendEditor')
  await expect(editor).toBeVisible()
  const box = (await editor.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)

  const points = page.locator('#bendEditor .bend-points circle')
  // The default preset draws its points first.
  await expect(points).not.toHaveCount(0)
  const before = await points.count()
  // The second grid column (25 + 451 / 12 of 501 units), where the preset has no point: a tap
  // adds one there, so taps land where the scaled editor shows them.
  await page.touchscreen.tap(box.x + box.width * (62.6 / 501), box.y + box.height * 0.3)
  await expect(points).toHaveCount(before + 1)

  // Opened again (another note without a bend), it shows that note's points, not the last edit.
  await page.evaluate(async () => {
    const { DIALOGS, closeDialog } = await import('/src/services/dialogs/dialogs.ts')
    closeDialog(DIALOGS.BEND)
  })
  await expect(editor).toBeHidden()
  const other = await noteCentre(page, 2)
  await page.touchscreen.tap(other.x, other.y)
  await page.evaluate(async () => {
    const { noteEffectSelect } = await import('/src/services/editor/noteEffectCommands.ts')
    noteEffectSelect('bend')
  })
  await expect(editor).toBeVisible()
  await expect(points).toHaveCount(before)
})
