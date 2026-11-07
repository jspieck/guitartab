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
    await page.evaluate(async () => {
      // Dialogs mount when first opened (stores/dialogState.ts): open each once, so its
      // component chunk is compiled too, then close them again.
      const { DIALOGS, openDialog, closeAllDialogs } = await import('/src/services/dialogs/dialogs.ts')
      const params = { trackId: 0, blockId: 0, voiceId: 0, beatId: 0, string: 0 }
      for (const dialog of [
        DIALOGS.INFO,
        DIALOGS.COMPRESSOR,
        DIALOGS.EQUALIZER,
        DIALOGS.MIXER,
        DIALOGS.TEMPO,
      ])
        await openDialog(dialog, params)
      closeAllDialogs()
      await Promise.all([
        import('/src/components/ModalsContainer.vue'),
        import('/src/services/import/guitarProReaders.ts'),
        import('/src/services/musicXmlImport.ts'),
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
