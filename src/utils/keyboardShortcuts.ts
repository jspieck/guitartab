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
  | 'zoom'
  | 'help'

export type ShortcutGroup = 'Enter notes' | 'Move' | 'Note length' | 'Playback' | 'Edit' | 'View'

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
    !hasModifier(event) && keys.includes(event.key)

const letter = (code: string) => (event: KeyboardEvent) =>
  !hasModifier(event) && !event.shiftKey && event.code === `Key${code.toUpperCase()}`

const modLetter = (code: string) => (event: KeyboardEvent) =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  event.code === `Key${code.toUpperCase()}`

export const SHORTCUTS: readonly ShortcutDefinition[] = [
  {
    id: 'fret',
    group: 'Enter notes',
    description: 'Enter a fret on the selected string (type two digits quickly for 10 and up)',
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
  { id: 'durationWhole', group: 'Note length', description: 'Whole note', keys: [['W']], match: letter('w') },
  { id: 'durationHalf', group: 'Note length', description: 'Half note', keys: [['H']], match: letter('h') },
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
    description: 'Sixteenth note',
    keys: [['S']],
    match: letter('s'),
  },
  {
    id: 'durationThirtySecond',
    group: 'Note length',
    description: 'Thirty-second note',
    keys: [['T']],
    match: letter('t'),
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
    id: 'copy',
    group: 'Edit',
    description: 'Copy the selected range',
    keys: [['Mod', 'C']],
    match: modLetter('c'),
  },
  {
    id: 'paste',
    group: 'Edit',
    description: 'Paste at the selected beat',
    keys: [['Mod', 'V']],
    match: modLetter('v'),
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

export function matchShortcut(event: KeyboardEvent): ShortcutDefinition | undefined {
  return SHORTCUTS.find((shortcut) => shortcut.match?.(event) === true)
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
  return role === 'slider' || role === 'spinbutton' || role === 'textbox' || role === 'listbox'
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
