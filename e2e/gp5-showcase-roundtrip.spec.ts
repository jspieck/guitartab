import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'
import { loadEffectsShowcase } from './fixtures/effectsShowcase'
import { songFingerprintSource } from './fixtures/songFingerprint'

/** Lists differing paths between two JSON values. */
function diff(a: unknown, b: unknown, path = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return []
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
    return [...keys].flatMap((key) =>
      diff((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}/${key}`),
    )
  }
  return [`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`]
}

test('every effect survives a GP5 export and re-import', async ({ page }) => {
  await waitForEditorShell(page)
  await loadEffectsShowcase(page)
  const before = await page.evaluate(songFingerprintSource())
  await page.evaluate(async () => {
    const { currentSongAsGp5 } = await import('/src/services/gp5Export.ts')
    const { importSongBytes } = await import('/src/services/songImport.ts')
    importSongBytes('showcase.gp5', currentSongAsGp5())
  })
  const after = await page.evaluate(songFingerprintSource())
  expect(diff(before, after)).toEqual([])
})
