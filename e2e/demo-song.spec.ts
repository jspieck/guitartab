import { expect, test } from '@playwright/test'
import { waitForEditorShell, waitForSoundFont } from './helpers'
import { songFingerprintSource } from './fixtures/songFingerprint'

test.describe('demo song on the first visit', () => {
  test('loads the four-track demo, clean, and plays it without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await waitForEditorShell(page, { demo: 'arrangement' })

    // The arrangement loads from its own chunk right after startup.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const { default: Song } = await import('/src/assets/js/songData.ts')
            return Song.songDescription.title
          }),
        { timeout: 10_000 },
      )
      .toBe('Open Road')

    const state = await page.evaluate(async () => {
      const { default: Song } = await import('/src/assets/js/songData.ts')
      const { isSongDirty } = await import('/src/services/songAutosave.ts')
      return {
        tracks: Song.tracks.map((track) => track.name),
        instruments: Song.playBackInstrument.map((instrument) => instrument.instrument),
        bars: Song.measureMeta.length,
        dirty: isSongDirty(),
      }
    })
    expect(state).toEqual({
      tracks: ['Acoustic Guitar', 'Lead Guitar', 'Bass', 'Drums'],
      instruments: ['guitar', 'overdriveguitar', 'bass', 'drums'],
      bars: 14,
      dirty: false,
    })
    await expect(page.locator('.tab-row').first().locator('.note-text').first()).toBeVisible()
    await expect(page.getByText('Open Road').first()).toBeVisible()

    // Every track renders.
    for (const trackId of [1, 2, 3]) {
      await page.evaluate(async (id) => {
        const { switchTrack } = await import('/src/services/editor/trackLoading.ts')
        switchTrack(id, 0)
      }, trackId)
      await expect(page.locator('.tab-row').first().locator('.note-text').first()).toBeVisible()
    }

    await waitForSoundFont(page)
    await page.locator('#play').click()
    await page.waitForTimeout(2500)
    const block = await page.evaluate(async () => {
      const { default: playBackLogic } = await import('/src/assets/js/playbackEngine.ts')
      return playBackLogic.getCurrentBlock()
    })
    await page.locator('#play').click()
    expect(block).toBeGreaterThanOrEqual(1) // 112 BPM: a bar takes ~2.1 s
    expect(errors).toEqual([])
  })

  test('is shown only once: a returning visitor keeps an empty song', async ({ page }) => {
    await waitForEditorShell(page, { demo: 'arrangement' })
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const { default: Song } = await import('/src/assets/js/songData.ts')
            return Song.tracks.length
          }),
        { timeout: 10_000 },
      )
      .toBe(4)
    await page.reload()
    await page.waitForSelector('.tab-row')
    await page.waitForTimeout(1000)
    const tracks = await page.evaluate(async () => {
      const { default: Song } = await import('/src/assets/js/songData.ts')
      return Song.tracks.length
    })
    expect(tracks).toBe(1)
  })

  test('the exported demo file (open-road.gpx) opens through the file picker as the same song', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await waitForEditorShell(page, { demo: 'arrangement' })
    await expect
      .poll(
        () => page.evaluate(async () => (await import('/src/assets/js/songData.ts')).default.tracks.length),
        { timeout: 10_000 },
      )
      .toBe(4)
    const fingerprint = () => page.evaluate(songFingerprintSource())
    const builtIn = await fingerprint()

    // Start from an empty song, then open the file (over the now "unsaved" empty song).
    page.on('dialog', (dialog) => void dialog.accept())
    await page.evaluate(async () => {
      const { default: Song } = await import('/src/assets/js/songData.ts')
      Song.initEmptySong()
    })
    await page
      .locator('input[type="file"][accept*=".gpx"]')
      .first()
      .setInputFiles('e2e/fixtures/files/open-road.gpx')
    await expect
      .poll(() =>
        page.evaluate(async () => (await import('/src/assets/js/songData.ts')).default.songDescription.title),
      )
      .toBe('Open Road')
    const opened = await fingerprint()
    // GPIF stores no strum length; the importer uses a 16th for every brush.
    const strokeType = (value: unknown) =>
      JSON.parse(JSON.stringify(value), (key, entry) => (key === 'strokeLength' ? undefined : entry))
    expect(strokeType(opened)).toEqual(strokeType(builtIn))
    expect(errors).toEqual([])
  })
})
