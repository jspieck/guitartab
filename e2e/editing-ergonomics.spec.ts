import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

/** A bar of the riff's voice as `duration[string:fret,…]` per beat. */
async function bar(page: Page, blockId: number, voiceId = 0): Promise<string> {
  return page.evaluate(
    async ([block, voice]) => {
      const { default: Song } = await import('/src/stores/song.ts')
      return Song.measures[0][block][voice]
        .map((beat) => {
          const frets = Array.from(beat.notes, (note, string) => (note ? `${string}:${note.fret}` : ''))
            .filter(Boolean)
            .join(',')
          return `${beat.duration}${beat.dotted ? '.' : ''}${frets ? `[${frets}]` : ''}`
        })
        .join(' ')
    },
    [blockId, voiceId],
  )
}

async function numBars(page: Page): Promise<number> {
  return page.evaluate(async () => (await import('/src/stores/song.ts')).default.numMeasures)
}

/** Clicks beat `beat` of bar 1 on the lowest string (the riff plays on the two lowest). */
async function clickBeat(page: Page, beat: number, modifiers: Array<'Shift'> = []): Promise<void> {
  const row = page.locator('.tab-row[data-row-id="0"]')
  const box = await row.locator('.tab-measure').first().locator('.tab-note').nth(beat).boundingBox()
  const area = await row.locator('.string-click-area').last().boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, area!.y + area!.height / 2)
  for (const key of modifiers) await page.keyboard.down(key)
  await page.mouse.down()
  await page.mouse.up()
  for (const key of modifiers) await page.keyboard.up(key)
}

test.describe('editing ergonomics', () => {
  test('Shift+→ selects, Ctrl+↑ transposes the selection, Ctrl+Z undoes it', async ({ page }) => {
    await waitForEditorShell(page)
    await clickBeat(page, 0)
    const before = await bar(page, 0)
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Control+ArrowUp')
    // The command loads with its chunk on first use.
    await expect.poll(() => bar(page, 0)).not.toBe(before)
    const after = await bar(page, 0)
    // The first two beats went up a semitone (on the same strings), the rest stayed.
    expect(after.split(' ').slice(2)).toEqual(before.split(' ').slice(2))
    expect(after).toMatch(/^\w+\[0:1\] \w+\[0:4\]/)
    await page.keyboard.press('Control+z')
    await expect.poll(() => bar(page, 0)).toBe(before)
  })

  test('Shift+click extends the range to the clicked beat', async ({ page }) => {
    await waitForEditorShell(page)
    await clickBeat(page, 0)
    await clickBeat(page, 2, ['Shift'])
    // Shift+click runs once the lazy editing-tools chunk has loaded.
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { selectionState } = await import('/src/stores/selectionState.ts')
          return [selectionState.rangeStart?.beatId, selectionState.rangeEnd?.beatId]
        }),
      )
      .toEqual([0, 2])
    await expect(page.locator('.range-selection-overlay')).toHaveCount(1)
  })

  test('Ctrl+A and Ctrl+C copy a bar; Ctrl+Shift+V inserts it as a new bar; undo removes it', async ({
    page,
  }) => {
    await waitForEditorShell(page)
    await clickBeat(page, 0)
    const first = await bar(page, 0)
    const second = await bar(page, 1)
    const bars = await numBars(page)
    await page.keyboard.press('Control+a')
    // Ctrl+A's command loads with its chunk on first use; keys wait for it, but the cursor
    // move below does not.
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await import('/src/stores/selectionState.ts')).selectionState.rangeStart?.blockId,
        ),
      )
      .toBe(0)
    await page.keyboard.press('Control+c')
    // To bar 2, then paste the copy in front of it.
    await page.evaluate(async () => {
      const { typedEventBus } = await import('/src/utils/typedEventBus.ts')
      typedEventBus.emit('navigation.setClickedPos', {
        trackId: 0,
        voiceId: 0,
        blockId: 1,
        beatId: 0,
        string: 0,
      })
    })
    await page.keyboard.press('Control+Shift+V')
    await expect.poll(() => numBars(page)).toBe(bars + 1)
    expect(await bar(page, 1)).toBe(first)
    expect(await bar(page, 2)).toBe(second)
    await page.keyboard.press('Control+z')
    await expect.poll(() => numBars(page)).toBe(bars)
    expect(await bar(page, 1)).toBe(second)
  })

  test('rhythm keys: R rests a beat, Insert shifts the bar, Ctrl+Delete pulls it back', async ({ page }) => {
    await waitForEditorShell(page)
    await clickBeat(page, 1)
    const before = await bar(page, 0)
    await page.keyboard.press('r')
    await expect.poll(() => bar(page, 0)).not.toBe(before)
    expect((await bar(page, 0)).split(' ')[1]).toMatch(/r$/)
    await page.keyboard.press('Control+z')
    await expect.poll(() => bar(page, 0)).toBe(before)

    await page.keyboard.press('Insert')
    await expect.poll(() => bar(page, 0)).not.toBe(before)
    const inserted = await bar(page, 0)
    expect(inserted.split(' ')[2]).toBe(before.split(' ')[1])
    await page.keyboard.press('Control+Delete')
    await expect.poll(() => bar(page, 0)).toBe(before)
  })

  test('Alt+2 edits voice 2 in its own colour, with voice 1 faint behind it', async ({ page }) => {
    await waitForEditorShell(page)
    await clickBeat(page, 0)
    await page.keyboard.press('Alt+2')
    await expect
      .poll(() => page.evaluate(async () => (await import('/src/stores/song.ts')).default.currentVoiceId))
      .toBe(1)
    await expect(page.locator('.other-voice-note').first()).toBeVisible()
    await page.evaluate(async () => {
      const { typedEventBus } = await import('/src/utils/typedEventBus.ts')
      const { selectionState } = await import('/src/stores/selectionState.ts')
      typedEventBus.emit('navigation.setClickedPos', {
        trackId: 0,
        voiceId: 1,
        blockId: 0,
        beatId: 0,
        string: 5,
      })
      selectionState.hasExplicitSelection = true
    })
    await page.locator('#mainContent').focus()
    await page.keyboard.press('7')
    await expect(page.locator('.voice2-note')).toHaveText(['7'])
    await page.keyboard.press('Alt+1')
    await expect(page.locator('.voice2-note')).toHaveCount(0)
    await expect(page.locator('.other-voice-note', { hasText: '7' })).toHaveCount(1)
  })
})
