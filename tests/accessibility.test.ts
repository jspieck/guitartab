// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announce, announcerState } from '../src/stores/announcerState'
import { focusableElements, wrapTabFocus } from '../src/services/a11y/focusable'
import { speakCursorPosition } from '../src/services/a11y/spokenPosition'
import { moveToolbarFocus, syncRovingTabindex } from '../src/components/toolbar/rovingToolbar'

// happy-dom does no layout: every element counts as shown unless it is display:none.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    const hidden = this.closest('[hidden]') != null || this.style.display === 'none'
    return (hidden ? [] : [{}]) as unknown as DOMRectList
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('speakCursorPosition', () => {
  it('reads the position with string 1 the highest, and the fret', () => {
    expect(speakCursorPosition({ blockId: 2, beatId: 1, string: 1 }, 6, { fret: 7 })).toBe(
      'Bar 3, beat 2, string 5, fret 7',
    )
  })

  it('names dead notes, ties, rests and voice 2', () => {
    const at = { blockId: 0, beatId: 0, string: 5 }
    expect(speakCursorPosition(at, 6, { fret: 3, dead: true })).toBe('Bar 1, beat 1, string 1, dead note')
    expect(speakCursorPosition(at, 6, { fret: 3, tied: true })).toBe('Bar 1, beat 1, string 1, fret 3, tied')
    expect(speakCursorPosition(at, 6, { rest: true })).toBe('Bar 1, beat 1, string 1, rest')
    expect(speakCursorPosition({ ...at, voiceId: 1 }, 6, {})).toBe('Bar 1, beat 1, string 1, voice 2')
  })
})

describe('announce', () => {
  it('speaks the same text twice by changing it invisibly', () => {
    announce('Bar 1, beat 1, string 1')
    const first = announcerState.text
    announce('Bar 1, beat 1, string 1')
    expect(announcerState.text).not.toBe(first)
    expect(announcerState.text.trim()).toBe('Bar 1, beat 1, string 1')
  })

  it('joins a follow-up to a message that was just set, but not two follow-ups', () => {
    vi.useFakeTimers()
    announce('Undo: Note')
    vi.advanceTimersByTime(150)
    announce('Bar 1, beat 2, string 1', { followUp: true })
    expect(announcerState.text).toBe('Undo: Note. Bar 1, beat 2, string 1')
    vi.advanceTimersByTime(150)
    announce('Bar 1, beat 3, string 1', { followUp: true })
    expect(announcerState.text).toBe('Bar 1, beat 3, string 1')
    vi.advanceTimersByTime(1000)
    announce('Redo: Note')
    vi.advanceTimersByTime(600)
    announce('Bar 1, beat 4, string 1', { followUp: true })
    expect(announcerState.text).toBe('Bar 1, beat 4, string 1')
  })
})

describe('focus helpers', () => {
  function dialog(): HTMLElement {
    document.body.innerHTML = `
      <div id="dialog" tabindex="-1">
        <button id="a">A</button>
        <input id="b" />
        <button id="hidden" hidden>H</button>
        <button id="off" disabled>D</button>
        <button id="c">C</button>
      </div>`
    return document.getElementById('dialog')!
  }

  it('lists what Tab reaches, without hidden or disabled controls', () => {
    expect(focusableElements(dialog()).map((element) => element.id)).toEqual(['a', 'b', 'c'])
  })

  it('wraps Tab from the last control to the first and Shift+Tab back', () => {
    const root = dialog()
    document.getElementById('c')!.focus()
    expect(wrapTabFocus(root, false)).toBe(true)
    expect(document.activeElement?.id).toBe('a')
    expect(wrapTabFocus(root, true)).toBe(true)
    expect(document.activeElement?.id).toBe('c')
    // In the middle the browser's own Tab is fine.
    document.getElementById('b')!.focus()
    expect(wrapTabFocus(root, false)).toBe(false)
  })
})

describe('roving toolbar', () => {
  function toolbar(): HTMLElement {
    document.body.innerHTML = `
      <div id="bar" data-roving-toolbar>
        <div class="toolbar__group"><button id="open">O</button><button id="save">S</button></div>
        <button id="loose">L</button>
        <div class="toolbar__group"><button id="undo" disabled>U</button><button id="redo">R</button></div>
      </div>`
    return document.getElementById('bar')!
  }
  const tabindexes = () =>
    Array.from(document.querySelectorAll('button')).map(
      (button) => `${button.id}:${button.getAttribute('tabindex')}`,
    )

  it('leaves one Tab stop per group and buttons outside groups alone', () => {
    syncRovingTabindex(toolbar())
    expect(tabindexes()).toEqual(['open:0', 'save:-1', 'loose:null', 'undo:-1', 'redo:0'])
  })

  it('moves with the arrows over the whole bar, skipping disabled buttons, and wraps', () => {
    const bar = toolbar()
    document.getElementById('save')!.focus()
    moveToolbarFocus(bar, 'ArrowRight')
    expect(document.activeElement?.id).toBe('loose')
    moveToolbarFocus(bar, 'ArrowRight')
    expect(document.activeElement?.id).toBe('redo')
    moveToolbarFocus(bar, 'ArrowRight')
    expect(document.activeElement?.id).toBe('open')
    moveToolbarFocus(bar, 'ArrowLeft')
    expect(document.activeElement?.id).toBe('redo')
    moveToolbarFocus(bar, 'Home')
    expect(document.activeElement?.id).toBe('open')
    moveToolbarFocus(bar, 'End')
    expect(document.activeElement?.id).toBe('redo')
  })

  it('makes the focused button its group’s Tab stop', () => {
    const bar = toolbar()
    document.getElementById('save')!.focus()
    syncRovingTabindex(bar)
    expect(tabindexes()).toEqual(['open:-1', 'save:0', 'loose:null', 'undo:-1', 'redo:0'])
  })
})
