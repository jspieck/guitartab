import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations } from './axe'
import { waitForEditorShell } from './helpers'

async function openModal(page: Page, id: string): Promise<void> {
  await page.evaluate(async (modalId) => {
    const { DIALOGS, toggleDialog } = await import('/src/services/dialogs/dialogs.ts')
    await toggleDialog(Object.values(DIALOGS).find((dialog) => dialog.id === modalId)!)
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
      const { masterEqualizer } = await import('/src/services/audio/masterEqualizer.ts')
      ;(window as unknown as { __eqNodes: unknown[] }).__eqNodes = [...masterEqualizer.equalizerNodes]
    })
    await openModal(page, 'equalizerModal')

    const freqKnob = page.locator('#equalizerModal .eq-band').nth(1).getByRole('slider').first()
    await freqKnob.focus()
    await page.keyboard.press('PageUp')

    const state = await page.evaluate(async () => {
      const { masterEqualizer: handler } = await import('/src/services/audio/masterEqualizer.ts')
      const before = (window as unknown as { __eqNodes: BiquadFilterNode[] }).__eqNodes
      return {
        sameNodes:
          handler.equalizerNodes.length === before.length &&
          handler.equalizerNodes.every((node: BiquadFilterNode, i: number) => node === before[i]),
        frequency: handler.equalizerNodes[1].frequency.value,
      }
    })
    expect(state.sameNodes).toBe(true)
    expect(state.frequency).toBeGreaterThan(500)
  })

  test('a +12 dB bell boosts a 1 kHz tone by about 12 dB', async ({ page }) => {
    const boostDb = await page.evaluate(async () => {
      const { MasterEqualizer } = await import('/src/services/audio/masterEqualizer.ts')
      const render = async (gain: number) => {
        const ctx = new OfflineAudioContext(1, 48000, 48000)
        const eq = new MasterEqualizer()
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

  test("a track's EQ and compressor sound in an audio render, on that track only", async ({ page }) => {
    const levels = await page.evaluate(async () => {
      const { AudioGraph, audioGraph } = await import('/src/services/audio/audioGraph.ts')
      const { createDefaultEqBands } = await import('/src/services/audio/masterEqualizer.ts')
      const { setTrackEq, setTrackCompressor } = await import('/src/services/editor/songSettingsCommands.ts')
      // a 1 kHz tone into track 0's bus of an audio-export graph (a copy of the live one)
      const render = async (amplitude: number) => {
        const ctx = new OfflineAudioContext(2, 48000, 48000)
        const graph = new AudioGraph(ctx)
        graph.createBusses(audioGraph)
        graph.copyBussesOf(audioGraph)
        const osc = ctx.createOscillator()
        osc.frequency.value = 1000
        const gain = ctx.createGain()
        gain.gain.value = amplitude
        osc.connect(gain).connect(graph.busses[0].input)
        osc.start()
        const data = (await ctx.startRendering()).getChannelData(0).subarray(9600)
        let sum = 0
        for (const sample of data) sum += sample * sample
        return 20 * Math.log10(Math.sqrt(sum / data.length))
      }
      const plain = await render(0.05)
      const bands = createDefaultEqBands()
      bands[1] = { type: 'peaking', frequency: 1000, gain: 12, q: 1, enabled: true }
      setTrackEq(0, bands)
      const boosted = await render(0.05)
      setTrackEq(0, null)
      // the node adds make-up gain, so compare how far apart a quiet and a loud tone end up
      const range = async () => (await render(0.2)) - (await render(0.02))
      const plainRange = await range()
      setTrackCompressor(0, { enabled: true, threshold: -50, knee: 0, ratio: 10, attack: 1, release: 50 })
      const compressedRange = await range()
      setTrackCompressor(0, null)
      return { eqBoost: boosted - plain, plainRange, compressedRange }
    })
    expect(levels.eqBoost).toBeGreaterThan(11)
    expect(levels.eqBoost).toBeLessThan(13)
    expect(levels.plainRange).toBeCloseTo(20, 0)
    // 20 dB apart at 10:1 above the threshold: about 2 dB
    expect(levels.compressedRange).toBeLessThan(5)
  })

  test('compressor knobs drive the master compressor node', async ({ page }) => {
    await openModal(page, 'compressorModal')
    await page.getByRole('slider', { name: 'Threshold' }).focus()
    await page.keyboard.press('PageDown')
    await page.locator('#compressorPreset').selectOption('Punchy')

    const node = await page.evaluate(async () => {
      const { audioGraph } = await import('/src/services/audio/audioGraph.ts')
      return { threshold: audioGraph.limiter!.threshold.value, ratio: audioGraph.limiter!.ratio.value }
    })
    expect(node.threshold).toBeCloseTo(-14)
    expect(node.ratio).toBeCloseTo(4)

    await page.getByRole('switch', { name: 'Compressor on' }).click()
    const bypassed = await page.evaluate(async () => {
      const { audioGraph } = await import('/src/services/audio/audioGraph.ts')
      return audioGraph.limiter!.ratio.value
    })
    expect(bypassed).toBe(1)
  })

  test('drum mixer has working faders, mute and solo', async ({ page }) => {
    await openModal(page, 'mixerModal')
    await page.getByRole('tab', { name: 'Drum kit' }).click()
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
      const drumKit = await import('/src/services/audio/drumKit.ts')
      return {
        kickVolume: drumKit.noteToDrum.get(35)![2],
        snareActive: drumKit.noteToDrum.get(38)![4],
        hatAudible: drumKit.isDrumAudible(42),
        kickAudible: drumKit.isDrumAudible(35),
      }
    })
    expect(state.kickVolume).toBeLessThan(2)
    expect(state.snareActive).toBe(false)
    expect(state.hatAudible).toBe(true)
    expect(state.kickAudible).toBe(false)

    await page.getByRole('button', { name: 'Reset all' }).click()
    const reset = await page.evaluate(async () => {
      const drumKit = await import('/src/services/audio/drumKit.ts')
      return { kickVolume: drumKit.noteToDrum.get(35)![2], solo: drumKit.drumSolo.size }
    })
    expect(reset.kickVolume).toBe(2)
    expect(reset.solo).toBe(0)
  })
})

test.describe('mixer', () => {
  test('has a strip per track whose EQ and compressor go into that track only', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await waitForEditorShell(page, { demo: 'arrangement' })
    const names = await page.evaluate(async () => {
      const { default: Song } = await import('/src/stores/song.ts')
      return Song.tracks.map((track, i) => track.name?.trim() || `Track ${i + 1}`)
    })
    expect(names.length).toBeGreaterThan(1)

    await page.locator('#sequencerMixerOpen').click()
    await expect(page.locator('#mixerModal')).toHaveClass(/active/)
    await expect(page.getByRole('tab', { name: 'Tracks' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#mixerModal .tm-strip')).toHaveCount(names.length + 1)
    for (const name of names) await expect(page.getByRole('region', { name, exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Master', exact: true })).toBeVisible()
    await expectNoAxeViolations(page, '#mixerModal')

    // the second track's channel EQ: a band's gain puts the filters into its bus
    const name = names[1]
    await page.getByRole('button', { name: `EQ: equalizer of ${name}` }).click()
    await expect(page.locator('#equalizerModal')).toHaveClass(/active/)
    await expect(page.locator('#equalizerModal .modalTopBarLabel')).toContainText(name)
    const gainKnob = page.locator('#equalizerModal .eq-band').nth(1).getByRole('slider', { name: /Gain/ })
    await gainKnob.focus()
    await page.keyboard.press('PageUp')
    await expect(page.getByRole('button', { name: `EQ: equalizer of ${name}` })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // the panels open over the mixer
    await page.keyboard.press('Escape')
    await expect(page.locator('#equalizerModal')).not.toHaveClass(/active/)

    await page.getByRole('button', { name: `Comp: compressor of ${name}` }).click()
    await expect(page.locator('#compressorModal .modalTopBarLabel')).toContainText(name)
    await page.getByRole('switch', { name: 'Compressor on' }).click()
    await page.keyboard.press('Escape')
    await expect(page.locator('#compressorModal')).not.toHaveClass(/active/)

    const mixer = page.locator('#mixerModal')
    await mixer.getByRole('button', { name: `Mute ${name}` }).click()
    await mixer.getByRole('slider', { name: `${name} volume` }).focus()
    await page.keyboard.press('PageDown')

    const state = await page.evaluate(async () => {
      const { default: Song } = await import('/src/stores/song.ts')
      const { audioGraph } = await import('/src/services/audio/audioGraph.ts')
      const { masterEqualizer } = await import('/src/services/audio/masterEqualizer.ts')
      return {
        eq: Song.tracks[1].eq?.[1].gain ?? 0,
        compressor: Song.tracks[1].compressor?.enabled ?? false,
        inChain: [audioGraph.busses[1].eqInChain, audioGraph.busses[1].compressorInChain],
        otherTrack: [audioGraph.busses[0].eqInChain, audioGraph.busses[0].compressorInChain],
        masterFlat: masterEqualizer.isFlat(),
        muted: Song.playBackInstrument[1].mute,
        volume: Song.playBackInstrument[1].volume,
      }
    })
    expect(state.eq).toBeGreaterThan(0)
    expect(state.compressor).toBe(true)
    expect(state.inChain).toEqual([true, true])
    expect(state.otherTrack).toEqual([false, false])
    expect(state.masterFlat).toBe(true)
    expect(state.muted).toBe(true)
    expect(state.volume).toBeLessThan(100)

    // the drum pieces are the other view
    await page.getByRole('tab', { name: 'Drum kit' }).click()
    await expect(page.getByRole('button', { name: /Full kit/ })).toBeVisible()
    await expectNoAxeViolations(page, '#mixerModal')
  })
})
