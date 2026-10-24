import { chromium, type FullConfig } from '@playwright/test'

/**
 * Loads the app once before the tests, including the lazily loaded chunks, so the Vite dev
 * server has transformed every module before many workers ask for them at once. On a cold
 * server the first parallel tests could otherwise time out while Vite compiled on demand.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL
  if (!baseURL) return
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.addInitScript(() => localStorage.setItem('guitartab:demoSong', 'riff'))
    await page.goto(baseURL)
    await page.waitForSelector('html[data-editor-ready]', { state: 'attached', timeout: 120_000 })
    await page.waitForSelector('#compressorModal', { state: 'attached', timeout: 60_000 })
    await page.evaluate(async () => {
      await Promise.all([
        import('/src/services/notation/classicalNotation.ts'),
        import('/src/services/songExport.ts'),
        import('/src/services/compactLayout.ts'),
        import('/src/components/compact/CompactBar.vue'),
        import('/src/components/compact/TouchNotePad.vue'),
        import('/src/components/HelpOverlays.vue'),
        import('/src/components/AutosaveDraftsPanel.vue'),
        import('/src/data/demoArrangement.ts'),
      ])
    })
  } finally {
    await browser.close()
  }
}
