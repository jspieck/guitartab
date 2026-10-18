import { expect, test, type Page } from '@playwright/test'
import { toggleClassicalNotation, waitForEditorShell } from './helpers'
import { loadEffectsShowcase } from './fixtures/effectsShowcase'
import { findLayoutCollisions } from './fixtures/overlapDetector'

/** Every effect the fixture sets must actually be drawn. */
const RENDERED_EFFECTS: Record<string, string> = {
  'palm mute run': '.effect-run-palmMute',
  'let ring run': '.effect-run-letRing',
  bend: '.bend-path',
  'bend value': '.bend-text',
  vibrato: '.vibrato-path',
  trill: '.trill-wave',
  slide: '.slide-path',
  'hammer-on / pull-off': '.pulldown-path',
  tie: '.tie-path',
  'grace note': '.grace-fret-text',
  'tremolo picking': '.tremolo-picking-line',
  'tremolo bar': '.tremolo-bar-path',
  articulation: '.effect-text',
  'beat text': '.beat-text',
  dynamic: '.dynamic-text',
  stroke: '.stroke-mark',
  tuplet: '.tuplet-number',
  'chord diagram': '.chord-diagram',
  marker: '.marker',
  tempo: '.bpm-marking',
  'alternative ending': '.alternative-ending',
  'repeat start': '.repeat-start',
  'repeat end': '.repeat-end',
  'time signature': '.time-signature',
}

async function expectNoCollisions(page: Page): Promise<void> {
  const collisions = await findLayoutCollisions(page)
  expect(collisions, collisions.slice(0, 10).map((c) => `${c.a} / ${c.b}`).join('\n')).toEqual([])
}

test.describe('effects layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1600 })
    await waitForEditorShell(page)
    await loadEffectsShowcase(page)
    await expect(page.locator('.beat-text').first()).toBeVisible()
  })

  test('renders every effect without overlaps in the tab view', async ({ page }) => {
    for (const [name, selector] of Object.entries(RENDERED_EFFECTS)) {
      expect(await page.locator(`.tab-row ${selector}`).count(), name).toBeGreaterThan(0)
    }
    await expectNoCollisions(page)
  })

  test('renders every effect without overlaps with classical notation', async ({ page }) => {
    await toggleClassicalNotation(page)
    await expect.poll(async () => {
      const [rows, staves] = await Promise.all([
        page.locator('.tab-row').count(),
        page.locator('.vexFlowRow svg').count(),
      ])
      return rows > 0 && rows === staves
    }).toBe(true)
    await page.locator('#mainContent').evaluate((element) => { element.scrollTop = 0 })

    for (const [name, selector] of Object.entries(RENDERED_EFFECTS)) {
      expect(await page.locator(`.tab-row ${selector}`).count(), name).toBeGreaterThan(0)
    }
    await expectNoCollisions(page)
  })
})
