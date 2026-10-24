import { test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

// Throwaway: the whole icon set on light and dark, and every toolbar tab, into ZZ_OUT.
const OUT = process.env.ZZ_OUT ?? 'test-results'
test.use({ deviceScaleFactor: 2 })

test('icon sheet', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await waitForEditorShell(page)
  await page.evaluate(async () => {
    const { ICONS } = await import('/src/assets/icons/icons.ts')
    const sheet = document.createElement('div')
    sheet.id = 'zzSheet'
    sheet.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:grid;grid-template-columns:1fr 1fr;overflow:auto'
    for (const dark of [false, true]) {
      const panel = document.createElement('div')
      panel.style.cssText = `display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:10px;font:10px sans-serif;background:${dark ? 'var(--gray-850)' : 'var(--gray-0)'};color:${dark ? 'var(--gray-100)' : 'var(--gray-900)'}`
      for (const [name, icon] of Object.entries(ICONS)) {
        const cell = document.createElement('div')
        cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px'
        cell.innerHTML = `<svg viewBox="${icon.viewBox}" width="24" height="24">${icon.body}</svg><span>${name}</span>`
        panel.appendChild(cell)
      }
      sheet.appendChild(panel)
    }
    document.body.appendChild(sheet)
  })
  await page.locator('#zzSheet').screenshot({ path: `${OUT}/icons-sheet.png` })
})

test('toolbar tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 300 })
  await waitForEditorShell(page)
  for (const theme of ['lightMode', 'darkMode']) {
    await page.evaluate((t) => (document.body.id = t), theme)
    for (const tab of [1, 2, 3, 4, 5]) {
      await page.locator(`#barButton${tab}`).click()
      await page.waitForTimeout(150)
      await page.locator('#completeBar').screenshot({ path: `${OUT}/toolbar-${theme}-${tab}.png` })
    }
    await page.locator('#sideBarButtons').screenshot({ path: `${OUT}/sidebar-${theme}.png` })
  }
})
