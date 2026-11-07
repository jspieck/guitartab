import fastdom from 'fastdom'
import { anyDialogOpen } from '../../stores/dialogState'
import { toggleShortcutsHelp } from '../../stores/shortcutsHelpState'
import {
  drumOfKey,
  isKeyboardControlTarget,
  isToolbarNavigationKey,
  matchShortcut,
  tupletOfKey,
  wantsNativeSpace,
  type ShortcutId,
} from '../../utils/keyboardShortcuts'
import Song from '../../stores/song'
import { applyNoteLengthSelection } from '../menuActionCommands'
import playback from '../playback'
import { copyRange, cutRange, pasteAsNewBars, pasteRange } from './clipboard'
import {
  deleteSelectedNotes,
  enterFretDigit,
  hasExplicitNoteSelection,
  makeRestAtCursor,
  moveSelection,
} from './noteEntry'
import { drumMapOf, toggleDrumAtCursor } from './drumTracks'
import { isDrumTrack } from '../drumMixer'
import { selectionState } from '../../stores/selectionState'
import { switchTrack } from './trackLoading'
import { moveCursorToTrack } from './scoreViewCommands'
import { undoHistory } from './editCommands'
import { openNoteMenuAtCursor } from './noteMenu'
import { startLyricsEntry } from './lyricsEntry'

/**
 * The editor's keyboard shortcuts: `handleKeyDown` listens on the document (capture phase)
 * and runs the handler of the `SHORTCUTS` entry (`utils/keyboardShortcuts.ts`) the key matches.
 */

/** What each shortcut does. Returns false when it does not apply right now. */
// The rhythm, selection and transpose commands are the lazy `editing-tools` chunk
// (vite.config.ts); the key is taken at once and the command runs when it has loaded.
// Keys pressed meanwhile wait for it (`queued`), so Ctrl+A then Ctrl+C copies the selected
// bar and not the cursor's beat.
let queued: Promise<void> | null = null
function afterQueued(run: () => unknown): void {
  const step = (queued ?? Promise.resolve()).then(run).then(
    () => undefined,
    (error) => console.error('Shortcut failed', error),
  )
  queued = step
  void step.then(() => {
    if (queued === step) queued = null
  })
}
const rhythm = (run: (tools: typeof import('./rhythmCommands')) => unknown) => () => {
  afterQueued(() => import('./rhythmCommands').then(run))
  return true
}
const selecting = (run: (tools: typeof import('./selectionCommands')) => unknown) => () => {
  afterQueued(() => import('./selectionCommands').then(run))
  return true
}

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
  noteMenu: () => (openNoteMenuAtCursor(), true),
  lyrics: () => startLyricsEntry(),
  extendLeft: selecting((tools) => tools.extendSelection('left')),
  extendRight: selecting((tools) => tools.extendSelection('right')),
  selectAll: selecting((tools) => tools.selectBarOrTrack()),
  cut: () => (cutRange(), true),
  pasteAsBars: () => (pasteAsNewBars(), true),
  transposeUp: selecting((tools) => tools.transposeSelection(1)),
  transposeDown: selecting((tools) => tools.transposeSelection(-1)),
  octaveUp: selecting((tools) => tools.transposeSelection(12)),
  octaveDown: selecting((tools) => tools.transposeSelection(-12)),
  dot: rhythm((tools) => tools.toggleDotAtCursor()),
  tuplet: (event) => {
    const count = tupletOfKey(event)
    if (count != null)
      afterQueued(() => import('./rhythmCommands').then((tools) => tools.setTupletAtCursor(count)))
    return count != null
  },
  rest: () => (makeRestAtCursor(), true),
  tie: rhythm((tools) => tools.toggleTieAtCursor()),
  insertBeat: rhythm((tools) => tools.insertBeatAtCursor()),
  deleteBeat: rhythm((tools) => tools.deleteBeatAtCursor()),
  voice1: () => (switchTrack(Song.currentTrackId, 0), true),
  voice2: () => (switchTrack(Song.currentTrackId, 1), true),
  trackUp: () => (moveCursorToTrack(-1), true),
  trackDown: () => (moveCursorToTrack(1), true),
}

/** A drum's letter key on a drum track (`DRUM_KEYS`): the hit on or off at the cursor. */
function enterDrumKey(event: KeyboardEvent): boolean {
  if (!hasExplicitNoteSelection()) return false
  const drum = drumOfKey(event.code.replace(/^Key/, ''), drumMapOf(selectionState.cursor.trackId))
  return drum != null && toggleDrumAtCursor(drum)
}

/** Shortcuts that change the song or clipboard wait while a dialog is open. */
const blockedWhileModalOpen = new Set<ShortcutId>([
  'undo',
  'redo',
  'copy',
  'paste',
  'noteMenu',
  'lyrics',
  'cut',
  'pasteAsBars',
  'selectAll',
  'extendLeft',
  'extendRight',
  'transposeUp',
  'transposeDown',
  'octaveUp',
  'octaveDown',
  'dot',
  'tuplet',
  'rest',
  'tie',
  'insertBeat',
  'deleteBeat',
])

export function handleKeyDown(event: KeyboardEvent): void {
  // Something closer to the focus (a popover, a modal field) already took the key.
  if (event.defaultPrevented) return
  if (isKeyboardControlTarget(event.target)) return
  // ←/→ on a toolbar button reached with the keyboard move along the toolbar (Menu.vue).
  if (isToolbarNavigationKey(event)) return

  const shortcut = matchShortcut(event, { drums: isDrumTrack(selectionState.cursor.trackId) })
  if (shortcut == null) return
  const run = shortcut.id.startsWith('drum:') ? enterDrumKey : shortcutHandlers[shortcut.id]
  if (run == null) return
  if ((blockedWhileModalOpen.has(shortcut.id) || shortcut.id.startsWith('drum:')) && anyDialogOpen()) return
  if (shortcut.id === 'playPause' && wantsNativeSpace(event.target)) return

  // A lazy command is still loading: this key runs after it.
  const taken = queued != null ? (afterQueued(() => run(event)), true) : run(event)
  if (taken) {
    event.preventDefault()
    // This listens in the capture phase; stop here so the tab view does not act on the key too.
    event.stopPropagation()
  }
}
