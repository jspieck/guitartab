/**
 * Every keyboard shortcut of the editor, in one table. The key handler dispatches from
 * it and the Help sheet lists it, so the sheet can only show shortcuts that exist.
 */
export type ShortcutId =
  | 'fret'
  | 'deleteNote'
  | 'moveLeft'
  | 'moveRight'
  | 'stringUp'
  | 'stringDown'
  | 'clearSelection'
  | 'durationWhole'
  | 'durationHalf'
  | 'durationQuarter'
  | 'durationEighth'
  | 'durationSixteenth'
  | 'durationThirtySecond'
  | 'playPause'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'noteMenu'
  | 'lyrics'
  | 'extendLeft'
  | 'extendRight'
  | 'selectAll'
  | 'cut'
  | 'pasteAsBars'
  | 'transposeUp'
  | 'transposeDown'
  | 'octaveUp'
  | 'octaveDown'
  | 'dot'
  | 'tuplet'
  | 'rest'
  | 'tie'
  | 'insertBeat'
  | 'deleteBeat'
  | 'voice1'
  | 'voice2'
  | 'trackUp'
  | 'trackDown'
  | 'zoom'
  | 'help'
  | `drum:${string}`

export type ShortcutGroup =
  'Enter notes' | 'Drum tracks' | 'Move' | 'Select' | 'Note length' | 'Rhythm' | 'Playback' | 'Edit' | 'View'

export interface ShortcutDefinition {
  id: ShortcutId
  group: ShortcutGroup
  description: string
  /** Key combinations as shown to the user; `Mod` is Ctrl, or ⌘ on a Mac. */
  keys: string[][]
  /** Missing for shortcuts that aren't key presses (Ctrl + mouse wheel). */
  match?: (event: KeyboardEvent) => boolean
}

export function isUndoShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.code === 'KeyZ' && !event.shiftKey
}

export function isRedoShortcut(event: KeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) && (event.code === 'KeyY' || (event.code === 'KeyZ' && event.shiftKey))
  )
}

const hasModifier = (event: KeyboardEvent) => event.ctrlKey || event.metaKey || event.altKey

const plainKey =
  (...keys: string[]) =>
  (event: KeyboardEvent) =>
    !hasModifier(event) && !event.shiftKey && keys.includes(event.key)

const shiftKey = (key: string) => (event: KeyboardEvent) =>
  event.shiftKey && !hasModifier(event) && event.key === key

const modKey =
  (key: string, shift = false) =>
  (event: KeyboardEvent) =>
    (event.ctrlKey || event.metaKey) && !event.altKey && event.shiftKey === shift && event.key === key

const altKey = (key: string) => (event: KeyboardEvent) =>
  event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === key

/** Alt + a digit key, by its position (Alt changes the character on a Mac). */
const altDigit =
  (...digits: number[]) =>
  (event: KeyboardEvent) =>
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    digits.some((digit) => event.code === `Digit${digit}` || event.code === `Numpad${digit}`)

/** Tuplet counts on Alt + their digit (Alt+1 and Alt+2 are the voices). */
export const TUPLET_KEYS = [3, 5, 6, 7, 9] as const

export function tupletOfKey(event: KeyboardEvent): number | null {
  const digit = Number(event.code.replace(/^(Digit|Numpad)/, ''))
  return (TUPLET_KEYS as readonly number[]).includes(digit) ? digit : null
}

const letter = (code: string) => (event: KeyboardEvent) =>
  !hasModifier(event) && !event.shiftKey && event.code === `Key${code.toUpperCase()}`

/** A letter with or without Shift (Shift+S and Shift+H keep the note lengths on drum tracks). */
const letterOrShift = (code: string) => (event: KeyboardEvent) =>
  !hasModifier(event) && event.code === `Key${code.toUpperCase()}`

/**
 * Letter keys of the drums on a drum track, by key position (`event.code`), so they work on
 * every keyboard layout. A key enters the first of its drums the track's drum map has (else
 * the first, which then gets a line); pressed again on the same beat it takes the hit away.
 * They win over the letter shortcuts there (S, H: note lengths on Shift+S, Shift+H).
 */
export const DRUM_KEYS: readonly { key: string; name: string; drums: readonly number[] }[] = [
  { key: 'K', name: 'Kick', drums: [36, 35] },
  { key: 'S', name: 'Snare', drums: [38, 40] },
  { key: 'X', name: 'Side stick', drums: [37] },
  { key: 'H', name: 'Hi-hat', drums: [42] },
  { key: 'O', name: 'Open hi-hat', drums: [46] },
  { key: 'P', name: 'Pedal hi-hat', drums: [44] },
  { key: 'C', name: 'Crash', drums: [49, 57, 55, 52] },
  { key: 'I', name: 'Ride', drums: [51, 59] },
  { key: 'B', name: 'Ride bell', drums: [53] },
  { key: 'U', name: 'High tom', drums: [50, 48] },
  { key: 'M', name: 'Mid tom', drums: [47, 45] },
  { key: 'F', name: 'Floor tom', drums: [43, 41] },
]

/** The drum a drum key enters on a track with this drum map. */
export function drumOfKey(key: string, drumMap: readonly number[] | null | undefined): number | null {
  const entry = DRUM_KEYS.find((candidate) => candidate.key === key)
  if (entry == null) return null
  return entry.drums.find((drum) => drumMap?.includes(drum)) ?? entry.drums[0]
}

const DRUM_SHORTCUTS: ShortcutDefinition[] = DRUM_KEYS.map(({ key, name }) => ({
  id: `drum:${key}`,
  group: 'Drum tracks',
  description: `${name} on / off at the cursor`,
  keys: [[key]],
  match: letter(key),
}))

const modLetter = (code: string) => (event: KeyboardEvent) =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  event.code === `Key${code.toUpperCase()}`

export const SHORTCUTS: readonly ShortcutDefinition[] = [
  {
    id: 'fret',
    group: 'Enter notes',
    description:
      'Enter a fret on the selected string (type two digits quickly for 10 and up); on drum tracks a General MIDI drum number (36 kick)',
    keys: [['0–9']],
    match: (event) => !hasModifier(event) && /^[0-9]$/.test(event.key),
  },
  {
    id: 'deleteNote',
    group: 'Enter notes',
    description: 'Delete the selected note, or every note in the selected range',
    keys: [['Delete'], ['Backspace']],
    match: plainKey('Delete', 'Backspace'),
  },
  {
    id: 'clearSelection',
    group: 'Enter notes',
    description: 'Clear the selection',
    keys: [['Esc']],
    // Handled by the tab view, which owns the selection.
  },
  ...DRUM_SHORTCUTS,
  {
    id: 'moveLeft',
    group: 'Move',
    description: 'Previous beat',
    keys: [['←']],
    match: plainKey('ArrowLeft'),
  },
  { id: 'moveRight', group: 'Move', description: 'Next beat', keys: [['→']], match: plainKey('ArrowRight') },
  {
    id: 'stringUp',
    group: 'Move',
    description: 'Next higher string',
    keys: [['↑']],
    match: plainKey('ArrowUp'),
  },
  {
    id: 'stringDown',
    group: 'Move',
    description: 'Next lower string',
    keys: [['↓']],
    match: plainKey('ArrowDown'),
  },
  {
    id: 'voice1',
    group: 'Move',
    description: 'Edit voice 1',
    keys: [['Alt', '1']],
    match: altDigit(1),
  },
  {
    id: 'voice2',
    group: 'Move',
    description: 'Edit voice 2 (drawn in its own colour)',
    keys: [['Alt', '2']],
    match: altDigit(2),
  },
  {
    id: 'trackUp',
    group: 'Move',
    description: 'Previous track (in the score view: the track above)',
    keys: [['Alt', '↑']],
    match: altKey('ArrowUp'),
  },
  {
    id: 'trackDown',
    group: 'Move',
    description: 'Next track (in the score view: the track below)',
    keys: [['Alt', '↓']],
    match: altKey('ArrowDown'),
  },
  {
    id: 'extendLeft',
    group: 'Select',
    description: 'Extend the selection a beat left (also Shift+click)',
    keys: [['Shift', '←']],
    match: shiftKey('ArrowLeft'),
  },
  {
    id: 'extendRight',
    group: 'Select',
    description: 'Extend the selection a beat right',
    keys: [['Shift', '→']],
    match: shiftKey('ArrowRight'),
  },
  {
    id: 'selectAll',
    group: 'Select',
    description: 'Select the bar; again: the whole track',
    keys: [['Mod', 'A']],
    match: modLetter('a'),
  },
  {
    id: 'transposeUp',
    group: 'Select',
    description: 'Transpose the selection a semitone up',
    keys: [['Mod', '↑']],
    match: modKey('ArrowUp'),
  },
  {
    id: 'transposeDown',
    group: 'Select',
    description: 'Transpose the selection a semitone down',
    keys: [['Mod', '↓']],
    match: modKey('ArrowDown'),
  },
  {
    id: 'octaveUp',
    group: 'Select',
    description: 'Transpose the selection an octave up',
    keys: [['Mod', 'Shift', '↑']],
    match: modKey('ArrowUp', true),
  },
  {
    id: 'octaveDown',
    group: 'Select',
    description: 'Transpose the selection an octave down',
    keys: [['Mod', 'Shift', '↓']],
    match: modKey('ArrowDown', true),
  },
  { id: 'durationWhole', group: 'Note length', description: 'Whole note', keys: [['W']], match: letter('w') },
  {
    id: 'durationHalf',
    group: 'Note length',
    description: 'Half note (Shift+H on drum tracks)',
    keys: [['H'], ['Shift', 'H']],
    match: letterOrShift('h'),
  },
  {
    id: 'durationQuarter',
    group: 'Note length',
    description: 'Quarter note',
    keys: [['Q']],
    match: letter('q'),
  },
  {
    id: 'durationEighth',
    group: 'Note length',
    description: 'Eighth note',
    keys: [['E']],
    match: letter('e'),
  },
  {
    id: 'durationSixteenth',
    group: 'Note length',
    description: 'Sixteenth note (Shift+S on drum tracks)',
    keys: [['S'], ['Shift', 'S']],
    match: letterOrShift('s'),
  },
  {
    id: 'durationThirtySecond',
    group: 'Note length',
    description: 'Thirty-second note',
    keys: [['T']],
    match: letter('t'),
  },
  {
    id: 'dot',
    group: 'Rhythm',
    description: 'Dotted note on / off',
    keys: [['.']],
    match: (event) => !hasModifier(event) && event.key === '.',
  },
  {
    id: 'tuplet',
    group: 'Rhythm',
    description: 'Triplet (Alt+5, 6, 7, 9: other tuplets); again: off',
    keys: [['Alt', '3']],
    match: altDigit(...TUPLET_KEYS),
  },
  { id: 'rest', group: 'Rhythm', description: 'Make the beat a rest', keys: [['R']], match: letter('r') },
  {
    id: 'tie',
    group: 'Rhythm',
    description: 'Tie to the previous note on the string',
    keys: [['L']],
    match: letter('l'),
  },
  {
    id: 'insertBeat',
    group: 'Rhythm',
    description: 'Insert a rest here (current note length); the bar moves right',
    keys: [['Insert']],
    match: plainKey('Insert'),
  },
  {
    id: 'deleteBeat',
    group: 'Rhythm',
    description: 'Delete the beat; the bar moves left',
    keys: [
      ['Mod', 'Delete'],
      ['Mod', 'Backspace'],
    ],
    match: (event) =>
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      (event.key === 'Delete' || event.key === 'Backspace'),
  },
  {
    id: 'playPause',
    group: 'Playback',
    description: 'Play / pause',
    keys: [['Space']],
    match: (event) => !hasModifier(event) && event.code === 'Space',
  },
  { id: 'undo', group: 'Edit', description: 'Undo', keys: [['Mod', 'Z']], match: isUndoShortcut },
  {
    id: 'redo',
    group: 'Edit',
    description: 'Redo',
    keys: [
      ['Mod', 'Y'],
      ['Mod', 'Shift', 'Z'],
    ],
    match: isRedoShortcut,
  },
  {
    id: 'cut',
    group: 'Edit',
    description: 'Cut the selection (or the beat)',
    keys: [['Mod', 'X']],
    match: modLetter('x'),
  },
  {
    id: 'copy',
    group: 'Edit',
    description: 'Copy the selection (or the beat), with effects and lyrics',
    keys: [['Mod', 'C']],
    match: modLetter('c'),
  },
  {
    id: 'paste',
    group: 'Edit',
    description: 'Paste over the selection, or from the cursor on',
    keys: [['Mod', 'V']],
    match: modLetter('v'),
  },
  {
    id: 'pasteAsBars',
    group: 'Edit',
    description: 'Paste as new bars before the cursor’s bar',
    keys: [['Mod', 'Shift', 'V']],
    match: (event) =>
      (event.ctrlKey || event.metaKey) && !event.altKey && event.shiftKey && event.code === 'KeyV',
  },
  {
    id: 'noteMenu',
    group: 'Edit',
    description: 'Note menu at the cursor (effects, dynamics, length, bar, text); also a right-click',
    keys: [['Shift', 'F10'], ['Menu']],
    match: (event) =>
      (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'F10') ||
      event.key === 'ContextMenu',
  },
  {
    id: 'lyrics',
    group: 'Edit',
    description: 'Lyrics at the cursor: Space or Tab next note, - next syllable, ↑/↓ verse, Enter done',
    keys: [['Shift', 'L']],
    match: (event) => event.shiftKey && !hasModifier(event) && event.code === 'KeyL',
  },
  { id: 'zoom', group: 'View', description: 'Zoom the tab (mouse wheel)', keys: [['Mod', 'Wheel']] },
  {
    id: 'help',
    group: 'View',
    description: 'Show this list',
    keys: [['?']],
    match: (event) => !event.ctrlKey && !event.metaKey && !event.altKey && event.key === '?',
  },
]

/** The shortcut a key press means; the drum keys only on a drum track (`drums`), where they come first. */
export function matchShortcut(event: KeyboardEvent, { drums = false } = {}): ShortcutDefinition | undefined {
  if (drums) {
    const drum = DRUM_SHORTCUTS.find((shortcut) => shortcut.match?.(event) === true)
    if (drum != null) return drum
  }
  return SHORTCUTS.find((shortcut) => shortcut.group !== 'Drum tracks' && shortcut.match?.(event) === true)
}

export function isMacPlatform(
  platform = typeof navigator === 'undefined' ? '' : navigator.platform,
): boolean {
  return /mac|iphone|ipad/i.test(platform)
}

/** `['Mod', 'Z']` → `['Ctrl', 'Z']`, or `['⌘', 'Z']` on a Mac. */
export function displayKeys(keys: string[], mac = isMacPlatform()): string[] {
  return keys.map((key) => (key === 'Mod' ? (mac ? '⌘' : 'Ctrl') : key))
}

export function groupShortcuts(shortcuts: readonly ShortcutDefinition[] = SHORTCUTS) {
  const groups = new Map<ShortcutGroup, ShortcutDefinition[]>()
  for (const shortcut of shortcuts) {
    groups.set(shortcut.group, [...(groups.get(shortcut.group) ?? []), shortcut])
  }
  return [...groups].map(([name, items]) => ({ name, items }))
}

export interface FretEntry {
  /** Position the digits were typed at, as a comparable key. */
  position: string
  fret: number
  at: number
}

/** Digits typed this close together on the same note build one number (1, 2 → 12). */
export const FRET_DIGIT_WINDOW_MS = 1000

/**
 * The fret a digit enters. A second (or third) digit typed quickly on the same note
 * extends the number while it stays a playable fret; otherwise the digit starts anew.
 */
export function combineFretDigit(
  previous: FretEntry | null,
  digit: number,
  position: string,
  now: number,
  maxFret: number,
): number {
  if (previous && previous.position === position && now - previous.at <= FRET_DIGIT_WINDOW_MS) {
    const combined = previous.fret * 10 + digit
    if (previous.fret > 0 && combined <= maxFret) {
      return combined
    }
  }
  return digit
}

/** Highest fret for a track. Drum notes store the MIDI note in the fret. */
export function maxFretFor(instrument: string | undefined): number {
  return instrument === 'drums' ? 127 : 29
}

/** Focus is somewhere the key belongs to: a text field or a control that uses keys itself. */
export function isKeyboardControlTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as {
    tagName?: string
    isContentEditable?: boolean
    getAttribute?: (name: string) => string | null
  }
  const tag = element.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable === true) {
    return true
  }
  const role = element.getAttribute?.('role')
  // Menus and tab lists move their focus with the arrow keys.
  return (
    role === 'slider' ||
    role === 'spinbutton' ||
    role === 'textbox' ||
    role === 'listbox' ||
    role === 'tab' ||
    role?.startsWith('menuitem') === true
  )
}

/**
 * Space on a button the user reached with the keyboard should press that button, not
 * start playback. A button that only has focus because it was clicked does not count.
 */
export function wantsNativeSpace(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as Element
  if (typeof element.matches !== 'function') return false
  const interactive = element.matches(
    'button, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="tab"]',
  )
  if (!interactive) return false
  try {
    return element.matches(':focus-visible')
  } catch {
    return true
  }
}

const TOOLBAR_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])

/**
 * Whether ←/→/Home/End on this target move along a toolbar (`data-roving-toolbar`,
 * components/toolbar/rovingToolbar.ts) instead of moving the tab cursor.
 */
export function isToolbarNavigationKey(event: KeyboardEvent): boolean {
  if (!TOOLBAR_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
    return false
  const target = event.target as Element | null
  if (
    target == null ||
    typeof target.closest !== 'function' ||
    target.closest('[data-roving-toolbar]') == null
  )
    return false
  if (target.tagName !== 'BUTTON' || target.getAttribute('role') === 'tab') return false
  // A button that has the focus only because it was clicked keeps the arrows for the cursor.
  try {
    return target.matches(':focus-visible')
  } catch {
    return true
  }
}
