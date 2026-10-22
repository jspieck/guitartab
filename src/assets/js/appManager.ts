import { selectionState } from '../../stores/selectionState';
import { copyRange, pasteRange } from '../../services/editor/clipboard';
import fastdom from 'fastdom';
import { tab, Tab } from './tab';
import { currentLoopInterval, applyRangeAsLoop } from '../../services/editor/rangeSelection';
import { Song } from './songData';
import { modalManager } from './modals/modalManager';
import { typedEventBus } from '../../utils/typedEventBus';
import { notifySongDataChanged } from '../../services/appEvents';
import playBackLogic from './playbackEngine';
import { audioEngine } from './audioEngine';
import { applyNoteLengthSelection } from '../../services/menuActionCommands';
import { editTransaction, undoHistory } from '../../services/editor/editCommands';
import {
  combineFretDigit, isKeyboardControlTarget, matchShortcut, maxFretFor, wantsNativeSpace,
  type FretEntry, type ShortcutId,
} from '../../utils/keyboardShortcuts';
import { toggleShortcutsHelp } from '../../stores/shortcutsHelpState';

const AppManager = {
  loopIntervalChanged: false,
  duringTrackCreation: false,
  
  scrollTabEvent(event: WheelEvent) {
    if (event.ctrlKey === true) {
      event.preventDefault();
      if (event.deltaY < 0) {
        tab.scaleCompleteTab(false);
      } else {
        tab.scaleCompleteTab(true);
      }
    }
  },

  /** Last fret typed, so a quick second digit on the same note makes 10 and up. */
  lastFretEntry: null as FretEntry | null,

  hasExplicitNoteSelection() {
    const {
      trackId, blockId, voiceId, beatId, string,
    } = selectionState.cursor;
    return selectionState.hasExplicitSelection
      && trackId >= 0 && blockId >= 0 && voiceId >= 0 && beatId >= 0 && string >= 0
      && Song.findBeat({ trackId, blockId, voiceId, beatId }) != null;
  },

  enterFretDigit(digit: number): boolean {
    if (!this.hasExplicitNoteSelection()) return false;
    const {
      trackId, blockId, voiceId, beatId, string,
    } = selectionState.cursor;
    const position = `${trackId}:${blockId}:${voiceId}:${beatId}:${string}`;
    const now = Date.now();
    const maxFret = maxFretFor(Song.playBackInstrument[trackId]?.instrument);
    const fret = combineFretDigit(this.lastFretEntry, digit, position, now, maxFret);
    this.lastFretEntry = { position, fret, at: now };
    fastdom.mutate(() => {
      this.placeNote(trackId, blockId, voiceId, beatId, string, fret);
    });
    return true;
  },

  deleteSelectedNotes() {
    const {
      trackId, blockId, voiceId, beatId, string,
    } = selectionState.cursor;
    const loopI = currentLoopInterval();
    if (loopI == null || loopI.trackId !== Song.currentTrackId) {
      if (Song.findBeat({ trackId, blockId, voiceId, beatId }) == null) return;
      Tab.deleteNote(trackId, blockId, voiceId, beatId, string);
      typedEventBus.emit('render.block', { trackId, blockId, voiceId });
      typedEventBus.emit('render.durations', { trackId, blockId, voiceId });
    } else {
      const blocks: number[] = [];
      editTransaction('Delete notes', () => {
      for (let blockIdIt = loopI.startBlock; blockIdIt <= loopI.endBlock; blockIdIt += 1) {
        const startIndex = (blockIdIt !== loopI.startBlock) ? 0 : loopI.startBeat;
        const endIndex = (blockIdIt !== loopI.endBlock)
          ? Song.measures[trackId][blockIdIt][voiceId].length - 1
          : loopI.endBeat;
        for (let beatIdIt = startIndex; beatIdIt <= endIndex; beatIdIt += 1) {
          const { notes } = Song.getBeat({ trackId, blockId: blockIdIt, voiceId, beatId: beatIdIt });
          if (notes != null) {
            for (let stringIt = 0, n = notes.length; stringIt < n; stringIt += 1) {
              if (notes[stringIt] != null) {
                Tab.deleteNote(trackId, blockIdIt, voiceId, beatIdIt, stringIt);
              }
            }
          }
        }
        blocks.push(blockIdIt);
        typedEventBus.emit('render.durations', { trackId, blockId: blockIdIt, voiceId });
      }
      });
      typedEventBus.emit('render.blocks', { trackId, blockIds: blocks, voiceId });
    }
    notifySongDataChanged();
  },

  moveSelection(direction: 'left' | 'right' | 'up' | 'down') {

    const { trackId, voiceId } = selectionState.cursor;
    let { blockId, beatId, string } = selectionState.cursor;
    const voiceBeats = (block: number) => Song.measures[trackId][block][voiceId].length;

    if (direction === 'left') {
      if (beatId > 0) {
        beatId -= 1;
      } else if (blockId > 0) {
        blockId -= 1;
        beatId = voiceBeats(blockId) - 1;
      }
    } else if (direction === 'right') {
      if (beatId + 1 < voiceBeats(blockId)) {
        beatId += 1;
      } else if (blockId + 1 < Song.measures[trackId].length) {
        blockId += 1;
        beatId = 0;
      }
    } else if (direction === 'down') {
      // String 0 is the lowest string, drawn on the bottom line.
      if (string > 0) string -= 1;
    } else if (string + 1 < Song.tracks[trackId].numStrings) {
      string += 1;
    }
    typedEventBus.emit('navigation.setClickedPos', {
      trackId, blockId, voiceId, beatId, string,
    });
  },

  /** Shortcuts that change the song or clipboard wait while a dialog is open. */
  blockedWhileModalOpen: new Set<ShortcutId>(['undo', 'redo', 'copy', 'paste']),

  keyDownEvent(e: KeyboardEvent) {
    // Something closer to the focus (a popover, a modal field) already took the key.
    if (e.defaultPrevented || this.duringTrackCreation) return;
    if (isKeyboardControlTarget(e.target)) return;

    const shortcut = matchShortcut(e);
    if (shortcut == null) return;
    const run = shortcutHandlers[shortcut.id];
    if (run == null) return;
    if (this.blockedWhileModalOpen.has(shortcut.id) && modalManager.isAnyModalOpen()) return;
    if (shortcut.id === 'playPause' && wantsNativeSpace(e.target)) return;

    if (run(e)) {
      e.preventDefault();
      // This listens in the capture phase; stop here so the tab view does not act on the key too.
      e.stopPropagation();
    }
  },

  clickEnding() {
    if (this.loopIntervalChanged) {
      applyRangeAsLoop();
      this.loopIntervalChanged = false;
    }
  },

  placeNote(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, fretNumber: number,
  ) {
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId });
    const note = beat.notes[string];
    // Also turns a rest into a note; records the undo step.
    tab.drawNote(trackId, blockId, voiceId, beatId, string, fretNumber);
    notifySongDataChanged();
    // Playback Note
    const volume = 0.5;
    const noteStart = audioEngine.getCurrentTime();
    const duration = 0.5;
    const instr = Song.playBackInstrument[trackId].instrument;
    audioEngine.playSF2(
      trackId, voiceId, string, fretNumber, volume, noteStart,
      duration, beat, note, instr, fretNumber,
    );
  },
};

/** What each shortcut in `SHORTCUTS` does. Returns false when it does not apply right now. */
const shortcutHandlers: Partial<Record<ShortcutId, (event: KeyboardEvent) => boolean>> = {
  fret: (event: KeyboardEvent) => AppManager.enterFretDigit(Number(event.key)),
  deleteNote: () => {
    fastdom.mutate(() => AppManager.deleteSelectedNotes());
    return true;
  },
  moveLeft: () => { AppManager.moveSelection('left'); return true; },
  moveRight: () => { AppManager.moveSelection('right'); return true; },
  stringUp: () => { AppManager.moveSelection('up'); return true; },
  stringDown: () => { AppManager.moveSelection('down'); return true; },
  durationWhole: () => { applyNoteLengthSelection('w'); return true; },
  durationHalf: () => { applyNoteLengthSelection('h'); return true; },
  durationQuarter: () => { applyNoteLengthSelection('q'); return true; },
  durationEighth: () => { applyNoteLengthSelection('e'); return true; },
  durationSixteenth: () => { applyNoteLengthSelection('s'); return true; },
  durationThirtySecond: () => { applyNoteLengthSelection('t'); return true; },
  playPause: (event: KeyboardEvent) => {
    if (!event.repeat) playBackLogic.playSongB();
    return true;
  },
  undo: () => { undoHistory.undo(); return true; },
  redo: () => { undoHistory.redo(); return true; },
  copy: () => { copyRange(); return true; },
  paste: () => { pasteRange(); return true; },
  help: () => { toggleShortcutsHelp(); return true; },
};

export default AppManager;
