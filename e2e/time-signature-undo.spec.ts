import { expect, test } from '@playwright/test'
import { waitForEditorShell } from './helpers'

test('undoing a shorter time signature brings the cut-off beats back', async ({ page }) => {
  await waitForEditorShell(page)
  const result = await page.evaluate(async () => {
    const { default: Song } = await import('/src/stores/song.ts')
    const { DIALOGS, dialogHandler } = await import('/src/services/dialogs/dialogs.ts')
    const { undoHistory } = await import('/src/services/editor/editCommands.ts')

    const snapshot = () => JSON.stringify(Song.measures[0][0])
    const before = snapshot()
    const beatsBefore = Song.measures[0][0][0].length

    const handler = (await dialogHandler(DIALOGS.TIME_METER)) as unknown as {
      modalState: Record<string, number>
      handleSubmit(): boolean
    }
    Object.assign(handler.modalState, { trackId: 0, voiceId: 0, blockId: 0, numerator: 2, denominator: 4 })
    const applied = handler.handleSubmit()
    const beatsAfterChange = Song.measures[0][0][0].length

    undoHistory.undo()
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

test('removing a time signature with the toolbar re-fits the bars, and undo brings it back', async ({
  page,
}) => {
  await waitForEditorShell(page)
  // The time signature button is on the Bar tab of the edit bar.
  await page.locator('#barButton4').click()
  const result = await page.evaluate(async () => {
    const { default: Song } = await import('/src/stores/song.ts')
    const { DIALOGS, dialogHandler } = await import('/src/services/dialogs/dialogs.ts')
    const { undoHistory } = await import('/src/services/editor/editCommands.ts')
    const { selectionState } = await import('/src/stores/selectionState.ts')

    // 3/4 from bar 2 on.
    const handler = (await dialogHandler(DIALOGS.TIME_METER)) as unknown as {
      modalState: Record<string, number>
      handleSubmit(): boolean
    }
    Object.assign(handler.modalState, { trackId: 0, voiceId: 0, blockId: 1, numerator: 3, denominator: 4 })
    handler.handleSubmit()
    const set = [Song.measureMeta[1].numerator, Song.measureMeta[2].numerator]
    const bars = () => JSON.stringify([Song.measures[0][1], Song.measures[0][2]])
    const barsWith34 = bars()

    // The toolbar button on bar 2 removes it again.
    selectionState.cursor = { trackId: 0, voiceId: 0, blockId: 1, beatId: 0, string: 0 }
    ;(document.getElementById('timeMeter') as HTMLButtonElement).click()
    const removed = {
      refitted: bars() !== barsWith34,
      present: Song.measureMeta[1].timeMeterPresent,
      numerators: [Song.measureMeta[1].numerator, Song.measureMeta[2].numerator],
    }

    undoHistory.undo()
    const undone = [
      Song.measureMeta[1].timeMeterPresent,
      Song.measureMeta[1].numerator,
      Song.measureMeta[2].numerator,
    ]
    return {
      set,
      removed,
      undone,
      barsRestored: bars() === barsWith34,
      firstBar: Song.measureMeta[0].numerator,
    }
  })
  expect(result.set).toEqual([3, 3])
  expect(result.removed).toEqual({ refitted: true, present: false, numerators: [4, 4] })
  expect(result.undone).toEqual([true, 3, 3])
  expect(result).toMatchObject({ barsRestored: true, firstBar: 4 })
})
