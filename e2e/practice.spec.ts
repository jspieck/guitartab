import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell, waitForSoundFont } from './helpers'

interface AudioEvent {
  kind: 'click' | 'note'
  time: number
  accent?: boolean
}

/** Record every scheduled metronome click and note (audio-clock times) without muting them. */
async function recordAudio(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { audioEngine } = await import('/src/assets/js/audioEngine.ts')
    const log: AudioEvent[] = []
    ;(window as unknown as { __audioLog: AudioEvent[] }).__audioLog = log
    const playClick = audioEngine.playMetronomeNote.bind(audioEngine)
    audioEngine.playMetronomeNote = (time: number, accent: boolean) => {
      log.push({ kind: 'click', time, accent })
      playClick(time, accent)
    }
    const playNote = audioEngine.playSF2.bind(audioEngine) as (...args: unknown[]) => unknown
    ;(audioEngine as unknown as { playSF2: (...args: unknown[]) => unknown }).playSF2 = (...args: unknown[]) => {
      log.push({ kind: 'note', time: args[5] as number })
      return playNote(...args)
    }
  })
}

async function playFor(page: Page, ms: number): Promise<{ clicks: AudioEvent[], notes: AudioEvent[] }> {
  await page.locator('#play').click()
  await page.waitForTimeout(ms)
  await page.locator('#play').click()
  const log = await page.evaluate(() => (window as unknown as { __audioLog: AudioEvent[] }).__audioLog)
  const sorted = [...log].sort((a, b) => a.time - b.time)
  return {
    clicks: sorted.filter((event) => event.kind === 'click'),
    notes: sorted.filter((event) => event.kind === 'note'),
  }
}

/** Drag across the first measure in the tab: the selected range becomes the playback loop. */
async function loopFirstMeasure(page: Page): Promise<void> {
  const measure = page.locator('.tab-row').first().locator('.tab-measure').first()
  const box = (await measure.boundingBox())!
  const strings = page.locator('.tab-row').first().locator('.string-click-area').first()
  const stringsBox = (await strings.boundingBox())!
  await page.mouse.move(box.x + 30, stringsBox.y + 6)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 10, stringsBox.y + 6, { steps: 8 })
  await page.mouse.up()
}

const gaps = (events: AudioEvent[]) => events.slice(1).map((event, index) => event.time - events[index].time)

// The demo song: 90 BPM, 4/4, eighth notes in the first two bars.
const QUARTER = 60 / 90
const EIGHTH = QUARTER / 2

test.describe('practice transport', () => {
  test.beforeEach(async ({ page }) => {
    await waitForEditorShell(page)
    await waitForSoundFont(page)
    await recordAudio(page)
  })

  test('the metronome is off by default', async ({ page }) => {
    const { clicks, notes } = await playFor(page, 1500)
    expect(notes.length).toBeGreaterThan(0)
    expect(clicks).toHaveLength(0)
  })

  test('the metronome clicks every beat, accented on beat one, in time with the notes', async ({ page }) => {
    await page.locator('#metronomeToggle').click()
    const { clicks, notes } = await playFor(page, 3500)

    expect(clicks.length).toBeGreaterThanOrEqual(5)
    gaps(clicks).forEach((gap) => expect(gap).toBeCloseTo(QUARTER, 2))
    expect(clicks.map((click) => click.accent)).toEqual(clicks.map((_, index) => index % 4 === 0))
    expect(clicks[0].time).toBeCloseTo(notes[0].time, 3)
  })

  test('playback speed slows notes and clicks without changing the written tempo', async ({ page }) => {
    await page.locator('#metronomeToggle').click()
    await page.locator('#playbackSpeed').selectOption('0.5')
    const { clicks, notes } = await playFor(page, 3500)

    gaps(notes.slice(0, 3)).forEach((gap) => expect(gap).toBeCloseTo(EIGHTH * 2, 2))
    gaps(clicks).forEach((gap) => expect(gap).toBeCloseTo(QUARTER * 2, 2))
    await expect(page.locator('#content')).toContainText('90')
  })

  test('the count-in plays one bar of clicks before the first note', async ({ page }) => {
    await page.locator('#countInToggle').click()
    const { clicks, notes } = await playFor(page, 3500)

    const countIn = clicks.filter((click) => click.time < notes[0].time - 0.001)
    expect(countIn).toHaveLength(4)
    expect(countIn[0].accent).toBe(true)
    gaps(countIn).forEach((gap) => expect(gap).toBeCloseTo(QUARTER, 2))
    expect(notes[0].time - countIn[0].time).toBeCloseTo(QUARTER * 4, 2)
  })

  test('the metronome stays on the beat when the loop repeats', async ({ page }) => {
    await loopFirstMeasure(page)
    await page.locator('#metronomeToggle').click()
    const { clicks } = await playFor(page, 6000)

    // More than one pass through the one-bar loop, still one click per beat.
    expect(clicks.length).toBeGreaterThanOrEqual(8)
    gaps(clicks).forEach((gap) => expect(gap).toBeCloseTo(QUARTER, 2))
    expect(clicks.map((click) => click.accent)).toEqual(clicks.map((_, index) => index % 4 === 0))
  })

  test('the speed trainer speeds up after each pass through the loop', async ({ page }) => {
    await loopFirstMeasure(page)

    await page.locator('#playbackSpeed').selectOption('1')
    await page.locator('#speedTrainerToggle').click()
    await page.locator('#speedTrainerEnabled').check()
    await page.locator('#speedTrainerStep').selectOption('0.1')
    await page.locator('#speedTrainerTarget').selectOption('1.25')
    await page.locator('#speedTrainerToggle').click()

    await page.locator('#play').click()
    await expect.poll(async () => Number(await page.locator('#playbackSpeed').inputValue()), { timeout: 12_000 })
      .toBeGreaterThan(1)
    await page.locator('#play').click()
  })
})
