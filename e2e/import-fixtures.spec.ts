import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { waitForEditorShell } from './helpers'
import { songFingerprintSource } from './fixtures/songFingerprint'

// Self-authored files (see e2e/fixtures/files/README.md). Reading them must keep
// producing the same song, whatever happens to the writers.
const FILES = 'e2e/fixtures/files'

async function importFile(page: Page, name: string): Promise<void> {
  const bytes = Array.from(readFileSync(`${FILES}/${name}`))
  await page.evaluate(
    async ({ fileName, data }) => {
      const { importSongBytes } = await import('/src/services/songImport.ts')
      importSongBytes(fileName, new Uint8Array(data))
    },
    { fileName: name, data: bytes },
  )
}

test.describe('import fixtures', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditorShell(page)
  })

  for (const name of ['showcase.gp5', 'showcase.gt']) {
    test(`${name} reads back the expected song`, async ({ page }) => {
      await importFile(page, name)
      const expected = JSON.parse(readFileSync(`${FILES}/showcase.expected.json`, 'utf8'))
      expect(await page.evaluate(songFingerprintSource())).toEqual(expected)
      await expect(page.locator('.tab-row').first()).toBeVisible()
    })
  }

  test('two-bars.mid becomes a playable tab', async ({ page }) => {
    await importFile(page, 'two-bars.mid')
    const song = await page.evaluate(async () => {
      const { default: Song } = await import('/src/stores/song.ts')
      return {
        title: Song.songDescription.title,
        tracks: Song.tracks.length,
        bpm: Song.measureMeta[0].bpm,
        bars: Song.measures[0].map((block) =>
          block[0].map((beat) => [
            beat.duration,
            beat.notes.flatMap((note, string) => (note == null ? [] : [`${string}:${note.fret}`])),
          ]),
        ),
        instrument: Song.playBackInstrument[0]?.instrument,
      }
    })
    expect(song).toEqual({
      title: 'two-bars',
      tracks: 1,
      bpm: 120,
      bars: [
        [
          ['q', ['0:0']],
          ['q', ['0:3']],
          ['q', ['1:0']],
          ['q', ['1:2']],
        ],
        [
          ['q', ['1:3']],
          ['q', ['1:2']],
          ['q', ['1:0']],
          ['q', ['0:3']],
        ],
      ],
      instrument: expect.any(String),
    })
    await expect(page.locator('.tab-row').first()).toBeVisible()
  })
})

test('opening a damaged file through the menu explains the problem and keeps the song', async ({ page }) => {
  await waitForEditorShell(page)
  const titleBefore = await page.evaluate(
    async () => (await import('/src/stores/song.ts')).default.songDescription.title,
  )
  const truncated = readFileSync(`${FILES}/showcase.gp5`).subarray(0, 900)
  await page.locator('input[type=file][accept*=".gp5"]').setInputFiles({
    name: 'broken.gp5',
    mimeType: 'application/octet-stream',
    buffer: truncated,
  })
  await expect(page.locator('#notificationLabel')).toContainText(
    'Could not open broken.gp5: The file ends unexpectedly',
  )
  const titleAfter = await page.evaluate(
    async () => (await import('/src/stores/song.ts')).default.songDescription.title,
  )
  expect(titleAfter).toBe(titleBefore)
  await expect(page.locator('.tab-row').first()).toBeVisible()
})
