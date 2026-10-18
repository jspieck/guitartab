import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

test('undoing the removal of beat text and a repeat sign brings their data back', async ({ page }) => {
  await waitForEditorShell(page)
  const result = await page.evaluate(async () => {
    const { default: Song } = await import('/src/assets/js/songData.ts')
    const { processNotationSelect } = await import('/src/services/editor/notationCommands.ts')
    const { revertHandler } = await import('/src/assets/js/revertHandler.ts')

    const beat = Song.measures[0][1][0][0]
    beat.text = 'Keep me'
    Song.measureMeta[1].repeatClose = 3

    processNotationSelect(0, 1, 0, 0, 'addText', null) // switch text off
    processNotationSelect(0, 1, 0, 0, 'closeBar', null) // switch the repeat sign off
    const removed = { text: beat.text, repeatClose: Song.measureMeta[1].repeatClose }

    revertHandler.revertState()
    revertHandler.revertState()
    const restored = { text: Song.measures[0][1][0][0].text, repeatClose: Song.measureMeta[1].repeatClose }

    revertHandler.restoreState()
    const redone = { text: Song.measures[0][1][0][0].text, repeatClose: Song.measureMeta[1].repeatClose }
    return { removed, restored, redone }
  })
  expect(result.removed).toEqual({ text: undefined, repeatClose: undefined })
  expect(result.restored).toEqual({ text: 'Keep me', repeatClose: 3 })
  expect(result.redone).toEqual({ text: undefined, repeatClose: 3 })
})
