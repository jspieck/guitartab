import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

test('undoing a shorter time signature brings the cut-off beats back', async ({ page }) => {
  await waitForEditorShell(page)
  const result = await page.evaluate(async () => {
    const { default: Song } = await import('/src/assets/js/songData.ts')
    const { modalManager } = await import('/src/assets/js/modals/modalManager.ts')
    const { revertHandler } = await import('/src/assets/js/revertHandler.ts')

    const snapshot = () => JSON.stringify(Song.measures[0][0])
    const before = snapshot()
    const beatsBefore = Song.measures[0][0][0].length

    const handler = modalManager.getHandler('timeMeterModal') as unknown as {
      modalState: Record<string, number>
      handleSubmit(): boolean
    }
    Object.assign(handler.modalState, { trackId: 0, voiceId: 0, blockId: 0, numerator: 2, denominator: 4 })
    const applied = handler.handleSubmit()
    const beatsAfterChange = Song.measures[0][0][0].length

    revertHandler.revertState()
    return {
      applied,
      beatsBefore,
      beatsAfterChange,
      restored: snapshot() === before,
      numerator: Song.measureMeta[0].numerator,
      strayKeys: Object.keys(Song.measures[0][0][0]).filter((key) => !/^\d+$/.test(key)),
    }
  })
  expect(result.applied).toBe(true)
  expect(result.beatsAfterChange).toBeLessThan(result.beatsBefore)
  expect(result).toMatchObject({ restored: true, numerator: 4, strayKeys: [] })
})
