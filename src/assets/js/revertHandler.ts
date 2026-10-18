import {
  Beat, MeasureMetaInfo, Track, Bend, TremoloBar, Chord, Marker, Stroke,
  Note, BeatEffects, VoiceSnapshot, Grace,
} from './songData';
import type { MenuEffectState } from '../../services/menuEffectMutations';
import AppManager from './appManager';
import { RevertStack } from '../../services/editor/revertStack';
import { notifySongDataChanged } from '../../services/appEvents';
import {
  revertNotePlacement,
  restoreNotePlacement,
  revertNoteLength,
  restoreNoteLength,
  revertCopyPaste,
  restoreCopyPaste,
  revertDeleteNote,
  restoreDeleteNote,
  revertTied,
  restoreTied,
  setSpecialSelect,
  revertZoom,
  restoreZoom,
  revertNoteEffectSelect,
  restoreNoteEffectSelect,
  revertNotationSelect,
  restoreNotationSelect,
  revertDynamicSelect,
  restoreDynamicSelect,
  toggleMeasureSelect,
  revertText,
  restoreText,
  revertMarker,
  restoreMarker,
  revertChord,
  restoreChord,
  revertRepeatAlternative,
  restoreRepeatAlternative,
  revertRepeatClose,
  restoreRepeatClose,
  revertStroke,
  restoreStroke,
  revertArtificial,
  restoreArtificial,
  revertGrace,
  restoreGrace,
  revertTremoloBar,
  restoreTremoloBar,
  revertTremoloPicking,
  restoreTremoloPicking,
  revertBend,
  restoreBend,
  revertTimeMeter,
  restoreTimeMeter,
  revertBpmMeter,
  restoreBpmMeter,
  revertInstrumentSetting,
  restoreInstrumentSetting,
  revertAddBlock,
  restoreAddBlock,
  revertRemoveBlock,
  restoreRemoveBlock,
} from '../../services/editor/revertCommandHandlers'

class RevertHandler {
  private stack: RevertStack;

  constructor() {
    this.stack = new RevertStack(200);
  }

  addToState(type: string, infoObj: unknown) {
    this.stack.push(type, infoObj);
  }

  canUndo(): boolean {
    return this.stack.canUndo;
  }

  canRedo(): boolean {
    return this.stack.canRedo;
  }

  /** The entry the next undo would revert, to check that it is still a given edit. */
  peekUndo(): { type: string; info: unknown } | null {
    return this.stack.peek() ?? null;
  }

  clearHistory(): void {
    this.stack.clear();
  }

  /** @deprecated Use RevertStack via stack; kept for tests and direct callers. */
  get revertStack(): Array<{ type: string; info: unknown }> {
    return this.stack.getMutableEntries();
  }

  set revertStack(entries: Array<{ type: string; info: unknown }>) {
    this.stack.clear();
    entries.forEach((entry) => this.stack.push(entry.type, entry.info));
  }

  /** @deprecated Use stack.currentIndex; kept for tests and direct callers. */
  get revertStackIndex(): number {
    return this.stack.currentIndex;
  }

  set revertStackIndex(index: number) {
    const delta = index - this.stack.currentIndex;
    if (delta !== 0) {
      this.stack.adjustIndex(delta);
    }
  }

  addTied(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteTiedTo: { blockId: number, beatId: number },
  ) {
    this.addToState('Tied', {
      trackId, blockId, voiceId, beatId, string, noteTiedTo,
    });
  }

  addCopyPaste(
    trackId: number, voiceId: number,
    blocksBefore: {blockId: number, block: Beat[][]}[],
    blocksAfter: {blockId: number, block: Beat[][]}[],
  ) {
    this.addToState('CopyPaste', {
      trackId, voiceId, blocksBefore, blocksAfter,
    });
  }

  addNoteLengthChange(
    trackId: number, blockId: number, voiceId: number, measureBefore: Beat,
    measureAfter: Beat,
  ) {
    this.addToState('NoteLength', {
      trackId, blockId, voiceId, measureBefore, measureAfter,
    });
  }

  deleteNote(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteObj: Note, effectObj: BeatEffects,
  ) {
    this.addToState('DeleteNote', {
      trackId, blockId, voiceId, beatId, string, noteObj, effectObj,
    });
  }

  addFretNumber(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, previousFret: number, newFret: number,
  ) {
    this.addToState('NotePlacement', {
      trackId,
      blockId,
      voiceId,
      beatId,
      string,
      previousFret,
      newFret,
    });
  }

  addNoteLengthSpecialSelect(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, tupleSel: number, id: string,
  ) {
    this.addToState('SpecialSelect', {
      trackId, blockId, voiceId, beatId, string, tupleSel, id,
    });
  }

  addNoteEffectSelect(
    arr: {
      notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
        string: number, note: Note}[],
      blocks: number[],
      beats: {trackId: number, blockId: number, voiceId: number, beatId: number, beat: Beat}[]
    },
    id: string,
    changes: {[key: string]: {[s: string]: MenuEffectState}},
  ) {
    this.addToState('NoteSelect', { arr, id, changes });
  }

  addNotationSelect(
    trackId: number, blockId: number, voiceId: number, beatId: number, id: string,
    stateBefore: Record<string, MenuEffectState>, stateAfter: Record<string, MenuEffectState>,
  ) {
    this.addToState('NotationSelect', {
      trackId, blockId, voiceId, beatId, id, stateBefore, stateAfter,
    });
  }

  addZoom(up: boolean) {
    this.addToState('Zoom', { up });
  }

  addDynamic(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, id: string,
  ) {
    this.addToState('Dynamic', {
      trackId, blockId, voiceId, beatId, string, id,
    });
  }

  addMeasureSelect(trackId: number, blockId: number, voiceId: number, id: string) {
    this.addToState('MeasureSelect', {
      trackId, blockId, voiceId, id,
    });
  }

  addText(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    previousText: string | undefined, nextText: string | undefined,
  ) {
    this.addToState('Text', {
      trackId,
      blockId,
      voiceId,
      beatId,
      previousText,
      nextText,
    });
  }

  addMarker(
    trackId: number, blockId: number, markerBefore: Marker | undefined, markerAfter: Marker | undefined,
  ) {
    this.addToState('Marker', {
      trackId,
      blockId,
      markerBefore,
      markerAfter,
    });
  }

  addChord(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    chordBefore: Chord | undefined, chordAfter: Chord | undefined,
  ) {
    this.addToState('Chord', {
      trackId,
      blockId,
      voiceId,
      beatId,
      chordBefore,
      chordAfter,
    });
  }

  addRepeatAlternative(
    trackId: number, blockId: number,
    repeatAlternativeBefore: number | undefined, repeatAlternativeAfter: number | undefined,
  ) {
    // (Stored as repeatAltBefore/After before, which the undo handlers never read.)
    this.addToState('RepeatAlternative', {
      trackId,
      blockId,
      repeatAlternativeBefore,
      repeatAlternativeAfter,
    });
  }

  addRepeatClose(
    trackId: number, blockId: number, repeatCloseBefore: number | undefined,
    repeatCloseAfter: number | undefined,
  ) {
    this.addToState('RepeatClose', {
      trackId,
      blockId,
      repeatCloseBefore,
      repeatCloseAfter,
    });
  }

  addTimeMeter(
    trackId: number, blockId: number, voiceId: number, numeratorBefore: number,
    numeratorAfter: number, denominatorBefore: number, denominatorAfter: number,
    timeMeterPresentBefore: boolean, timeMeterPresentAfter: boolean,
    notesBefore: VoiceSnapshot[][][],
  ) {
    this.addToState('TimeMeter', {
      trackId,
      blockId,
      voiceId,
      numeratorBefore,
      numeratorAfter,
      denominatorBefore,
      denominatorAfter,
      timeMeterPresentBefore,
      timeMeterPresentAfter,
      notesBefore,
    });
  }

  addBpmMeter(trackId: number, blockId: number, voiceId: number,
    bpmBefore: number | undefined, bpmAfter: number | undefined) {
    this.addToState('BpmMeter', {
      trackId,
      blockId,
      voiceId,
      bpmBefore,
      bpmAfter,
    });
  }

  // Effects
  addStroke(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    strokeBefore: Stroke | undefined, strokeAfter: Stroke | undefined,
  ) {
    this.addToState('Stroke', {
      trackId,
      blockId,
      voiceId,
      beatId,
      strokeBefore,
      strokeAfter,
    });
  }

  addArtificial(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    artificialBefore: string | undefined, artificialAfter: string | undefined,
  ) {
    this.addToState('Artificial', {
      trackId,
      blockId,
      voiceId,
      beatId,
      string,
      artificialBefore,
      artificialAfter,
    });
  }

  addGrace(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    graceBefore: Grace | undefined, graceAfter: Grace | undefined,
  ) {
    this.addToState('Grace', {
      trackId,
      blockId,
      voiceId,
      beatId,
      string,
      graceBefore,
      graceAfter,
    });
  }

  addTremoloBar(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    tremoloBarBefore: TremoloBar | undefined, tremoloBarAfter: TremoloBar | undefined,
    effectsBefore: {string: number, effects: {[s: string]: MenuEffectState}}[],
  ) {
    this.addToState('TremoloBar', {
      trackId,
      blockId,
      voiceId,
      beatId,
      tremoloBarBefore,
      tremoloBarAfter,
      effectsBefore,
    });
  }

  addTremoloPicking(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    tremoloPickingBefore: string, tremoloPickingAfter: string, tremoloPickingPresentBefore: boolean,
    tremoloPickingPresentAfter: boolean, effectsBefore: {[m: string]: MenuEffectState},
  ) {
    this.addToState('TremoloPicking', {
      trackId,
      blockId,
      voiceId,
      beatId,
      string,
      tremoloPickingBefore,
      tremoloPickingAfter,
      tremoloPickingPresentBefore,
      tremoloPickingPresentAfter,
      effectsBefore,
    });
  }

  addBend(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    bendBefore: Bend | undefined, bendAfter: Bend | undefined,
    effectsBefore: {[m: string]: MenuEffectState},
  ) {
    this.addToState('Bend', {
      trackId,
      blockId,
      voiceId,
      beatId,
      string,
      bendBefore,
      bendAfter,
      effectsBefore,
    });
  }

  addInstrumentSettings(trackId: number, trackBefore: Track, trackAfter: Track) {
    this.addToState('InstrumentSetting', { trackId, trackBefore, trackAfter });
  }

  addBlock() {
    this.addToState('AddBlock', {});
  }

  removeBlock(blocksBefore: Beat[][][], measureMetaBefore: MeasureMetaInfo) {
    this.addToState('RemoveBlock', { blocksBefore, measureMetaBefore });
  }

  // Called when a track is deleted, so the stack is repaired
  adaptStackToTrackRemove(trackId: number) {
    const entries = this.stack.getMutableEntries();
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const trackIdOfReversion = (entries[i].info as { trackId?: number }).trackId;
      if (trackIdOfReversion != null) {
        if (trackIdOfReversion === trackId) {
          entries.splice(i, 1);
          if (this.stack.currentIndex >= i) {
            this.stack.adjustIndex(-1);
          }
        } else if (trackIdOfReversion > trackId) {
          (entries[i].info as { trackId: number }).trackId -= 1;
        }
      }
    }
  }

  revertState() {
    if (AppManager.duringTrackCreation) return;
    const revertObj = this.stack.peek();
    if (revertObj) {
      const info = revertObj.info;

      switch (revertObj.type) {
        case 'NotePlacement':
          revertNotePlacement(info as Parameters<typeof revertNotePlacement>[0]);
          break;
        case 'NoteLength':
          revertNoteLength(info as Parameters<typeof revertNoteLength>[0]);
          break;
        case 'CopyPaste':
          revertCopyPaste(info as Parameters<typeof revertCopyPaste>[0]);
          break;
        case 'DeleteNote':
          revertDeleteNote(info as Parameters<typeof revertDeleteNote>[0]);
          break;
        case 'Tied':
          revertTied(info as Parameters<typeof revertTied>[0]);
          break;
        case 'SpecialSelect':
          setSpecialSelect(info as Parameters<typeof setSpecialSelect>[0]);
          break;
        case 'Zoom':
          revertZoom(info as Parameters<typeof revertZoom>[0]);
          break;
        case 'NoteSelect':
          revertNoteEffectSelect(info as Parameters<typeof revertNoteEffectSelect>[0]);
          break;
        case 'NotationSelect':
          revertNotationSelect(info as Parameters<typeof revertNotationSelect>[0]);
          break;
        case 'Dynamic':
          revertDynamicSelect(info as Parameters<typeof revertDynamicSelect>[0]);
          break;
        case 'MeasureSelect':
          toggleMeasureSelect(info as Parameters<typeof toggleMeasureSelect>[0]);
          break;
        case 'Text':
          revertText(info as Parameters<typeof revertText>[0]);
          break;
        case 'Marker':
          revertMarker(info as Parameters<typeof revertMarker>[0]);
          break;
        case 'Chord':
          revertChord(info as Parameters<typeof revertChord>[0]);
          break;
        case 'RepeatAlternative':
          revertRepeatAlternative(info as Parameters<typeof revertRepeatAlternative>[0]);
          break;
        case 'RepeatClose':
          revertRepeatClose(info as Parameters<typeof revertRepeatClose>[0]);
          break;
        case 'Stroke':
          revertStroke(info as Parameters<typeof revertStroke>[0]);
          break;
        case 'Artificial':
          revertArtificial(info as Parameters<typeof revertArtificial>[0]);
          break;
        case 'Grace':
          revertGrace(info as Parameters<typeof revertGrace>[0]);
          break;
        case 'TremoloBar':
          revertTremoloBar(info as Parameters<typeof revertTremoloBar>[0]);
          break;
        case 'TremoloPicking':
          revertTremoloPicking(info as Parameters<typeof revertTremoloPicking>[0]);
          break;
        case 'Bend':
          revertBend(info as Parameters<typeof revertBend>[0]);
          break;
        case 'TimeMeter':
          revertTimeMeter(info as Parameters<typeof revertTimeMeter>[0]);
          break;
        case 'BpmMeter':
          revertBpmMeter(info as Parameters<typeof revertBpmMeter>[0]);
          break;
        case 'InstrumentSetting':
          revertInstrumentSetting(info as Parameters<typeof revertInstrumentSetting>[0]);
          break;
        case 'AddBlock':
          revertAddBlock();
          break;
        case 'RemoveBlock':
          revertRemoveBlock(info as Parameters<typeof revertRemoveBlock>[0]);
          break;
        default:
      }
      this.stack.stepBack();
      notifySongDataChanged();
    }
  }

  restoreState() {
    if (AppManager.duringTrackCreation) {
      return;
    }
    const revertObj = this.stack.stepForward();
    if (revertObj) {
      const info = revertObj.info;
      switch (revertObj.type) {
        case 'NotePlacement':
          restoreNotePlacement(info as Parameters<typeof restoreNotePlacement>[0]);
          break;
        case 'NoteLength':
          restoreNoteLength(info as Parameters<typeof restoreNoteLength>[0]);
          break;
        case 'CopyPaste':
          restoreCopyPaste(info as Parameters<typeof restoreCopyPaste>[0]);
          break;
        case 'DeleteNote':
          restoreDeleteNote(info as Parameters<typeof restoreDeleteNote>[0]);
          break;
        case 'Tied':
          restoreTied(info as Parameters<typeof restoreTied>[0]);
          break;
        case 'SpecialSelect':
          setSpecialSelect(info as Parameters<typeof setSpecialSelect>[0]);
          break;
        case 'Zoom':
          restoreZoom(info as Parameters<typeof restoreZoom>[0]);
          break;
        case 'NoteSelect':
          restoreNoteEffectSelect(info as Parameters<typeof restoreNoteEffectSelect>[0]);
          break;
        case 'NotationSelect':
          restoreNotationSelect(info as Parameters<typeof restoreNotationSelect>[0]);
          break;
        case 'Dynamic':
          restoreDynamicSelect(info as Parameters<typeof restoreDynamicSelect>[0]);
          break;
        case 'MeasureSelect':
          toggleMeasureSelect(info as Parameters<typeof toggleMeasureSelect>[0]);
          break;
        case 'Text':
          restoreText(info as Parameters<typeof restoreText>[0]);
          break;
        case 'Marker':
          restoreMarker(info as Parameters<typeof restoreMarker>[0]);
          break;
        case 'Chord':
          restoreChord(info as Parameters<typeof restoreChord>[0]);
          break;
        case 'RepeatAlternative':
          restoreRepeatAlternative(info as Parameters<typeof restoreRepeatAlternative>[0]);
          break;
        case 'RepeatClose':
          restoreRepeatClose(info as Parameters<typeof restoreRepeatClose>[0]);
          break;
        case 'Stroke':
          restoreStroke(info as Parameters<typeof restoreStroke>[0]);
          break;
        case 'Artificial':
          restoreArtificial(info as Parameters<typeof restoreArtificial>[0]);
          break;
        case 'Grace':
          restoreGrace(info as Parameters<typeof restoreGrace>[0]);
          break;
        case 'TremoloBar':
          restoreTremoloBar(info as Parameters<typeof restoreTremoloBar>[0]);
          break;
        case 'TremoloPicking':
          restoreTremoloPicking(info as Parameters<typeof restoreTremoloPicking>[0]);
          break;
        case 'Bend':
          restoreBend(info as Parameters<typeof restoreBend>[0]);
          break;
        case 'TimeMeter':
          restoreTimeMeter(info as Parameters<typeof restoreTimeMeter>[0]);
          break;
        case 'BpmMeter':
          restoreBpmMeter(info as Parameters<typeof restoreBpmMeter>[0]);
          break;
        case 'InstrumentSetting':
          restoreInstrumentSetting(info as Parameters<typeof restoreInstrumentSetting>[0]);
          break;
        case 'AddBlock':
          restoreAddBlock();
          break;
        case 'RemoveBlock':
          restoreRemoveBlock();
          break;
        default:
      }
      notifySongDataChanged();
    }
  }
}

const revertHandler = new RevertHandler();

export { revertHandler, RevertHandler };
export default RevertHandler;
