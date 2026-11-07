import type { IconName } from '../../assets/icons/icons'
import { displayKeys, SHORTCUTS, type ShortcutId } from '../../utils/keyboardShortcuts'
import type { NoteLengthCode } from '../../types/tab'
import Settings from '../../stores/settingsState'
import Song from '../../stores/song'
import { editorScopeState } from '../../stores/editorScopeState'
import { noteInputState } from '../../stores/noteInputState'
import { playbackTransportState } from '../../stores/playbackTransportState'
import { toggleDraftsPanel } from '../../stores/draftsPanelState'
import { toggleShortcutsHelp } from '../../stores/shortcutsHelpState'
import type { EditTab } from '../../stores/toolbarUiState'
import { typedEventBus } from '../../utils/typedEventBus'
import { DIALOGS, openDialog, toggleDialog } from '../dialogs/dialogs'
import { applyNoteLengthSelection } from '../menuActionCommands'
import liveInput from '../midi/liveInput'
import playback from '../playback'
import { toggleTheme } from '../theme'
import { undoAvailability, undoHistory } from './editCommands'
import { noteLengthSpecialSelect, tieTargetAtCursor } from './durationModifierCommands'
import { dynamicSelect, noteEffectSelect } from './noteEffectCommands'
import { measureSelect, notationSelect } from './notationCommands'
import { addBlock, removeBlock } from './measureStructureCommands'
import { switchTrack } from './trackLoading'
import { zoomTab } from './zoom'
import { redrawTrack } from './layoutInvalidation'
import { setScoreView, toggleClassicalNotation } from './scoreViewCommands'
import { copyRange, cutRange, pasteAsNewBars, pasteRange } from './clipboard'
import { deleteSelectedNotes, makeRestAtCursor } from './noteEntry'
import { startLyricsEntry } from './lyricsEntry'
import { lyricsEntryState } from '../../stores/lyricsEntryState'
import { selectionState } from '../../stores/selectionState'

/**
 * Every toolbar action in one table: the toolbar (`components/Menu.vue`) and the note menu
 * render from it, so a button shows the same label, icon, tooltip and pressed/disabled state
 * and runs the same command wherever it appears. `id` is the button's element id (e2e tests
 * and older code look buttons up by it) and the id `useToolbarState` reports pressed/disabled
 * song state for.
 */

export type { EditTab }

export const EDIT_TABS: readonly { id: EditTab; label: string; legacyBarId: number }[] = [
  { id: 'note', label: 'Note', legacyBarId: 1 },
  { id: 'effects', label: 'Effects', legacyBarId: 2 },
  { id: 'dynamics', label: 'Dynamics', legacyBarId: 3 },
  { id: 'bar', label: 'Bar', legacyBarId: 4 },
  { id: 'text', label: 'Text', legacyBarId: 5 },
]

export type ToolbarGroupId =
  | 'file'
  | 'history'
  | 'transport'
  | 'view'
  | 'app'
  | 'clipboard'
  | 'beat'
  | 'length'
  | 'dots'
  | 'tuplet'
  | 'tie'
  | 'voice'
  | 'effects-pitch'
  | 'effects-mute'
  | 'effects-technique'
  | 'effects-expression'
  | 'effects-accent'
  | 'dynamics'
  | 'bar'
  | 'text'

export interface ToolbarGroup {
  id: ToolbarGroupId
  label: string
  /** Edit-bar groups belong to a tab; the others sit in the top bar. */
  tab?: EditTab
}

export const TOOLBAR_GROUPS: readonly ToolbarGroup[] = [
  { id: 'file', label: 'File' },
  { id: 'history', label: 'Undo' },
  { id: 'transport', label: 'Playback' },
  { id: 'view', label: 'View' },
  { id: 'app', label: 'Help' },
  { id: 'clipboard', label: 'Clipboard' },
  // Only in the note menu (Beat ▸) and on the keyboard.
  { id: 'beat', label: 'Beat' },
  { id: 'length', label: 'Note length', tab: 'note' },
  { id: 'dots', label: 'Dots', tab: 'note' },
  { id: 'tuplet', label: 'Tuplet', tab: 'note' },
  { id: 'tie', label: 'Tie', tab: 'note' },
  { id: 'voice', label: 'Voice', tab: 'note' },
  { id: 'effects-pitch', label: 'Legato and pitch', tab: 'effects' },
  { id: 'effects-mute', label: 'Muting', tab: 'effects' },
  { id: 'effects-technique', label: 'Tap, slap, pop', tab: 'effects' },
  { id: 'effects-expression', label: 'Expression', tab: 'effects' },
  { id: 'effects-accent', label: 'Accents and strokes', tab: 'effects' },
  { id: 'dynamics', label: 'Dynamics', tab: 'dynamics' },
  { id: 'bar', label: 'Bar', tab: 'bar' },
  { id: 'text', label: 'Text', tab: 'text' },
]

export interface ToolbarAction {
  id: string
  label: string
  group: ToolbarGroupId
  icon?: IconName
  /** Shown instead of an icon (T/S/P, the dynamics glyphs). */
  text?: string
  /** The text is a dynamic marking, drawn in bold italic serif like the tab's dynamics. */
  musicFont?: boolean
  /** Its keyboard shortcut, from `SHORTCUTS`; the tooltip shows it. */
  shortcut?: ShortcutId
  /** Opens a dialog (the label gets "…" in menus). */
  opensDialog?: boolean
  /** State that isn't song state (theme, undo availability…); song state comes from useToolbarState. */
  pressed?: () => boolean
  disabled?: () => boolean
  /** An icon that follows state (Play/Pause, the theme). */
  currentIcon?: () => IconName
  run: () => void
}

const length = (id: string, label: string, icon: IconName, code: NoteLengthCode, shortcut?: ShortcutId) =>
  ({ id, label, icon, group: 'length', shortcut, run: () => applyNoteLengthSelection(code) }) as const

const effect = (
  id: string,
  label: string,
  group: ToolbarGroupId,
  look: { icon?: IconName; text?: string },
  opensDialog = false,
): ToolbarAction => ({ id, label, group, ...look, opensDialog, run: () => noteEffectSelect(id) })

const dynamic = (id: string, label: string, glyph: string): ToolbarAction => ({
  id,
  label,
  group: 'dynamics',
  text: glyph,
  musicFont: true,
  run: () => dynamicSelect(id),
})

const notation = (
  id: string,
  label: string,
  group: ToolbarGroupId,
  icon: IconName,
  opensDialog = true,
): ToolbarAction => ({ id, label, group, icon, opensDialog, run: () => notationSelect(id) })

/** Transposing is in the lazy `editing-tools` chunk. */
const transpose = (semitones: number) =>
  import('./selectionCommands').then((tools) => tools.transposeSelection(semitones))

/** The hidden file input in the toolbar (e2e tests set files on it directly). */
export const SONG_FILE_INPUT_ID = 'songFileInput'
/** The example song list (`ExampleSongsModal.vue`, catalog in `data/exampleSongs.ts`). */

function stepBar(backwards: boolean): void {
  // Only while playing; a stopped song has no playhead to move.
  if (!Settings.songPlaying) return
  if (backwards) playback.stepBackward()
  else playback.stepForward()
}

function toggleRecording(): void {
  if (liveInput.isRecording) {
    playbackTransportState.isRecordingArmed = false
    liveInput.stopRecording()
  } else {
    playbackTransportState.isRecordingArmed = true
    liveInput.recordMidi()
  }
}

export const TOOLBAR_ACTIONS: readonly ToolbarAction[] = [
  // Top bar: file
  {
    id: 'openFile',
    label: 'Open file',
    group: 'file',
    icon: 'open',
    run: () => document.getElementById(SONG_FILE_INPUT_ID)?.click(),
  },
  {
    id: 'exampleSongs',
    label: 'Example songs',
    group: 'file',
    icon: 'songs',
    opensDialog: true,
    run: () => openDialog(DIALOGS.EXAMPLE_SONGS),
  },
  {
    id: 'cloudSongs',
    label: 'Cloud songs',
    group: 'file',
    icon: 'cloud',
    opensDialog: true,
    run: () => openDialog(DIALOGS.CLOUD_SONGS),
  },
  {
    id: 'printTab',
    label: 'Print',
    group: 'file',
    icon: 'print',
    run: () => void import('../pdfExport').then(({ printCurrentTab }) => printCurrentTab()),
  },
  {
    id: 'createPDF',
    label: 'Export PDF',
    group: 'file',
    icon: 'document',
    run: () => void import('../pdfExport').then(({ exportTabAsPdf }) => exportTabAsPdf()),
  },
  {
    id: 'info',
    label: 'Song info',
    group: 'file',
    icon: 'info',
    opensDialog: true,
    run: () => toggleDialog(DIALOGS.INFO),
  },
  {
    id: 'recoverDrafts',
    label: 'Recover drafts',
    group: 'file',
    icon: 'history',
    run: () => toggleDraftsPanel(),
  },
  {
    id: 'about',
    label: 'About, credits and legal',
    group: 'file',
    icon: 'help',
    opensDialog: true,
    run: () => toggleDialog(DIALOGS.COPYRIGHT),
  },
  {
    id: 'undoButton',
    label: 'Undo',
    group: 'history',
    icon: 'undo',
    shortcut: 'undo',
    disabled: () => !undoAvailability.canUndo.value,
    run: () => undoHistory.undo(),
  },
  {
    id: 'redoButton',
    label: 'Redo',
    group: 'history',
    icon: 'redo',
    shortcut: 'redo',
    disabled: () => !undoAvailability.canRedo.value,
    run: () => undoHistory.redo(),
  },

  // Top bar: playback
  {
    id: 'oneMeasureBack',
    label: 'Previous bar',
    group: 'transport',
    icon: 'bar-back',
    disabled: () => !playbackTransportState.isPlaying,
    run: () => stepBar(true),
  },
  {
    id: 'play',
    label: 'Play',
    group: 'transport',
    icon: 'play',
    shortcut: 'playPause',
    currentIcon: () => (playbackTransportState.isPlaying ? 'pause' : 'play'),
    run: () => playback.togglePlayback(),
  },
  {
    id: 'oneMeasureForward',
    label: 'Next bar',
    group: 'transport',
    icon: 'bar-forward',
    disabled: () => !playbackTransportState.isPlaying,
    run: () => stepBar(false),
  },
  { id: 'stopButton', label: 'Stop', group: 'transport', icon: 'stop', run: () => playback.stop() },
  {
    id: 'recordButton',
    label: 'Record from MIDI',
    group: 'transport',
    icon: 'record',
    pressed: () => playbackTransportState.isRecordingActive || playbackTransportState.isRecordingArmed,
    run: toggleRecording,
  },

  // Top bar: view
  {
    id: 'classicalToggleButton',
    label: 'Classical notation',
    group: 'view',
    icon: 'notation',
    pressed: () => Settings.vexFlowIsActive,
    run: () => void toggleClassicalNotation(),
  },
  {
    id: 'scoreViewToggle',
    label: 'Score view',
    group: 'view',
    icon: 'score',
    pressed: () => Settings.scoreView,
    run: () => void setScoreView(!Settings.scoreView),
  },
  {
    id: 'tiedParenthesesToggle',
    label: 'Tied notes in parentheses',
    group: 'view',
    text: '(5)',
    pressed: () => Settings.tiedNotesInParentheses,
    run: () => {
      Settings.tiedNotesInParentheses = !Settings.tiedNotesInParentheses
    },
  },
  {
    id: 'rhythmStemsToggle',
    label: 'Rhythm on stems',
    group: 'view',
    icon: 'rhythm-stems',
    pressed: () => Settings.tabRhythmOnStems,
    run: () => {
      Settings.tabRhythmOnStems = !Settings.tabRhythmOnStems
      redrawTrack(Song.currentTrackId, Song.currentVoiceId)
    },
  },
  {
    id: 'multiRestToggle',
    label: 'Multi-bar rests',
    group: 'view',
    icon: 'multi-rest',
    pressed: () => Settings.multiBarRests,
    run: () => {
      Settings.multiBarRests = !Settings.multiBarRests
      redrawTrack(Song.currentTrackId, Song.currentVoiceId)
    },
  },
  { id: 'zoomOut', label: 'Zoom out', group: 'view', icon: 'zoom-out', run: () => zoomTab(false) },
  { id: 'zoomIn', label: 'Zoom in', group: 'view', icon: 'zoom-in', run: () => zoomTab(true) },
  {
    id: 'chordManagerButton',
    label: 'Chord library',
    group: 'view',
    icon: 'chords',
    opensDialog: true,
    run: () => toggleDialog(DIALOGS.CHORD_MANAGER, { trackId: Song.currentTrackId }),
  },
  {
    id: 'guitarEyeToggle',
    label: 'Virtual guitar',
    group: 'view',
    icon: 'guitar',
    run: () => toggleDialog(DIALOGS.GUITAR),
  },
  {
    id: 'tunerButton',
    label: 'Tuner',
    group: 'view',
    icon: 'tuner',
    opensDialog: true,
    run: () => toggleDialog(DIALOGS.TUNER),
  },
  {
    id: 'pianoEyeToggle',
    label: 'Virtual piano',
    group: 'view',
    icon: 'piano',
    run: () => toggleDialog(DIALOGS.PIANO),
  },
  {
    id: 'fullscreen',
    label: 'Full width',
    group: 'view',
    icon: 'fullscreen',
    run: () => typedEventBus.emit('ui.disablePageMode'),
  },
  {
    id: 'shortcutsHelpButton',
    label: 'Keyboard shortcuts',
    group: 'app',
    icon: 'help',
    shortcut: 'help',
    run: () => toggleShortcutsHelp(),
  },
  {
    id: 'themeToggle',
    label: 'Dark theme',
    group: 'app',
    icon: 'moon',
    pressed: () => Settings.darkMode,
    currentIcon: () => (Settings.darkMode ? 'sun' : 'moon'),
    run: toggleTheme,
  },

  // Only in the note menu (the keyboard has them too)
  { id: 'cutRange', label: 'Cut', group: 'clipboard', shortcut: 'cut', run: cutRange },
  { id: 'copyRange', label: 'Copy', group: 'clipboard', shortcut: 'copy', run: copyRange },
  { id: 'pasteRange', label: 'Paste', group: 'clipboard', shortcut: 'paste', run: pasteRange },
  {
    id: 'pasteAsBars',
    label: 'Paste as new bars',
    group: 'clipboard',
    shortcut: 'pasteAsBars',
    run: pasteAsNewBars,
  },
  {
    id: 'deleteNote',
    label: 'Delete note',
    group: 'clipboard',
    icon: 'trash',
    shortcut: 'deleteNote',
    run: deleteSelectedNotes,
  },

  // Note menu, Beat ▸
  {
    id: 'selectBar',
    label: 'Select bar (again: track)',
    group: 'beat',
    shortcut: 'selectAll',
    run: () => void import('./selectionCommands').then((tools) => tools.selectBarOrTrack()),
  },
  { id: 'makeRest', label: 'Make rest', group: 'beat', shortcut: 'rest', run: () => void makeRestAtCursor() },
  {
    id: 'insertBeat',
    label: 'Insert beat',
    group: 'beat',
    shortcut: 'insertBeat',
    run: () => void import('./rhythmCommands').then((tools) => tools.insertBeatAtCursor()),
  },
  {
    id: 'deleteBeat',
    label: 'Delete beat',
    group: 'beat',
    shortcut: 'deleteBeat',
    run: () => void import('./rhythmCommands').then((tools) => tools.deleteBeatAtCursor()),
  },
  {
    id: 'slashBeat',
    label: 'Slash notation (rhythm only)',
    group: 'beat',
    icon: 'slash-beat',
    run: () => void import('./rhythmCommands').then((tools) => tools.toggleSlashBeats()),
  },
  {
    id: 'transposeUp',
    label: 'Transpose up a semitone',
    group: 'beat',
    shortcut: 'transposeUp',
    run: () => void transpose(1),
  },
  {
    id: 'transposeDown',
    label: 'Transpose down a semitone',
    group: 'beat',
    shortcut: 'transposeDown',
    run: () => void transpose(-1),
  },
  {
    id: 'octaveUp',
    label: 'Transpose up an octave',
    group: 'beat',
    shortcut: 'octaveUp',
    run: () => void transpose(12),
  },
  {
    id: 'octaveDown',
    label: 'Transpose down an octave',
    group: 'beat',
    shortcut: 'octaveDown',
    run: () => void transpose(-12),
  },

  // Edit bar, Note
  length('wholeNote', 'Whole note', 'note-whole', 'w', 'durationWhole'),
  length('halfNote', 'Half note', 'note-half', 'h', 'durationHalf'),
  length('quarterNote', 'Quarter note', 'note-quarter', 'q', 'durationQuarter'),
  length('8thNote', 'Eighth note', 'note-eighth', 'e', 'durationEighth'),
  length('16thNote', '16th note', 'note-16th', 's', 'durationSixteenth'),
  length('32ndNote', '32nd note', 'note-32nd', 't', 'durationThirtySecond'),
  length('64thNote', '64th note', 'note-64th', 'z'),
  {
    id: 'dotted',
    label: 'Dotted',
    group: 'dots',
    icon: 'dotted',
    shortcut: 'dot',
    run: () => noteLengthSpecialSelect('dotted', Number(noteInputState.tuplet), tieTargetAtCursor()),
  },
  {
    id: 'doubleDotted',
    label: 'Double dotted',
    group: 'dots',
    icon: 'double-dotted',
    run: () => noteLengthSpecialSelect('doubleDotted', Number(noteInputState.tuplet), tieTargetAtCursor()),
  },
  {
    id: 'tuplet',
    label: 'Tuplet',
    group: 'tuplet',
    icon: 'tuplet',
    run: () => noteLengthSpecialSelect('tuplet', Number(noteInputState.tuplet), tieTargetAtCursor()),
  },
  {
    id: 'tied',
    label: 'Tie to the previous note',
    group: 'tie',
    icon: 'tie',
    shortcut: 'tie',
    run: () => noteLengthSpecialSelect('tied', Number(noteInputState.tuplet), tieTargetAtCursor()),
  },
  {
    id: 'voice0',
    label: 'Voice 1',
    group: 'voice',
    text: '1',
    shortcut: 'voice1',
    pressed: () => editorScopeState.currentVoiceId === 0,
    run: () => switchTrack(Song.currentTrackId, 0, false, null),
  },
  {
    id: 'voice1',
    label: 'Voice 2',
    group: 'voice',
    text: '2',
    shortcut: 'voice2',
    pressed: () => editorScopeState.currentVoiceId === 1,
    run: () => switchTrack(Song.currentTrackId, 1, false, null),
  },

  // Edit bar, Effects (today's order and groups)
  effect('pullDown', 'Hammer-on / pull-off', 'effects-pitch', { icon: 'hammer-on' }),
  effect('slide', 'Slide', 'effects-pitch', { icon: 'slide' }),
  effect('bend', 'Bend', 'effects-pitch', { icon: 'bend' }, true),
  effect('trill', 'Trill', 'effects-pitch', { icon: 'trill' }),
  effect('tremoloPicking', 'Tremolo picking', 'effects-pitch', { icon: 'tremolo-picking' }, true),
  effect('tremoloBar', 'Tremolo bar', 'effects-pitch', { icon: 'tremolo-bar' }, true),
  effect('dead', 'Dead note', 'effects-pitch', { icon: 'dead-note' }),
  effect('stacatto', 'Staccato', 'effects-mute', { icon: 'staccato' }),
  effect('palmMute', 'Palm mute', 'effects-mute', { icon: 'palm-mute' }),
  effect('tap', 'Tap', 'effects-technique', { text: 'T' }),
  effect('slap', 'Slap', 'effects-technique', { text: 'S' }),
  effect('pop', 'Pop', 'effects-technique', { text: 'P' }),
  effect('fadeIn', 'Fade in', 'effects-expression', { icon: 'fade-in' }),
  effect('vibrato', 'Vibrato', 'effects-expression', { icon: 'vibrato' }),
  effect('grace', 'Grace note', 'effects-expression', { icon: 'grace' }, true),
  effect('artificial', 'Harmonic', 'effects-expression', { icon: 'harmonic' }, true),
  effect('ghost', 'Ghost note', 'effects-accent', { icon: 'ghost-note' }),
  effect('accentuated', 'Accent', 'effects-accent', { icon: 'accent' }),
  effect('heavyAccentuated', 'Heavy accent', 'effects-accent', { icon: 'heavy-accent' }),
  effect('stroke', 'Strum', 'effects-accent', { icon: 'stroke' }, true),
  effect('letRing', 'Let ring', 'effects-accent', { icon: 'let-ring' }),

  // Edit bar, Dynamics (bold italic serif letters, as the tab draws them)
  dynamic('pppDynamic', 'Pianississimo (ppp)', 'ppp'),
  dynamic('ppDynamic', 'Pianissimo (pp)', 'pp'),
  dynamic('pDynamic', 'Piano (p)', 'p'),
  dynamic('mpDynamic', 'Mezzo piano (mp)', 'mp'),
  dynamic('mfDynamic', 'Mezzo forte (mf)', 'mf'),
  dynamic('fDynamic', 'Forte (f)', 'f'),
  dynamic('ffDynamic', 'Fortissimo (ff)', 'ff'),
  dynamic('fffDynamic', 'Fortississimo (fff)', 'fff'),

  // Edit bar, Bar
  notation('timeMeter', 'Time signature', 'bar', 'time-signature'),
  notation('bpmMeter', 'Tempo change', 'bar', 'tempo'),
  {
    id: 'keySignature',
    label: 'Key signature',
    group: 'bar',
    icon: 'key-signature',
    run: () => {
      const { trackId, blockId, voiceId } = selectionState.cursor
      void openDialog(DIALOGS.KEY_SIGNATURE, { trackId, blockId, voiceId })
    },
  },
  {
    id: 'clef',
    label: 'Clef',
    group: 'bar',
    icon: 'clef',
    run: () => {
      const { trackId, blockId, voiceId } = selectionState.cursor
      void openDialog(DIALOGS.CLEF, { trackId, blockId, voiceId })
    },
  },
  { id: 'addMeasure', label: 'Add bar', group: 'bar', icon: 'bar-add', run: () => addBlock() },
  { id: 'removeMeasure', label: 'Remove bar', group: 'bar', icon: 'bar-remove', run: () => removeBlock() },
  {
    id: 'openBar',
    label: 'Repeat start',
    group: 'bar',
    icon: 'repeat-open',
    run: () => measureSelect('openBar'),
  },
  notation('closeBar', 'Repeat end', 'bar', 'repeat-close'),
  notation('repeatAlternative', 'Volta (alternative ending)', 'bar', 'volta'),
  notation('addDirection', 'Segno, Coda, D.S., D.C.', 'bar', 'coda'),

  // Edit bar, Text
  notation('addChord', 'Chord', 'text', 'chord'),
  notation('addText', 'Text', 'text', 'text'),
  notation('addMarker', 'Marker', 'text', 'marker'),
  {
    id: 'addLyrics',
    label: 'Lyrics',
    group: 'text',
    icon: 'lyrics',
    shortcut: 'lyrics',
    pressed: () => lyricsEntryState.active,
    run: () => startLyricsEntry(),
  },
]

const ACTIONS_BY_ID = new Map(TOOLBAR_ACTIONS.map((action) => [action.id, action]))

export function toolbarAction(id: string): ToolbarAction {
  const action = ACTIONS_BY_ID.get(id)
  if (action == null) throw new Error(`Unknown toolbar action "${id}"`)
  return action
}

export function actionsInGroup(group: ToolbarGroupId): ToolbarAction[] {
  return TOOLBAR_ACTIONS.filter((action) => action.group === group)
}

export function groupsOfTab(tab: EditTab): ToolbarGroup[] {
  return TOOLBAR_GROUPS.filter((group) => group.tab === tab)
}

/** "Quarter note (Q)", "Undo (Ctrl+Z)": the label with the first key combination of its shortcut. */
export function actionTooltip(action: ToolbarAction, mac?: boolean): string {
  const keys = SHORTCUTS.find((shortcut) => shortcut.id === action.shortcut)?.keys[0]
  return keys ? `${action.label} (${displayKeys(keys, mac).join('+')})` : action.label
}
