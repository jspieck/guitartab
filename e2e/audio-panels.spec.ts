import { expect, test, type Page } from '@playwright/test'
import { waitForEditorShell } from './helpers'

async function openModal(page: Page, id: string): Promise<void> {
  await page.evaluate(async (modalId) => {
    const { modalManager } = await import('/src/assets/js/modals/modalManager.ts')
    modalManager.toggleModal(modalId, modalId)
  }, id)
  await expect(page.locator(`#${id}`)).toHaveClass(/active/)
}

test.describe('studio panels', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await waitForEditorShell(page)
  })

  test('equalizer edits the filters that are wired into the master chain', async ({ page }) => {
    // Remember the nodes createBusses() wired in at startup.
    await page.evaluate(async () => {
      const { modalManager } = await import('/src/assets/js/modals/modalManager.ts')
      ;(window as unknown as { __eqNodes: unknown[] }).__eqNodes = [...modalManager.getHandler('equalizerModal').equalizerNodes]
    })
    await openModal(page, 'equalizerModal')

    const freqKnob = page.locator('#equalizerModal .eq-band').nth(1).getByRole('slider').first()
    await freqKnob.focus()
    await page.keyboard.press('PageUp')

    const state = await page.evaluate(async () => {
      const { modalManager } = await import('/src/assets/js/modals/modalManager.ts')
      const handler = modalManager.getHandler('equalizerModal')
      const before = (window as unknown as { __eqNodes: BiquadFilterNode[] }).__eqNodes
      return {
        sameNodes: handler.equalizerNodes.length === before.length
          && handler.equalizerNodes.every((node: BiquadFilterNode, i: number) => node === before[i]),
        frequency: handler.equalizerNodes[1].frequency.value,
      }
    })
    expect(state.sameNodes).toBe(true)
    expect(state.frequency).toBeGreaterThan(500)
  })

  test('a +12 dB bell boosts a 1 kHz tone by about 12 dB', async ({ page }) => {
    const boostDb = await page.evaluate(async () => {
      const { EqualizerModalHandler } = await import('/src/assets/js/modals/equalizerModalHandler.ts')
      const render = async (gain: number) => {
        const ctx = new OfflineAudioContext(1, 48000, 48000)
        const eq = new EqualizerModalHandler()
        eq.setAudioContext(ctx as unknown as AudioContext)
        eq.bands.value.forEach((_, index) => eq.setBand(index, { type: 'peaking', gain: 0, enabled: true }))
        eq.setBand(1, { type: 'peaking', frequency: 1000, gain, q: 1 })
        const osc = ctx.createOscillator()
        osc.frequency.value = 1000
        const out = ctx.createGain()
        eq.insertBetween(osc, out)
        out.connect(ctx.destination)
        osc.start()
        const buffer = await ctx.startRendering()
        const data = buffer.getChannelData(0).subarray(4800)
        let sum = 0
        for (const sample of data) sum += sample * sample
        return Math.sqrt(sum / data.length)
      }
      return 20 * Math.log10((await render(12)) / (await render(0)))
    })
    expect(boostDb).toBeGreaterThan(11)
    expect(boostDb).toBeLessThan(13)
  })

  test('compressor knobs drive the master compressor node', async ({ page }) => {
    await openModal(page, 'compressorModal')
    await page.getByRole('slider', { name: 'Threshold' }).focus()
    await page.keyboard.press('PageDown')
    await page.locator('#compressorPreset').selectOption('Punchy')

    const node = await page.evaluate(async () => {
      const { audioEngine } = await import('/src/assets/js/audioEngine.ts')
      return { threshold: audioEngine.limiter!.threshold.value, ratio: audioEngine.limiter!.ratio.value }
    })
    expect(node.threshold).toBeCloseTo(-14)
    expect(node.ratio).toBeCloseTo(4)

    await page.getByRole('switch', { name: 'Compressor on' }).click()
    const bypassed = await page.evaluate(async () => {
      const { audioEngine } = await import('/src/assets/js/audioEngine.ts')
      return audioEngine.limiter!.ratio.value
    })
    expect(bypassed).toBe(1)
  })

  test('drum mixer has working faders, mute and solo', async ({ page }) => {
    await openModal(page, 'mixerModal')
    // The demo song has no drums, so the panel falls back to the full kit.
    await expect(page.getByRole('button', { name: /Full kit/ })).toHaveAttribute('aria-pressed', 'true')

    const box = await page.locator('#mixerModal').boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(1440)

    await page.getByRole('slider', { name: 'Kick 1 volume' }).focus()
    await page.keyboard.press('PageDown')
    await page.getByRole('button', { name: 'Mute Snare 1' }).click()
    await page.getByRole('button', { name: 'Solo Closed Hi-hat' }).click()

    const state = await page.evaluate(async () => {
      const { audioEngine } = await import('/src/assets/js/audioEngine.ts')
      return {
        kickVolume: audioEngine.noteToDrum.get(35)![2],
        snareActive: audioEngine.noteToDrum.get(38)![4],
        hatAudible: audioEngine.isDrumAudible(42),
        kickAudible: audioEngine.isDrumAudible(35),
      }
    })
    expect(state.kickVolume).toBeLessThan(2)
    expect(state.snareActive).toBe(false)
    expect(state.hatAudible).toBe(true)
    expect(state.kickAudible).toBe(false)

    await page.getByRole('button', { name: 'Reset all' }).click()
    const reset = await page.evaluate(async () => {
      const { audioEngine } = await import('/src/assets/js/audioEngine.ts')
      return { kickVolume: audioEngine.noteToDrum.get(35)![2], solo: audioEngine.drumSolo.size }
    })
    expect(reset.kickVolume).toBe(2)
    expect(reset.solo).toBe(0)
  })
})
