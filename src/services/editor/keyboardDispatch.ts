import fastdom from 'fastdom'
import { modalManager } from '../dialogs/modalManager'
import { toggleShortcutsHelp } from '../../stores/shortcutsHelpState'
import {
  isKeyboardControlTarget,
  matchShortcut,
  wantsNativeSpace,
  type ShortcutId,
} from '../../utils/keyboardShortcuts'
import { applyNoteLengthSelection } from '../menuActionCommands'
import playback from '../playback'
import { copyRange, pasteRange } from './clipboard'
import { undoHistory } from './editCommands'
import { deleteSelectedNotes, enterFretDigit, moveSelection } from './noteEntry'

/**
 * The editor's keyboard shortcuts: `handleKeyDown` listens on the document (capture phase)
 * and runs the handler of the `SHORTCUTS` entry (`utils/keyboardShortcuts.ts`) the key matches.
 */

/** What each shortcut does. Returns false when it does not apply right now. */
const shortcutHandlers: Partial<Record<ShortcutId, (event: KeyboardEvent) => boolean>> = {
  fret: (event) => enterFretDigit(Number(event.key)),
  deleteNote: () => {
    fastdom.mutate(() => deleteSelectedNotes())
    return true
  },
  moveLeft: () => (moveSelection('left'), true),
  moveRight: () => (moveSelection('right'), true),
  stringUp: () => (moveSelection('up'), true),
  stringDown: () => (moveSelection('down'), true),
  durationWhole: () => (applyNoteLengthSelection('w'), true),
  durationHalf: () => (applyNoteLengthSelection('h'), true),
  durationQuarter: () => (applyNoteLengthSelection('q'), true),
  durationEighth: () => (applyNoteLengthSelection('e'), true),
  durationSixteenth: () => (applyNoteLengthSelection('s'), true),
  durationThirtySecond: () => (applyNoteLengthSelection('t'), true),
  playPause: (event) => {
    if (!event.repeat) playback.togglePlayback()
    return true
  },
  undo: () => (undoHistory.undo(), true),
  redo: () => (undoHistory.redo(), true),
  copy: () => (copyRange(), true),
  paste: () => (pasteRange(), true),
  help: () => (toggleShortcutsHelp(), true),
}

/** Shortcuts that change the song or clipboard wait while a dialog is open. */
const blockedWhileModalOpen = new Set<ShortcutId>(['undo', 'redo', 'copy', 'paste'])

export function handleKeyDown(event: KeyboardEvent): void {
  // Something closer to the focus (a popover, a modal field) already took the key.
  if (event.defaultPrevented) return
  if (isKeyboardControlTarget(event.target)) return

  const shortcut = matchShortcut(event)
  if (shortcut == null) return
  const run = shortcutHandlers[shortcut.id]
  if (run == null) return
  if (blockedWhileModalOpen.has(shortcut.id) && modalManager.isAnyModalOpen()) return
  if (shortcut.id === 'playPause' && wantsNativeSpace(event.target)) return

  if (run(event)) {
    event.preventDefault()
    // This listens in the capture phase; stop here so the tab view does not act on the key too.
    event.stopPropagation()
  }
}
