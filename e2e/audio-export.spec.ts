import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { expectNoAxeViolations } from './axe'
import { waitForEditorShell, waitForSoundFont } from './helpers'

// Audio export (audit Big win 29): File → Export audio renders the song offline and downloads it.

test.describe('audio export', () => {
  test('exports the loop as a WAV file the browser can decode', async ({ page }) => {
    await waitForEditorShell(page)
    await waitForSoundFont(page)
    // a loop over the riff's second and third beat (0.5 s at 120)
    await page.evaluate(async () => {
      const range = await import('/src/services/editor/rangeSelection.ts')
      range.startRange(0, 0, 0, 1)
      range.extendRange(0, 0, 0, 2)
      range.applyRangeAsLoop()
    })
    await page.locator('#exportAudio').click()
    const dialog = page.locator('#audioExportModal')
    await expect(dialog).toBeVisible()
    await expectNoAxeViolations(page, '#audioExportModal')
    await dialog.getByLabel(/The loop \(bar 1\)/).check()
    await dialog.getByLabel('Metronome clicks').check()

    const downloading = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Export' }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toMatch(/ \(loop\)\.wav$/)
    await expect(dialog.locator('#audioExportMessage')).toContainText('Saved 0:0')

    const bytes = await readFile((await download.path())!)
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF')
    const decoded = await page.evaluate(
      async (data) => {
        const context = new OfflineAudioContext(2, 44100, 44100)
        const buffer = await context.decodeAudioData(new Uint8Array(data).buffer)
        let peak = 0
        for (const value of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(value))
        return { seconds: buffer.duration, channels: buffer.numberOfChannels, peak }
      },
      [...bytes],
    )
    // the loop (0.5 s) plus the ring-out until it falls silent
    expect(decoded.channels).toBe(2)
    expect(decoded.seconds).toBeGreaterThanOrEqual(0.5)
    expect(decoded.seconds).toBeLessThan(4.6)
    expect(decoded.peak).toBeGreaterThan(0.001)
    expect(decoded.peak).toBeLessThanOrEqual(1)
  })

  test('cancel stops a running export without a download', async ({ page }) => {
    await waitForEditorShell(page, { demo: 'arrangement' })
    await waitForSoundFont(page)
    let downloads = 0
    page.on('download', () => {
      downloads += 1
    })
    await page.locator('#exportAudio').click()
    const dialog = page.locator('#audioExportModal')
    await dialog.getByRole('button', { name: 'Export' }).click()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog.getByRole('status')).toHaveText('Export cancelled.')
    await expect(dialog.getByRole('button', { name: 'Export' })).toBeEnabled()
    expect(downloads).toBe(0)
  })
})
