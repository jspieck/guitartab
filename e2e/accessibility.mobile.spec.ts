import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'
import { expectNoAxeViolations } from './axe'

/** axe-core on the phone layout (runs in the `mobile` project). */

test('axe finds nothing on the phone layout, the note pad and the menu', async ({ page }) => {
  await waitForEditorShell(page)
  await expect(page.locator('#compactBar')).toBeVisible()
  await expectNoAxeViolations(page)

  await page.locator('#compactEditToggle').tap()
  await expect(page.locator('.note-pad')).toBeVisible()
  await expectNoAxeViolations(page)

  await page.locator('#compactMoreButton').tap()
  await expect(page.locator('.compact-menu')).toBeVisible()
  await expectNoAxeViolations(page, '.compact-menu')
})
