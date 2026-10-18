import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

/**
 * The toolbar (#completeBar) clips its overflow. Popovers opened from it must render outside it,
 * or they are invisible to users. (Playwright's own clicks scroll clipped elements into view,
 * so clicking inside a popover alone doesn't catch this.)
 */
async function isOnTop(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const popover = document.querySelector(sel)
    if (!popover) return 'missing'
    const rect = popover.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    const scrolled = document.querySelector('#completeBar')!.scrollTop
    return popover.contains(hit) && scrolled < 2 ? 'visible' : `hidden (hit ${hit?.id || hit?.className}, toolbar scrolled ${scrolled})`
  }, selector)
}

test('toolbar popovers are visible above the page', async ({ page }) => {
  await waitForEditorShell(page)

  await page.locator('#downloadGP').click()
  expect(await isOnTop(page, '.save-menu__popover')).toBe('visible')
  await page.keyboard.press('Escape')
  await expect(page.locator('.save-menu__popover')).toHaveCount(0)

  await page.locator('#speedTrainerToggle').click()
  expect(await isOnTop(page, '.practice-controls__popover')).toBe('visible')
  await page.locator('#speedTrainerEnabled').check()
  expect(await isOnTop(page, '.practice-controls__popover')).toBe('visible')
})
