import Song, {
  Measure, MeasureMetaInfo, Track, Bend, TremoloBar, Chord, Marker, Stroke,
  Grace, Note, MeasureEffects,
} from './songData';
import EventBus from './eventBus';
import { tab, Tab } from './tab';
import AppManager from './appManager';
import { sequencerHandler, SequencerHandler } from './sequencerHandler';
import { menuHandler } from './menuHandler';
import { processEffectSelect, setEffectVariable, handleEffectGroupCollisionBeat, handleEffectGroupCollision } from './menuHelper';
import { requestBlockRender, requestDurationRender } from '../../services/editor/renderCommands';
import { RevertStack } from '../../services/editor/revertStack';

function requestCurrentVoiceBlockRender(trackId: number, blockId: number) {
  requestBlockRender(trackId, blockId, Song.currentVoiceId);
}

class RevertHandler {
  private stack: RevertStack;

  constructor() {
    this.stack = new RevertStack(20);
  }

  addToState(type: string, infoObj: any) {
    this.stack.push(type, infoObj);
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
    blocksBefore: {blockId: number, block: Measure[][]}[],
    blocksAfter: {blockId: number, block: Measure[][]}[],
  ) {
    this.addToState('CopyPaste', {
      trackId, voiceId, blocksBefore, blocksAfter,
    });
  }

  addNoteLengthChange(
    trackId: number, blockId: number, voiceId: number, measureBefore: Measure,
    measureAfter: Measure,
  ) {
    this.addToState('NoteLength', {
      trackId, blockId, voiceId, measureBefore, measureAfter,
    });
  }

  deleteNote(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteObj: Note, effectObj: MeasureEffects,
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
      beats: {trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure}[]
    },
    id: string,
    changes: {[key: string]: {[s: string]: boolean}},
  ) {
    this.addToState('NoteSelect', { arr, id, changes });
  }

  addNotationSelect(
    trackId: number, blockId: number, voiceId: number, beatId: number, id: string,
  ) {
    this.addToState('NotationSelect', {
      trackId, blockId, voiceId, beatId, id,
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
    previousText: string, nextText: string,
    textPresentBefore: boolean, textPresentAfter: boolean,
  ) {
    this.addToState('Text', {
      trackId,
      blockId,
      voiceId,
      beatId,
      previousText,
      nextText,
      textPresentBefore,
      textPresentAfter,
    });
  }

  addMarker(
    trackId: number, blockId: number, markerBefore: Marker, markerAfter: Marker,
    markerPresentBefore: boolean, markerPresentAfter: boolean,
  ) {
    this.addToState('Marker', {
      trackId,
      blockId,
      markerBefore,
      markerAfter,
      markerPresentBefore,
      markerPresentAfter,
    });
  }

  addChord(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    chordBefore: Chord, chordAfter: Chord,
    chordPresentBefore: boolean, chordPresentAfter: boolean,
  ) {
    this.addToState('Chord', {
      trackId,
      blockId,
      voiceId,
      beatId,
      chordBefore,
      chordAfter,
      chordPresentBefore,
      chordPresentAfter,
    });
  }

  addRepeatAlternative(
    trackId: number, blockId: number, repeatAltBefore: number, repeatAltAfter: number,
    repeatAltPresentBefore: boolean, repeatAltPresentAfter: boolean,
  ) {
    this.addToState('RepeatAlternative', {
      trackId,
      blockId,
      repeatAltBefore,
      repeatAltAfter,
      repeatAltPresentBefore,
      repeatAltPresentAfter,
    });
  }

  addRepeatClose(
    trackId: number, blockId: number, repeatCloseBefore: number,
    repeatCloseAfter: number, repeatClosePresentBefore: boolean,
    repeatClosePresentAfter: boolean,
  ) {
    this.addToState('RepeatClose', {
      trackId,
      blockId,
      repeatCloseBefore,
      repeatCloseAfter,
      repeatClosePresentBefore,
      repeatClosePresentAfter,
    });
  }

  addTimeMeter(
    trackId: number, blockId: number, voiceId: number, numeratorBefore: number,
    numeratorAfter: number, denominatorBefore: number, denominatorAfter: number,
    timeMeterPresentBefore: boolean, timeMeterPresentAfter: boolean,
    notesBefore: { blockId: number, notes: {beatId: number, note: Note[]}[] }[][][],
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

  addBpmMeter(trackId: number, blockId: number, voiceId: number, bpmPresentBefore: boolean,
    bpmPresentAfter: boolean, bpmBefore: number, bpmAfter: number) {
    this.addToState('BpmMeter', {
      trackId,
      blockId,
      voiceId,
      bpmPresentBefore,
      bpmPresentAfter,
      bpmBefore,
      bpmAfter,
    });
  }

  // Effects
  addStroke(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    strokeBefore: Stroke, strokeAfter: Stroke, strokePresentBefore: boolean,
    strokePresentAfter: boolean,
  ) {
    this.addToState('Stroke', {
      trackId,
      blockId,
      voiceId,
      beatId,
      strokeBefore,
      strokeAfter,
      strokePresentBefore,
      strokePresentAfter,
    });
  }

  addArtificial(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    artificialBefore: string, artificialAfter: string, artificialPresentBefore: boolean,
    artificialPresentAfter: boolean,
  ) {
    this.addToState('Artificial', {
      trackId,
      blockId,
      voiceId,
      beatId,
      string,
      artificialBefore,
      artificialAfter,
      artificialPresentBefore,
      artificialPresentAfter,
    });
  }

  addGrace(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    graceBefore: { duration: string, fret: number }, graceAfter: { duration: string, fret: number },
    gracePresentBefore: boolean, gracePresentAfter: boolean,
  ) {
    this.addToState('Grace', {
      trackId,
      blockId,
      voiceId,
      beatId,
      string,
      graceBefore,
      graceAfter,
      gracePresentBefore,
      gracePresentAfter,
    });
  }

  addTremoloBar(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    tremoloBarBefore: TremoloBar, tremoloBarAfter: TremoloBar, tremoloBarPresentBefore: boolean,
    tremoloBarPresentAfter: boolean,
    effectsBefore: {string: number, effects: {[s: string]: boolean}}[],
  ) {
    this.addToState('TremoloBar', {
      trackId,
      blockId,
      voiceId,
      beatId,
      tremoloBarBefore,
      tremoloBarAfter,
      tremoloBarPresentBefore,
      tremoloBarPresentAfter,
      effectsBefore,
    });
  }

  addTremoloPicking(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    tremoloPickingBefore: string, tremoloPickingAfter: string, tremoloPickingPresentBefore: boolean,
    tremoloPickingPresentAfter: boolean, effectsBefore: {[m: string]: boolean},
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
    bendBefore: Bend, bendAfter: Bend, bendPresentBefore: boolean,
    bendPresentAfter: boolean, effectsBefore: {[m: string]: boolean},
  ) {
    this.addToState('Bend', {
      trackId,
      blockId,
      voiceId,
      beatId,
      string,
      bendBefore,
      bendAfter,
      bendPresentBefore,
      bendPresentAfter,
      effectsBefore,
    });
  }

  addInstrumentSettings(trackId: number, trackBefore: Track, trackAfter: Track) {
    this.addToState('InstrumentSetting', { trackId, trackBefore, trackAfter });
  }

  addBlock() {
    this.addToState('AddBlock', {});
  }

  removeBlock(blocksBefore: Measure[][][], measureMetaBefore: MeasureMetaInfo) {
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
    console.log(this.stack.currentIndex);
    if (AppManager.duringTrackCreation) return;
    const revertObj = this.stack.peek();
    if (revertObj) {
      const info = revertObj.info as any;

      switch (revertObj.type) {
        case 'NotePlacement':
          RevertHandler.revertNotePlacement(info);
          break;
        case 'NoteLength':
          RevertHandler.revertNoteLength(info);
          break;
        case 'CopyPaste':
          RevertHandler.revertCopyPaste(info);
          break;
        case 'DeleteNote':
          RevertHandler.revertDeleteNote(info);
          break;
        case 'Tied':
          RevertHandler.revertTied(info);
          break;
        case 'SpecialSelect':
          RevertHandler.setSpecialSelect(info);
          break;
        case 'Zoom':
          RevertHandler.revertZoom(info);
          break;
        case 'NoteSelect':
          RevertHandler.revertNoteEffectSelect(info);
          break;
        case 'NotationSelect':
          RevertHandler.revertNotationSelect(info);
          break;
        case 'Dynamic':
          RevertHandler.revertDynamicSelect(info);
          break;
        case 'MeasureSelect':
          RevertHandler.toggleMeasureSelect(info);
          break;
        case 'Text':
          RevertHandler.revertText(info);
          break;
        case 'Marker':
          RevertHandler.revertMarker(info);
          break;
        case 'Chord':
          RevertHandler.revertChord(info);
          break;
        case 'RepeatAlternative':
          RevertHandler.revertRepeatAlternative(info);
          break;
        case 'RepeatClose':
          RevertHandler.revertRepeatClose(info);
          break;
        case 'Stroke':
          RevertHandler.revertStroke(info);
          break;
        case 'Artificial':
          RevertHandler.revertArtificial(info);
          break;
        case 'Grace':
          RevertHandler.revertGrace(info);
          break;
        case 'TremoloBar':
          RevertHandler.revertTremoloBar(info);
          break;
        case 'TremoloPicking':
          RevertHandler.revertTremoloPicking(info);
          break;
        case 'Bend':
          RevertHandler.revertBend(info);
          break;
        case 'TimeMeter':
          RevertHandler.revertTimeMeter(info);
          break;
        case 'BpmMeter':
          RevertHandler.revertBpmMeter(info);
          break;
        case 'InstrumentSetting':
          RevertHandler.revertInstrumentSetting(info);
          break;
        case 'AddBlock':
          RevertHandler.revertAddBlock();
          break;
        case 'RemoveBlock':
          RevertHandler.revertRemoveBlock(info);
          break;
        default:
      }
      this.stack.stepBack();
    }
  }

  restoreState() {
    if (AppManager.duringTrackCreation) {
      return;
    }
    const revertObj = this.stack.stepForward();
    if (revertObj) {
      const info = revertObj.info as any;
      switch (revertObj.type) {
        case 'NotePlacement':
          RevertHandler.restoreNotePlacement(info);
          break;
        case 'NoteLength':
          RevertHandler.restoreNoteLength(info);
          break;
        case 'CopyPaste':
          RevertHandler.restoreCopyPaste(info);
          break;
        case 'DeleteNote':
          RevertHandler.restoreDeleteNote(info);
          break;
        case 'Tied':
          RevertHandler.restoreTied(info);
          break;
        case 'SpecialSelect':
          RevertHandler.setSpecialSelect(info);
          break;
        case 'Zoom':
          RevertHandler.restoreZoom(info);
          break;
        case 'NoteSelect':
          RevertHandler.restoreNoteEffectSelect(info);
          break;
        case 'NotationSelect':
          RevertHandler.restoreNotationSelect(info);
          break;
        case 'Dynamic':
          RevertHandler.restoreDynamicSelect(info);
          break;
        case 'MeasureSelect':
          RevertHandler.toggleMeasureSelect(info);
          break;
        case 'Text':
          RevertHandler.restoreText(info);
          break;
        case 'Marker':
          RevertHandler.restoreMarker(info);
          break;
        case 'Chord':
          RevertHandler.restoreChord(info);
          break;
        case 'RepeatAlternative':
          RevertHandler.restoreRepeatAlternative(info);
          break;
        case 'RepeatClose':
          RevertHandler.restoreRepeatClose(info);
          break;
        case 'Stroke':
          RevertHandler.restoreStroke(info);
          break;
        case 'Artificial':
          RevertHandler.restoreArtificial(info);
          break;
        case 'Grace':
          RevertHandler.restoreGrace(info);
          break;
        case 'TremoloBar':
          RevertHandler.restoreTremoloBar(info);
          break;
        case 'TremoloPicking':
          RevertHandler.restoreTremoloPicking(info);
          break;
        case 'Bend':
          RevertHandler.restoreBend(info);
          break;
        case 'TimeMeter':
          RevertHandler.restoreTimeMeter(info);
          break;
        case 'BpmMeter':
          RevertHandler.restoreBpmMeter(info);
          break;
        case 'InstrumentSetting':
          RevertHandler.restoreInstrumentSetting(info);
          break;
        case 'AddBlock':
          RevertHandler.restoreAddBlock();
          break;
        case 'RemoveBlock':
          RevertHandler.restoreRemoveBlock();
          break;
        default:
      }
    }
  }

  // Note length
  static revertNoteLength(
    infoObj: { trackId: number, blockId: number, voiceId: number,
      measureBefore: Measure[] },
  ) {
    Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId] = infoObj.measureBefore;
    tab.drawTrack(infoObj.trackId, infoObj.voiceId, true, null);
  }

  static restoreNoteLength(
    infoObj: { trackId: number, blockId: number, voiceId: number,
      measureAfter: Measure[] },
  ) {
    Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId] = infoObj.measureAfter;
    tab.drawTrack(infoObj.trackId, infoObj.voiceId, true, null);
  }

  // Delete Note
  static revertDeleteNote(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, noteObj: Note, effectObj: MeasureEffects },
  ) {
    const {
      trackId, blockId, voiceId, beatId, string, noteObj, effectObj,
    } = infoObj;
    const redrawSequencer = Song.isBeatEmpty(trackId, blockId);
    const beatObj = Song.measures[trackId][blockId][voiceId][beatId];
    // eslint-disable-next-line prefer-destructuring
    beatObj.duration = beatObj.duration[0];
    beatObj.notes[string] = noteObj;
    beatObj.effects = effectObj;
    if (trackId === Song.currentTrackId && voiceId === Song.currentVoiceId) {
      requestCurrentVoiceBlockRender(trackId, blockId);
    }
    if (redrawSequencer) {
      sequencerHandler.redrawSequencerMain();
    }
  }

  static restoreDeleteNote(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number },
  ) {
    Tab.deleteNote(
      infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId, infoObj.string, true,
    );
    if (infoObj.trackId === Song.currentTrackId && infoObj.voiceId === Song.currentVoiceId) {
      requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    }
  }

  // Copy Paste
  static revertCopyPaste(
    infoObj: { trackId: number, voiceId: number,
      blocksBefore: {blockId: number, block: Measure[][]}[]},
  ) {
    for (let i = 0, n = infoObj.blocksBefore.length; i < n; i += 1) {
      const { blockId } = infoObj.blocksBefore[i];
      Song.measures[infoObj.trackId][blockId] = infoObj.blocksBefore[i].block;
    }
    if (infoObj.trackId === Song.currentTrackId && infoObj.voiceId === Song.currentVoiceId) {
      tab.drawTrack(0, 0, true, null);
    }
  }

  static restoreCopyPaste(
    infoObj: { trackId: number, voiceId: number,
      blocksAfter: {blockId: number, block: Measure[][]}[]},
  ) {
    for (let i = 0, n = infoObj.blocksAfter.length; i < n; i += 1) {
      const { blockId } = infoObj.blocksAfter[i];
      Song.measures[infoObj.trackId][blockId] = infoObj.blocksAfter[i].block;
    }
    if (infoObj.trackId === Song.currentTrackId && infoObj.voiceId === Song.currentVoiceId) {
      tab.drawTrack(0, 0, true, null);
    }
  }

  // Tied
  static revertTied(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, noteTiedTo: { blockId: number, beatId: number } },
  ) {
    // Handle tied note restoration directly
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    const note = beat.notes[infoObj.string];
    if (note != null) {
      note.tied = !note.tied;
      note.tiedTo = note.tied ? infoObj.noteTiedTo : { blockId: -1, beatId: -1 };
      requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
      EventBus.emit("menu.activateEffectsForMarkedPos");
    }
  }

  static restoreTied(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, noteTiedTo: { blockId: number, beatId: number } },
  ) {
    // Handle tied note restoration directly
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    const note = beat.notes[infoObj.string];
    if (note != null) {
      note.tied = !note.tied;
      note.tiedTo = note.tied ? infoObj.noteTiedTo : { blockId: -1, beatId: -1 };
      requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
      EventBus.emit("menu.activateEffectsForMarkedPos");
    }
  }

  // Note placement
  static revertNotePlacement(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, previousFret: number },
  ) {
    if (infoObj.previousFret !== -1) {
      tab.drawNote(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId,
        infoObj.string, infoObj.previousFret, true);
    } else {
      Tab.deleteNote(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId,
        infoObj.string, true);
      requestDurationRender(infoObj.trackId, infoObj.blockId, infoObj.voiceId);
    }
  }

  static restoreNotePlacement(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, newFret: number },
  ) {
    tab.drawNote(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId,
      infoObj.string, infoObj.newFret, true);
  }

  // Special Select effects - simplified implementation
  static setSpecialSelect(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, tupleSel: number, id: string },
  ) {
    // Simplified implementation for special select operations
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    
    if (infoObj.id === 'tuplet') {
      const tupletSet = tab.setTuplet(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId, infoObj.tupleSel);
      if (tupletSet) {
        requestDurationRender(infoObj.trackId, infoObj.blockId, infoObj.voiceId);
        tab.drawTrack(infoObj.trackId, infoObj.voiceId, true, null);
      }
    }
    
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Zoom
  static revertZoom(infoObj: {up: boolean}) {
    tab.scaleCompleteTab(!infoObj.up);
  }

  static restoreZoom(infoObj: {up: boolean}) {
    tab.scaleCompleteTab(infoObj.up);
  }

  // NoteEffectSelect
  static revertNoteEffectSelect(infoObj: {
    arr: {
      notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
        string: number, note: Note}[],
      blocks: number[],
      beats: {trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure}[]
    },
    changes: {[key: string]: {[s: string]: boolean}},
    id: string}) {
    for (const no of infoObj.arr.notes) {
      const {
        trackId, blockId, voiceId, beatId, string,
      } = no;
      const noteStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
      const beat = Song.measures[trackId][blockId][voiceId][beatId];
      for (const effect in infoObj.changes[noteStr]) {
        if (effect !== infoObj.id) {
          console.log(beat, beat.notes[string], effect, infoObj.changes[noteStr][effect]);
          setEffectVariable(beat, beat.notes[string], effect,
            infoObj.changes[noteStr][effect]);
        }
      }
    }
    processEffectSelect(infoObj.arr, infoObj.id, true);
  }

  static restoreNoteEffectSelect(infoObj: {arr: {
    notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, note: Note}[],
    blocks: number[],
    beats: {trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure}[]
  }, id: string}) {
    processEffectSelect(infoObj.arr, infoObj.id, true);
  }

  // NotationSelect - simplified implementation
  static revertNotationSelect(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number, id: string },
  ) {
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    
    // Toggle the notation effect
    if (infoObj.id === 'timeMeter') {
      Song.measureMeta[infoObj.blockId].timeMeterPresent = !Song.measureMeta[infoObj.blockId].timeMeterPresent;
    } else if (infoObj.id === 'bpmMeter') {
      Song.measureMeta[infoObj.blockId].bpmPresent = !Song.measureMeta[infoObj.blockId].bpmPresent;
    }
    
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  static restoreNotationSelect(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number, id: string },
  ) {
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    
    // Toggle the notation effect
    if (infoObj.id === 'timeMeter') {
      Song.measureMeta[infoObj.blockId].timeMeterPresent = !Song.measureMeta[infoObj.blockId].timeMeterPresent;
    } else if (infoObj.id === 'bpmMeter') {
      Song.measureMeta[infoObj.blockId].bpmPresent = !Song.measureMeta[infoObj.blockId].bpmPresent;
    }
    
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Dynamic Select - simplified implementation
  static revertDynamicSelect(
    {
      trackId, blockId, voiceId, beatId, string, id,
    }: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, id: string },
  ) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    beat.dynamicPresent = !beat.dynamicPresent;
    if (beat.dynamicPresent) {
      beat.dynamic = id.replace('Dynamic', '');
    }
    requestCurrentVoiceBlockRender(trackId, blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  static restoreDynamicSelect(
    {
      trackId, blockId, voiceId, beatId, string, id,
    }: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, id: string },
  ) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    beat.dynamicPresent = !beat.dynamicPresent;
    if (beat.dynamicPresent) {
      beat.dynamic = id.replace('Dynamic', '');
    }
    requestCurrentVoiceBlockRender(trackId, blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // OpenBar and closeBar - simplified implementation
  static toggleMeasureSelect(
    infoObj: { trackId: number, blockId: number, voiceId: number, id: string },
  ) {
    if (infoObj.id === 'openBar') {
      Song.measureMeta[infoObj.blockId].repeatOpen = !Song.measureMeta[infoObj.blockId].repeatOpen;
    }
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Text
  static revertText({
    trackId, blockId, voiceId, beatId, previousText, textPresentBefore,
  }: {
    trackId: number, blockId: number, voiceId: number, beatId: number,
    previousText: string, textPresentBefore: boolean,
  }) {
    Song.measures[trackId][blockId][voiceId][beatId].text = previousText;
    Song.measures[trackId][blockId][voiceId][beatId].textPresent = textPresentBefore;
    requestCurrentVoiceBlockRender(trackId, blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  static restoreText({
    trackId, blockId, voiceId, beatId, nextText, textPresentAfter,
  }: {
    trackId: number, blockId: number, voiceId: number, beatId: number,
    nextText: string, textPresentAfter: boolean,
  }) {
    Song.measures[trackId][blockId][voiceId][beatId].text = nextText;
    Song.measures[trackId][blockId][voiceId][beatId].textPresent = textPresentAfter;
    requestCurrentVoiceBlockRender(trackId, blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Marker
  static revertMarker(
    infoObj: {blockId: number, markerPresentBefore: boolean, markerBefore: Marker},
  ) {
    Song.measureMeta[infoObj.blockId].markerPresent = infoObj.markerPresentBefore;
    Song.measureMeta[infoObj.blockId].marker = infoObj.markerBefore;
    SequencerHandler.setMarker(infoObj.blockId);
  }

  static restoreMarker(
    infoObj: {blockId: number, markerPresentAfter: boolean, markerAfter: Marker},
  ) {
    Song.measureMeta[infoObj.blockId].markerPresent = infoObj.markerPresentAfter;
    Song.measureMeta[infoObj.blockId].marker = infoObj.markerAfter;
    SequencerHandler.setMarker(infoObj.blockId);
  }

  static setMarker(
    infoObj: {trackId: number, blockId: number, markerPresentBefore: boolean,
      markerPresentAfter: boolean}, reverting: boolean,
  ) {
    if (reverting) {
      if (!infoObj.markerPresentBefore && infoObj.markerPresentAfter) {
        SequencerHandler.removeMarker(infoObj.blockId);
      } else {
        SequencerHandler.setMarker(infoObj.blockId);
      }
    } else if (!infoObj.markerPresentAfter && infoObj.markerPresentBefore) {
      SequencerHandler.removeMarker(infoObj.blockId);
    } else {
      SequencerHandler.setMarker(infoObj.blockId);
    }
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Time Meter
  static revertTimeMeter(infoObj: {
    blockId: number,
    timeMeterPresentBefore: boolean,
    notesBefore: { blockId: number, beatId: number, notes: Note[] }[][][],
    numeratorBefore: number,
    denominatorBefore: number
  }) {
    Song.measureMeta[infoObj.blockId].timeMeterPresent = infoObj.timeMeterPresentBefore;
    // add all saved notes to measures
    for (let trackId = 0, numTr = infoObj.notesBefore.length; trackId < numTr; trackId += 1) {
      for (let voiceId = 0, numVc = infoObj.notesBefore[trackId].length;
        voiceId < numVc; voiceId += 1) {
        for (let i = 0, n = infoObj.notesBefore[trackId][voiceId].length; i < n; i += 1) {
          const { blockId } = infoObj.notesBefore[trackId][voiceId][i];

          Song.measureMeta[blockId].numerator = infoObj.numeratorBefore;
          Song.measureMeta[blockId].denominator = infoObj.denominatorBefore;

          for (let j = 0, m = infoObj.notesBefore[trackId][voiceId][i].notes.length;
            j < m; j += 1) {
            const { beatId, notes } = infoObj.notesBefore[trackId][voiceId][i];
            const clonedNote = JSON.parse(JSON.stringify(notes[j]));
            Song.measures[trackId][blockId][voiceId][beatId] = clonedNote;
          }
        }
      }
    }
    tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  static restoreTimeMeter(
    infoObj: {blockId: number, timeMeterPresentAfter: boolean, numeratorAfter: number,
      denominatorAfter: number},
  ) {
    Song.measureMeta[infoObj.blockId].timeMeterPresent = infoObj.timeMeterPresentAfter;
    Song.measureMeta[infoObj.blockId].numerator = infoObj.numeratorAfter;
    Song.measureMeta[infoObj.blockId].denominator = infoObj.denominatorAfter;
    AppManager.checkAndAdaptTimeMeter(infoObj.blockId);
    tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Bpm Meter
  static revertBpmMeter(
    infoObj: {trackId: number, blockId: number, bpmPresentBefore: boolean,
      bpmBefore: number},
  ) {
    Song.measureMeta[infoObj.blockId].bpmPresent = infoObj.bpmPresentBefore;
    Song.measureMeta[infoObj.blockId].bpm = infoObj.bpmBefore;
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  static restoreBpmMeter(
    infoObj: {trackId: number, blockId: number, bpmPresentAfter: boolean,
      bpmAfter: number},
  ) {
    Song.measureMeta[infoObj.blockId].bpmPresent = infoObj.bpmPresentAfter;
    Song.measureMeta[infoObj.blockId].bpm = infoObj.bpmAfter;
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Chord
  static revertChord({
    trackId, blockId, voiceId, beatId, chordBefore, chordPresentBefore,
  }: {
    trackId: number, blockId: number, voiceId: number, beatId: number,
    chordBefore: Chord, chordPresentBefore: boolean,
  }) {
    Song.measures[trackId][blockId][voiceId][beatId].chord = chordBefore;
    Song.measures[trackId][blockId][voiceId][beatId].chordPresent = chordPresentBefore;
    requestCurrentVoiceBlockRender(trackId, blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  static restoreChord({
    trackId, blockId, voiceId, beatId, chordAfter, chordPresentAfter,
  }: {
    trackId: number, blockId: number, voiceId: number, beatId: number,
    chordAfter: Chord, chordPresentAfter: boolean,
  }) {
    Song.measures[trackId][blockId][voiceId][beatId].chord = chordAfter;
    Song.measures[trackId][blockId][voiceId][beatId].chordPresent = chordPresentAfter;
    requestCurrentVoiceBlockRender(trackId, blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Repeat Alternative
  static revertRepeatAlternative({
    trackId, blockId, repeatAlternativeBefore, repeatAlternativePresentBefore,
  }: {
    trackId: number, blockId: number, repeatAlternativeBefore: number,
    repeatAlternativePresentBefore: boolean,
  }) {
    Song.measureMeta[blockId].repeatAlternativePresent = repeatAlternativePresentBefore;
    Song.measureMeta[blockId].repeatAlternative = repeatAlternativeBefore;
    requestCurrentVoiceBlockRender(trackId, blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  static restoreRepeatAlternative({
    trackId, blockId, repeatAlternativeAfter, repeatAlternativePresentAfter,
  }: {
    trackId: number, blockId: number, repeatAlternativeAfter: number,
    repeatAlternativePresentAfter: boolean,
  }) {
    Song.measureMeta[blockId].repeatAlternativePresent = repeatAlternativePresentAfter;
    Song.measureMeta[blockId].repeatAlternative = repeatAlternativeAfter;
    requestCurrentVoiceBlockRender(trackId, blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Repeat Close
  static revertRepeatClose(
    infoObj: {trackId: number, blockId: number, repeatClosePresentBefore: boolean,
      repeatCloseBefore: number},
  ) {
    Song.measureMeta[infoObj.blockId].repeatClosePresent = infoObj.repeatClosePresentBefore;
    Song.measureMeta[infoObj.blockId].repeatClose = infoObj.repeatCloseBefore;
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  static restoreRepeatClose(
    infoObj: {trackId: number, blockId: number, repeatClosePresentAfter: boolean,
      repeatCloseAfter: number},
  ) {
    Song.measureMeta[infoObj.blockId].repeatClosePresent = infoObj.repeatClosePresentAfter;
    Song.measureMeta[infoObj.blockId].repeatClose = infoObj.repeatCloseAfter;
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Stroke
  static revertStroke(
    infoObj: {trackId: number, blockId: number, voiceId: number, beatId: number,
      strokePresentBefore: boolean,
    strokeBefore: Stroke},
  ) {
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    beat.effects.stroke = infoObj.strokeBefore;
    beat.effects.strokePresent = infoObj.strokePresentBefore;
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedBeat");
  }

  static restoreStroke(infoObj: {trackId: number, blockId: number, voiceId: number, beatId: number,
    strokePresentAfter: boolean, strokeAfter: Stroke }) {
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    beat.effects.stroke = infoObj.strokeAfter;
    beat.effects.strokePresent = infoObj.strokePresentAfter;
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedBeat");
  }

  // Artificial
  static revertArtificial({
    trackId, blockId, voiceId, beatId, string, artificialBefore, artificialPresentBefore,
  }: {
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    artificialBefore: string, artificialPresentBefore: boolean,
  }) {
    const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
    if (note != null) {
      note.artificialStyle = artificialBefore;
      note.artificialPresent = artificialPresentBefore;
      requestCurrentVoiceBlockRender(trackId, blockId);
      EventBus.emit("menu.activateEffectsForMarkedPos");
    } else {
      console.error('Note is null');
    }
  }

  static restoreArtificial({
    trackId, blockId, voiceId, beatId, string, artificialAfter, artificialPresentAfter,
  }: {
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    artificialAfter: string, artificialPresentAfter: boolean,
  }) {
    const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
    if (note != null) {
      note.artificialStyle = artificialAfter;
      note.artificialPresent = artificialPresentAfter;
      requestCurrentVoiceBlockRender(trackId, blockId);
      EventBus.emit("menu.activateEffectsForMarkedPos");
    } else {
      console.error('Note is nul');
    }
  }

  // Grace
  static revertGrace({
    trackId, blockId, voiceId, beatId, string, graceBefore, gracePresentBefore,
  }: {
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    graceBefore: Grace, gracePresentBefore: boolean,
  }) {
    const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
    if (note != null) {
      note.graceObj = graceBefore;
      note.gracePresent = gracePresentBefore;
      requestCurrentVoiceBlockRender(trackId, blockId);
      EventBus.emit("menu.activateEffectsForMarkedPos");
    } else {
      console.error('Note is null');
    }
  }

  static restoreGrace({
    trackId, blockId, voiceId, beatId, string, graceAfter, gracePresentAfter,
  }: {
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    graceAfter: Grace, gracePresentAfter: boolean,
  }) {
    const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
    if (note != null) {
      note.graceObj = graceAfter;
      note.gracePresent = gracePresentAfter;
      requestCurrentVoiceBlockRender(trackId, blockId);
      EventBus.emit("menu.activateEffectsForMarkedPos");
    } else {
      console.error('Note is null');
    }
  }

  // TremoloBar
  static revertTremoloBar(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
    tremoloBarBefore: TremoloBar, tremoloBarPresentBefore: boolean,
    effectsBefore: {string: number, effects: {[s: string]: boolean}}[]},
  ) {
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    beat.effects.tremoloBar = infoObj.tremoloBarBefore;
    beat.effects.tremoloBarPresent = infoObj.tremoloBarPresentBefore;
    for (const { string, effects } of infoObj.effectsBefore) {
      for (const effect in effects) {
        if (Object.prototype.hasOwnProperty.call(effects, effect)) {
          setEffectVariable(beat, beat.notes[string], effect, effects[effect]);
        }
      }
    }
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedBeat");
  }

  static restoreTremoloBar(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number
    tremoloBarAfter: TremoloBar, tremoloBarPresentAfter: boolean,
    effectsBefore: {string: number, effects: {[s: string]: boolean}}[]},
  ) {
    menuHandler.handleEffectGroupCollisionBeat([infoObj], 'tremoloBar', infoObj.tremoloBarPresentAfter);
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    beat.effects.tremoloBar = infoObj.tremoloBarAfter;
    beat.effects.tremoloBarPresent = infoObj.tremoloBarPresentAfter;
    requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
    EventBus.emit("menu.activateEffectsForMarkedBeat");
  }

  // tremoloPicking
  static revertTremoloPicking(infoObj: {
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    tremoloPickingBefore: string, tremoloPickingPresentBefore: boolean,
    effectsBefore: {[m: string]: boolean}
  }) {
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    const note = beat.notes[infoObj.string];
    if (note != null) {
      note.tremoloPickingLength = infoObj.tremoloPickingBefore;
      note.tremoloPicking = infoObj.tremoloPickingPresentBefore;
      for (const effect in infoObj.effectsBefore) {
        if (Object.prototype.hasOwnProperty.call(infoObj.effectsBefore, effect)) {
          setEffectVariable(beat, note, effect, infoObj.effectsBefore[effect]);
        }
      }
      requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
      EventBus.emit("menu.activateEffectsForMarkedPos");
    } else {
      console.error('Note is null');
    }
  }

  static restoreTremoloPicking(infoObj: {
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    tremoloPickingAfter: string, tremoloPickingPresentAfter: boolean
  }) {
    const {
      trackId, blockId, voiceId, beatId, string, tremoloPickingAfter, tremoloPickingPresentAfter,
    } = infoObj;
    menuHandler.handleEffectGroupCollision([infoObj], 'tremoloPicking', tremoloPickingPresentAfter);
    const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
    if (note != null) {
      note.tremoloPickingLength = tremoloPickingAfter;
      note.tremoloPicking = tremoloPickingPresentAfter;
      requestCurrentVoiceBlockRender(trackId, blockId);
      EventBus.emit("menu.activateEffectsForMarkedPos");
    } else {
      console.error('Note is null');
    }
  }

  // Bend
  static revertBend(infoObj: {
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    bendBefore: Bend, bendPresentBefore: boolean, effectsBefore: {[m: string]: boolean}
  }) {
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    const note = beat.notes[infoObj.string];
    if (note != null) {
      note.bendObj = infoObj.bendBefore;
      note.bendPresent = infoObj.bendPresentBefore;
      for (const effect in infoObj.effectsBefore) {
        if (Object.prototype.hasOwnProperty.call(infoObj.effectsBefore, effect)) {
          setEffectVariable(beat, note, effect, infoObj.effectsBefore[effect]);
        }
      }
      requestCurrentVoiceBlockRender(infoObj.trackId, infoObj.blockId);
      EventBus.emit("menu.activateEffectsForMarkedPos");
    } else {
      console.error('Note is null');
    }
  }

  static restoreBend(infoObj: {
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    bendAfter: Bend, bendPresentAfter: boolean
  }) {
    const {
      trackId, blockId, voiceId, beatId, string, bendAfter, bendPresentAfter,
    } = infoObj;
    menuHandler.handleEffectGroupCollision([infoObj], 'bend', bendPresentAfter);
    const note = Song.measures[trackId][blockId][voiceId][beatId].notes[string];
    if (note != null) {
      note.bendObj = bendAfter;
      note.bendPresent = bendPresentAfter;
      requestCurrentVoiceBlockRender(trackId, blockId);
      EventBus.emit("menu.activateEffectsForMarkedPos");
    } else {
      console.error('Note is null');
    }
  }

  static adaptToChangedTrack(trackId: number, currentTrack: Track, trackAfter: Track) {
    if (currentTrack.numStrings !== trackAfter.numStrings) {
      tab.redrawCompleteTrack(trackId);
    }
    if (trackId === Song.currentTrackId) {
      tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    }
    AppManager.setTrackInstrument(trackId);
  }

  // InstrumentSettings
  static revertInstrumentSetting(infoObj: { trackId: number, trackBefore: Track }) {
    const currentTrack = Song.tracks[infoObj.trackId];
    Song.tracks[infoObj.trackId] = infoObj.trackBefore;
    RevertHandler.adaptToChangedTrack(infoObj.trackId, currentTrack, infoObj.trackBefore);
  }

  static restoreInstrumentSetting(infoObj: { trackId: number, trackAfter: Track }) {
    const currentTrack = Song.tracks[infoObj.trackId];
    Song.tracks[infoObj.trackId] = infoObj.trackAfter;
    RevertHandler.adaptToChangedTrack(infoObj.trackId, currentTrack, infoObj.trackAfter);
  }

  // Add BLOCK
  static revertAddBlock() {
    tab.removeBlock(true);
  }

  static restoreAddBlock() {
    tab.addBlock(true);
  }

  // Remove Block
  static revertRemoveBlock(
    info: {blocksBefore: Measure[][][], measureMetaBefore: MeasureMetaInfo},
  ) {
    for (let i = 0; i < info.blocksBefore.length; i += 1) {
      if (Song.measures[i] != null) {
        Song.measures[i].push(info.blocksBefore[i]);
      }
    }
    Song.measureMeta.push(info.measureMetaBefore);
    Song.numMeasures += 1;
    tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    sequencerHandler.redrawSequencerMain();
  }

  static restoreRemoveBlock() {
    tab.removeBlock(true);
  }
}

const revertHandler = new RevertHandler();
export { revertHandler, RevertHandler };
export default RevertHandler;
