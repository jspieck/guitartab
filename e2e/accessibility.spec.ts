import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations } from './axe'
import { waitForEditorShell } from './helpers'

/**
 * Accessibility (audit Big win 10): axe-core on the main views, and the keyboard and
 * screen-reader behaviour axe can't see (dialog focus, toolbar arrows, announcements).
 */

async function announcement(page: Page): Promise<string> {
  return ((await page.locator('#screenReaderAnnouncer').textContent()) ?? '').replace(/\u00a0/g, '').trim()
}

async function openSongInfoWithKeyboard(page: Page): Promise<void> {
  await page.locator('#info').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#infoModal')).toHaveClass(/active/)
}

test.describe('accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 })
  })

  test('axe finds nothing on the editor, light and dark', async ({ page }) => {
    await waitForEditorShell(page)
    await expectNoAxeViolations(page)
    await page.locator('#themeToggle').click()
    await expect(page.locator('body')).toHaveAttribute('id', 'darkMode')
    // Colours fade between themes (e.g. the sequencer's EQ/Comp buttons, 0.12 s); axe must
    // not measure contrast halfway.
    // Only transitions: an endless animation (a spinner) would never finish.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation instanceof CSSTransition)
          .map((animation) => animation.finished),
      ),
    )
    await expectNoAxeViolations(page)
  })

  test('axe finds nothing in a dialog, the note menu and the shortcut sheet', async ({ page }) => {
    await waitForEditorShell(page)
    await openSongInfoWithKeyboard(page)
    await expectNoAxeViolations(page, '#infoModal')
    await page.keyboard.press('Escape')

    await page.locator('.tab-svg').focus()
    await page.keyboard.press('Shift+F10')
    await expect(page.locator('[role="menu"]').first()).toBeVisible()
    await expectNoAxeViolations(page, '[role="menu"]')
    await page.keyboard.press('Escape')

    await page.locator('.tab-svg').focus()
    await page.keyboard.press('?')
    const sheet = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await expect(sheet).toBeVisible()
    await expectNoAxeViolations(page, '.shortcuts-help')
  })

  test('axe finds nothing in the dialogs', async ({ page }) => {
    test.setTimeout(120_000)
    await waitForEditorShell(page)
    // A note under the cursor, for the dialogs that edit one.
    await page
      .locator('.string-click-area')
      .first()
      .click({ position: { x: 80, y: 4 } })
    await page.keyboard.press('5')
    // Left out: the effect dialogs that need a whole note selection to open (grace, stroke,
    // artificial harmonic, tremolo picking; same generic layout as the text dialog) and the
    // tuning area, which lives inside the track settings dialog.
    const skipped = ['graceModal', 'strokeModal', 'artificialModal', 'tremoloPickingModal']
    const ids = await page.evaluate(async () => {
      const { DIALOGS } = await import('/src/services/dialogs/dialogs.ts')
      return Object.values(DIALOGS).map((dialog) => dialog.id)
    })
    for (const id of ids.filter((entry) => !skipped.includes(entry))) {
      await page.evaluate(async (id) => {
        const { DIALOGS, toggleDialog } = await import('/src/services/dialogs/dialogs.ts')
        const dialog = Object.values(DIALOGS).find((entry) => entry.id === id)!
        await toggleDialog(dialog, { trackId: 0, blockId: 0, voiceId: 0, beatId: 0, string: 5 })
      }, id)
      await expect(page.locator(`#${id}`), id).toHaveClass(/active/)
      await expectNoAxeViolations(page, `#${id}`)
      await page.keyboard.press('Escape')
      await expect(page.locator(`#${id}`), id).not.toHaveClass(/active/)
    }
  })

  test('a dialog takes the focus, keeps Tab inside, closes on Escape and gives the focus back', async ({
    page,
  }) => {
    await waitForEditorShell(page)
    await openSongInfoWithKeyboard(page)
    const dialog = page.getByRole('dialog', { name: 'Track Info' })
    await expect(dialog).toBeVisible()
    // The first text field has the focus.
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('INPUT')
    await expect(page.locator('#infoModal input').first()).toBeFocused()

    // Tab from the last control goes round to the first; Shift+Tab back.
    const count = await page.evaluate(() => {
      const modal = document.getElementById('infoModal')!
      return Array.from(modal.querySelectorAll<HTMLElement>('button, input, select, textarea')).filter(
        (element) => element.getClientRects().length > 0,
      ).length
    })
    for (let i = 0; i < count + 2; i += 1) await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => document.getElementById('infoModal')!.contains(document.activeElement)),
    ).toBe(true)
    await page.locator('#infoModal .modal_close').focus()
    await page.keyboard.press('Shift+Tab')
    expect(
      await page.evaluate(() => document.getElementById('infoModal')!.contains(document.activeElement)),
    ).toBe(true)

    await page.keyboard.press('Escape')
    await expect(page.locator('#infoModal')).not.toHaveClass(/active/)
    await expect(page.locator('#info')).toBeFocused()
  })

  test('arrow keys move along the toolbar from a button reached with the keyboard', async ({ page }) => {
    await waitForEditorShell(page)
    await page.locator('#openFile').focus()
    // Focus from the keyboard (focus() after a key counts as :focus-visible).
    await page.keyboard.press('Shift')
    await page.keyboard.press('ArrowRight')
    const next = await page.evaluate(() => document.activeElement?.id)
    expect(next).not.toBe('openFile')
    expect(await page.evaluate(() => document.activeElement?.closest('#tabBar') != null)).toBe(true)
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('#openFile')).toBeFocused()
    await page.keyboard.press('End')
    expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('openFile')
    await page.keyboard.press('Home')
    await expect(page.locator('#openFile')).toBeFocused()

    // One Tab stop per group: Tab from the file group's first button leaves the group.
    const fileGroup = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-fold="file"] button')).map((button) =>
        button.getAttribute('tabindex'),
      ),
    )
    expect(fileGroup.filter((value) => value === '0')).toHaveLength(1)

    // The cursor did not move while the arrows went along the toolbar.
    const cursor = await page.evaluate(async () => {
      const { selectionState } = await import('/src/stores/selectionState.ts')
      return selectionState.cursor.beatId
    })
    expect(cursor).toBe(0)
  })

  test('cursor moves, frets and undo are announced', async ({ page }) => {
    await waitForEditorShell(page)
    await page
      .locator('.string-click-area')
      .first()
      .click({ position: { x: 80, y: 4 } })
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => announcement(page)).toMatch(/^Bar 1, beat 2, string 1/)

    await page.keyboard.press('7')
    await expect.poll(() => announcement(page)).toMatch(/^Bar 1, beat 2, string 1, fret 7$/)

    await page.keyboard.press('Control+z')
    await expect.poll(() => announcement(page)).toMatch(/^Undo: /)
  })
})

test.describe('reduced motion', () => {
  test('transitions end at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await waitForEditorShell(page)
    const duration = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.transition = 'opacity 2s'
      document.body.appendChild(probe)
      const value = getComputedStyle(probe).transitionDuration
      probe.remove()
      return parseFloat(value)
    })
    expect(duration).toBeLessThan(0.01)
  })
})
