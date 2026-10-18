import { describe, expect, it } from 'vitest'
import {
  FRET_DIGIT_WINDOW_MS,
  SHORTCUTS,
  combineFretDigit,
  displayKeys,
  groupShortcuts,
  isKeyboardControlTarget,
  matchShortcut,
  maxFretFor,
} from '../src/utils/keyboardShortcuts'

function key(init: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
  } as KeyboardEvent
}

describe('keyboard shortcut table', () => {
  it.each([
    [{ key: '7', code: 'Digit7' }, 'fret'],
    [{ key: '3', code: 'Numpad3' }, 'fret'],
    [{ key: 'Delete', code: 'Delete' }, 'deleteNote'],
    [{ key: 'Backspace', code: 'Backspace' }, 'deleteNote'],
    [{ key: 'ArrowLeft', code: 'ArrowLeft' }, 'moveLeft'],
    [{ key: 'ArrowUp', code: 'ArrowUp' }, 'stringUp'],
    [{ key: 'w', code: 'KeyW' }, 'durationWhole'],
    [{ key: 'q', code: 'KeyQ' }, 'durationQuarter'],
    // Physical key, so it works on any layout: QWERTZ "z" sits on KeyY, AZERTY "a" on KeyQ.
    [{ key: 'a', code: 'KeyQ' }, 'durationQuarter'],
    [{ key: 't', code: 'KeyT' }, 'durationThirtySecond'],
    [{ key: ' ', code: 'Space' }, 'playPause'],
    [{ key: 'z', code: 'KeyZ', ctrlKey: true }, 'undo'],
    [{ key: 'z', code: 'KeyZ', metaKey: true, shiftKey: true }, 'redo'],
    [{ key: 'y', code: 'KeyY', ctrlKey: true }, 'redo'],
    [{ key: 'c', code: 'KeyC', ctrlKey: true }, 'copy'],
    [{ key: 'v', code: 'KeyV', metaKey: true }, 'paste'],
    [{ key: '?', code: 'Slash', shiftKey: true }, 'help'],
    // German layout: ? is Shift + ß.
    [{ key: '?', code: 'Minus', shiftKey: true }, 'help'],
  ])('%o runs %s', (init, id) => {
    expect(matchShortcut(key(init))?.id).toBe(id)
  })

  it.each([
    { key: 'w', code: 'KeyW', ctrlKey: true },
    { key: 'W', code: 'KeyW', shiftKey: true },
    { key: '7', code: 'Digit7', ctrlKey: true },
    { key: ' ', code: 'Space', ctrlKey: true },
    { key: 'x', code: 'KeyX' },
    { key: 'Escape', code: 'Escape' },
  ])('%o is not a shortcut handled by the table', (init) => {
    const shortcut = matchShortcut(key(init))
    expect(shortcut?.match).toBeUndefined()
  })

  it('has unique ids and a description and key label for every entry', () => {
    const ids = SHORTCUTS.map((shortcut) => shortcut.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.description.length).toBeGreaterThan(3)
      expect(shortcut.keys.length).toBeGreaterThan(0)
    }
  })

  it('groups shortcuts in table order', () => {
    const groups = groupShortcuts()
    expect(groups.map((group) => group.name)).toEqual([
      'Enter notes',
      'Move',
      'Note length',
      'Playback',
      'Edit',
      'View',
    ])
    expect(groups.flatMap((group) => group.items)).toHaveLength(SHORTCUTS.length)
  })

  it('shows Mod as Ctrl, or ⌘ on a Mac', () => {
    expect(displayKeys(['Mod', 'Z'], false)).toEqual(['Ctrl', 'Z'])
    expect(displayKeys(['Mod', 'Shift', 'Z'], true)).toEqual(['⌘', 'Shift', 'Z'])
  })
})

describe('fret entry', () => {
  const at = (fret: number, time: number, position = '0:0:0:0:5') => ({ position, fret, at: time })

  it('builds two-digit frets from quick digits on the same note', () => {
    expect(combineFretDigit(null, 1, 'p', 0, 29)).toBe(1)
    expect(combineFretDigit(at(1, 0, 'p'), 2, 'p', 300, 29)).toBe(12)
    expect(combineFretDigit(at(2, 0, 'p'), 4, 'p', 300, 29)).toBe(24)
  })

  it('starts a new fret when the digits are slow, on another note, or too high', () => {
    expect(combineFretDigit(at(1, 0, 'p'), 2, 'p', FRET_DIGIT_WINDOW_MS + 1, 29)).toBe(2)
    expect(combineFretDigit(at(1, 0, 'p'), 2, 'other', 300, 29)).toBe(2)
    expect(combineFretDigit(at(5, 0, 'p'), 5, 'p', 300, 29)).toBe(5)
    expect(combineFretDigit(at(12, 0, 'p'), 3, 'p', 300, 29)).toBe(3)
    // 0 then 5 is fret 5, not 05.
    expect(combineFretDigit(at(0, 0, 'p'), 5, 'p', 300, 29)).toBe(5)
  })

  it('allows three-digit MIDI notes on drum tracks', () => {
    expect(maxFretFor('drums')).toBe(127)
    expect(maxFretFor('guitar')).toBe(29)
    expect(combineFretDigit(at(12, 0, 'p'), 7, 'p', 300, maxFretFor('drums'))).toBe(127)
    expect(combineFretDigit(at(12, 0, 'p'), 8, 'p', 300, maxFretFor('drums'))).toBe(8)
  })
})

describe('focus targets', () => {
  it('leaves keys to text fields and keyboard-driven controls', () => {
    expect(isKeyboardControlTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true)
    expect(
      isKeyboardControlTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
    ).toBe(true)
    expect(
      isKeyboardControlTarget({ tagName: 'DIV', getAttribute: () => 'slider' } as unknown as EventTarget),
    ).toBe(true)
    expect(
      isKeyboardControlTarget({ tagName: 'svg', getAttribute: () => null } as unknown as EventTarget),
    ).toBe(false)
    expect(isKeyboardControlTarget(null)).toBe(false)
  })
})
