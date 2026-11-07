// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import SaveFormatMenu from '../../src/components/SaveFormatMenu.vue'
import PracticeControls from '../../src/components/PracticeControls.vue'
import { practiceState } from '../../src/stores/practiceState'

const exportSong = vi.fn()
vi.mock('../../src/services/songExport', () => ({ exportSong: (...args: unknown[]) => exportSong(...args) }))

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('SaveFormatMenu', () => {
  beforeEach(() => {
    exportSong.mockClear()
    wrapper = mount(SaveFormatMenu, { attachTo: document.body })
  })

  const popover = () => document.body.querySelector('.save-menu__popover')

  it('opens a menu outside the toolbar with the export formats', async () => {
    expect(popover()).toBeNull()
    await wrapper!.get('#downloadGP').trigger('click')
    // Teleported to <body>, not inside the (clipping) toolbar markup.
    expect(popover()?.parentElement).toBe(document.body)
    expect(wrapper!.element.contains(popover())).toBe(false)
    expect([...document.querySelectorAll('[role="menuitem"]')].map((item) => item.id)).toEqual([
      'download-gt',
      'download-gp',
      'download-gpx',
      'download-gp5',
      'download-musicxml',
      'download-midi',
      'download-midi-bars',
    ])
    expect(wrapper!.get('#downloadGP').attributes('aria-expanded')).toBe('true')
  })

  it('exports the chosen format and closes', async () => {
    await wrapper!.get('#downloadGP').trigger('click')
    ;(document.querySelector('#download-musicxml') as HTMLButtonElement).click()
    await flushPromises()
    await vi.dynamicImportSettled()
    expect(exportSong).toHaveBeenCalledWith('musicxml')
    expect(popover()).toBeNull()
  })

  it('closes on Escape and on a click elsewhere, but not on a click inside', async () => {
    await wrapper!.get('#downloadGP').trigger('click')
    popover()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(popover()).toBeNull()

    await wrapper!.get('#downloadGP').trigger('click')
    popover()!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(popover()).not.toBeNull()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(popover()).toBeNull()
  })
})

describe('PracticeControls', () => {
  beforeEach(() => {
    Object.assign(practiceState, { playbackRate: 1, metronome: false, countIn: false, trainer: false })
    wrapper = mount(PracticeControls, { attachTo: document.body })
  })

  it('changes playback speed and toggles metronome and count-in', async () => {
    await wrapper!.get('#playbackSpeed').setValue('0.75')
    expect(practiceState.playbackRate).toBe(0.75)
    await wrapper!.get('#metronomeToggle').trigger('click')
    expect(practiceState.metronome).toBe(true)
    expect(wrapper!.get('#metronomeToggle').attributes('aria-pressed')).toBe('true')
    await wrapper!.get('#countInToggle').trigger('click')
    expect(practiceState.countIn).toBe(true)
  })

  it('shows the speed trainer settings outside the toolbar and binds them', async () => {
    await wrapper!.get('#speedTrainerToggle').trigger('click')
    const popover = document.body.querySelector('.practice-controls__popover')
    expect(popover?.parentElement).toBe(document.body)
    const enabled = document.querySelector('#speedTrainerEnabled') as HTMLInputElement
    enabled.checked = true
    enabled.dispatchEvent(new Event('change'))
    expect(practiceState.trainer).toBe(true)
    popover!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.body.querySelector('.practice-controls__popover')).toBeNull()
  })
})
