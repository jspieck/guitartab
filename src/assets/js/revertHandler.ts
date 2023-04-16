import Song, {
  Measure, MeasureMetaInfo, Track, Bend, TremoloBar, Chord, Marker, Stroke,
  Grace, Note, MeasureEffects,
} from './songData';
import EventBus from './eventBus';
import { tab, Tab } from './tab';
import AppManager from './appManager';
import { svgDrawer } from './svgDrawer';
import { sequencer, Sequencer } from './sequencer';

class RevertHandler {
  reverStackSize: number;

  revertStack: any[];

  revertStackIndex: number;

  constructor() {
    this.reverStackSize = 20;
    this.revertStack = [];
    this.revertStackIndex = -1;
  }

  addToState(type: string, infoObj: any) {
    // delete old future states
    this.revertStack.splice(this.revertStackIndex + 1,
      this.revertStack.length - this.revertStackIndex);
    this.revertStack.push({ type, info: infoObj });
    this.revertStackIndex = this.revertStack.length - 1;
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
    for (let i = this.revertStack.length - 1; i >= 0; i -= 1) {
      const trackIdOfReversion = this.revertStack[i].info.trackId;
      if (trackIdOfReversion != null) {
        if (trackIdOfReversion === trackId) {
          this.revertStack.splice(i, 1);
          if (this.revertStackIndex >= i) {
            this.revertStackIndex -= 1;
          }
        } else if (trackIdOfReversion > trackId) {
          this.revertStack[i].info.trackId -= 1;
        }
      }
    }
  }

  revertState() {
    console.log(this.revertStackIndex);
    if (AppManager.duringTrackCreation) return;
    if (this.revertStack.length > 0 && this.revertStackIndex >= 0) {
      const revertObj = this.revertStack[this.revertStackIndex];

      switch (revertObj.type) {
        case 'NotePlacement':
          RevertHandler.revertNotePlacement(revertObj.info);
          break;
        case 'NoteLength':
          RevertHandler.revertNoteLength(revertObj.info);
          break;
        case 'CopyPaste':
          RevertHandler.revertCopyPaste(revertObj.info);
          break;
        case 'DeleteNote':
          RevertHandler.revertDeleteNote(revertObj.info);
          break;
        case 'Tied':
          RevertHandler.revertTied(revertObj.info);
          break;
        case 'SpecialSelect':
          RevertHandler.setSpecialSelect(revertObj.info);
          break;
        case 'Zoom':
          RevertHandler.revertZoom(revertObj.info);
          break;
        case 'NoteSelect':
          RevertHandler.revertNoteEffectSelect(revertObj.info);
          break;
        case 'NotationSelect':
          RevertHandler.revertNotationSelect(revertObj.info);
          break;
        case 'Dynamic':
          RevertHandler.revertDynamicSelect(revertObj.info);
          break;
        case 'MeasureSelect':
          RevertHandler.toggleMeasureSelect(revertObj.info);
          break;
        case 'Text':
          RevertHandler.revertText(revertObj.info);
          break;
        case 'Marker':
          RevertHandler.revertMarker(revertObj.info);
          break;
        case 'Chord':
          RevertHandler.revertChord(revertObj.info);
          break;
        case 'RepeatAlternative':
          RevertHandler.revertRepeatAlternative(revertObj.info);
          break;
        case 'RepeatClose':
          RevertHandler.revertRepeatClose(revertObj.info);
          break;
        case 'Stroke':
          RevertHandler.revertStroke(revertObj.info);
          break;
        case 'Artificial':
          RevertHandler.revertArtificial(revertObj.info);
          break;
        case 'Grace':
          RevertHandler.revertGrace(revertObj.info);
          break;
        case 'TremoloBar':
          RevertHandler.revertTremoloBar(revertObj.info);
          break;
        case 'TremoloPicking':
          RevertHandler.revertTremoloPicking(revertObj.info);
          break;
        case 'Bend':
          RevertHandler.revertBend(revertObj.info);
          break;
        case 'TimeMeter':
          RevertHandler.revertTimeMeter(revertObj.info);
          break;
        case 'BpmMeter':
          RevertHandler.revertBpmMeter(revertObj.info);
          break;
        case 'InstrumentSetting':
          RevertHandler.revertInstrumentSetting(revertObj.info);
          break;
        case 'AddBlock':
          RevertHandler.revertAddBlock();
          break;
        case 'RemoveBlock':
          RevertHandler.revertRemoveBlock(revertObj.info);
          break;
        default:
      }
      this.revertStackIndex -= 1;
    }
  }

  restoreState() {
    if (AppManager.duringTrackCreation) {
      return;
    }
    if (this.revertStack.length > 0 && this.revertStackIndex < this.revertStack.length - 1) {
      this.revertStackIndex += 1;
      const revertObj = this.revertStack[this.revertStackIndex];
      switch (revertObj.type) {
        case 'NotePlacement':
          RevertHandler.restoreNotePlacement(revertObj.info);
          break;
        case 'NoteLength':
          RevertHandler.restoreNoteLength(revertObj.info);
          break;
        case 'CopyPaste':
          RevertHandler.restoreCopyPaste(revertObj.info);
          break;
        case 'DeleteNote':
          RevertHandler.restoreDeleteNote(revertObj.info);
          break;
        case 'Tied':
          RevertHandler.restoreTied(revertObj.info);
          break;
        case 'SpecialSelect':
          RevertHandler.setSpecialSelect(revertObj.info);
          break;
        case 'Zoom':
          RevertHandler.restoreZoom(revertObj.info);
          break;
        case 'NoteSelect':
          RevertHandler.restoreNoteEffectSelect(revertObj.info);
          break;
        case 'NotationSelect':
          RevertHandler.restoreNotationSelect(revertObj.info);
          break;
        case 'Dynamic':
          RevertHandler.restoreDynamicSelect(revertObj.info);
          break;
        case 'MeasureSelect':
          RevertHandler.toggleMeasureSelect(revertObj.info);
          break;
        case 'Text':
          RevertHandler.restoreText(revertObj.info);
          break;
        case 'Marker':
          RevertHandler.restoreMarker(revertObj.info);
          break;
        case 'Chord':
          RevertHandler.restoreChord(revertObj.info);
          break;
        case 'RepeatAlternative':
          RevertHandler.restoreRepeatAlternative(revertObj.info);
          break;
        case 'RepeatClose':
          RevertHandler.restoreRepeatClose(revertObj.info);
          break;
        case 'Stroke':
          RevertHandler.restoreStroke(revertObj.info);
          break;
        case 'Artificial':
          RevertHandler.restoreArtificial(revertObj.info);
          break;
        case 'Grace':
          RevertHandler.restoreGrace(revertObj.info);
          break;
        case 'TremoloBar':
          RevertHandler.restoreTremoloBar(revertObj.info);
          break;
        case 'TremoloPicking':
          RevertHandler.restoreTremoloPicking(revertObj.info);
          break;
        case 'Bend':
          RevertHandler.restoreBend(revertObj.info);
          break;
        case 'TimeMeter':
          RevertHandler.restoreTimeMeter(revertObj.info);
          break;
        case 'BpmMeter':
          RevertHandler.restoreBpmMeter(revertObj.info);
          break;
        case 'InstrumentSetting':
          RevertHandler.restoreInstrumentSetting(revertObj.info);
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
      svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
    }
    if (redrawSequencer) {
      sequencer.redrawSequencerMain();
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
      svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
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
    menuHandler.processTiedButtonPress(infoObj.trackId, infoObj.blockId, infoObj.voiceId,
      infoObj.beatId, infoObj.string, infoObj.noteTiedTo);
  }

  static restoreTied(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, noteTiedTo: { blockId: number, beatId: number } },
  ) {
    menuHandler.processTiedButtonPress(infoObj.trackId, infoObj.blockId, infoObj.voiceId,
      infoObj.beatId, infoObj.string, infoObj.noteTiedTo);
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
      svgDrawer.setDurationsOfBlock(infoObj.trackId, infoObj.blockId, infoObj.voiceId);
    }
  }

  static restoreNotePlacement(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, newFret: number },
  ) {
    tab.drawNote(infoObj.trackId, infoObj.blockId, infoObj.voiceId, infoObj.beatId,
      infoObj.string, infoObj.newFret, true);
  }

  // Special Select effects
  static setSpecialSelect(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, tupleSel: number, id: string },
  ) {
    menuHandler.processSpecialSelect(infoObj.trackId, infoObj.blockId, infoObj.voiceId,
      infoObj.beatId, infoObj.string, infoObj.tupleSel, infoObj.id, true);
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
          menuHandler.setEffectVariable(beat, beat.notes[string], effect,
            infoObj.changes[noteStr][effect]);
        }
      }
    }
    menuHandler.processEffectSelect(infoObj.arr, infoObj.id, true);
  }

  static restoreNoteEffectSelect(infoObj: {arr: {
    notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, note: Note}[],
    blocks: number[],
    beats: {trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure}[]
  }, id: string}) {
    menuHandler.processEffectSelect(infoObj.arr, infoObj.id, true);
  }

  // NotationSelect
  static revertNotationSelect(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number, id: string },
  ) {
    menuHandler.processNotationSelect(infoObj.trackId, infoObj.blockId, infoObj.voiceId,
      infoObj.beatId, infoObj.id, true);
  }

  static restoreNotationSelect(
    infoObj: { trackId: number, blockId: number, voiceId: number, beatId: number, id: string },
  ) {
    menuHandler.processNotationSelect(infoObj.trackId, infoObj.blockId, infoObj.voiceId,
      infoObj.beatId, infoObj.id, true);
  }

  // Dynamic Select
  static revertDynamicSelect(
    {
      trackId, blockId, voiceId, beatId, string, id,
    }: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, id: string },
  ) {
    menuHandler.processDynamicSelect({
      notes: [{
        trackId, blockId, voiceId, beatId, string,
      }],
      blocks: [],
    }, id, true);
  }

  static restoreDynamicSelect(
    {
      trackId, blockId, voiceId, beatId, string, id,
    }: { trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, id: string },
  ) {
    menuHandler.processDynamicSelect({
      notes: [{
        trackId, blockId, voiceId, beatId, string,
      }],
      blocks: [],
    }, id, true);
  }

  // OpenBar and closeBar
  static toggleMeasureSelect(
    infoObj: { trackId: number, blockId: number, voiceId: number, id: string },
  ) {
    menuHandler.processMeasureSelect(infoObj.trackId, infoObj.blockId, infoObj.voiceId,
      infoObj.id, true);
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
    svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
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
    svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Marker
  static revertMarker(
    infoObj: {blockId: number, markerPresentBefore: boolean, markerBefore: Marker},
  ) {
    Song.measureMeta[infoObj.blockId].markerPresent = infoObj.markerPresentBefore;
    Song.measureMeta[infoObj.blockId].marker = infoObj.markerBefore;
    Sequencer.setMarker(infoObj.blockId);
  }

  static restoreMarker(
    infoObj: {blockId: number, markerPresentAfter: boolean, markerAfter: Marker},
  ) {
    Song.measureMeta[infoObj.blockId].markerPresent = infoObj.markerPresentAfter;
    Song.measureMeta[infoObj.blockId].marker = infoObj.markerAfter;
    Sequencer.setMarker(infoObj.blockId);
  }

  static setMarker(
    infoObj: {trackId: number, blockId: number, markerPresentBefore: boolean,
      markerPresentAfter: boolean}, reverting: boolean,
  ) {
    if (infoObj.markerPresentBefore && !infoObj.markerPresentAfter) {
      if (reverting) {
        Sequencer.setMarker(infoObj.blockId);
      } else {
        Sequencer.removeMarker(infoObj.blockId);
      }
    }
    if (!infoObj.markerPresentBefore && infoObj.markerPresentAfter) {
      if (reverting) {
        Sequencer.removeMarker(infoObj.blockId);
      } else {
        Sequencer.setMarker(infoObj.blockId);
      }
    }
    svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
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
    svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
    tab.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  static restoreBpmMeter(
    infoObj: {trackId: number, blockId: number, bpmPresentAfter: boolean,
      bpmAfter: number},
  ) {
    Song.measureMeta[infoObj.blockId].bpmPresent = infoObj.bpmPresentAfter;
    Song.measureMeta[infoObj.blockId].bpm = infoObj.bpmAfter;
    svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
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
    svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
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
    svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
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
    svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
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
    svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  // Repeat Close
  static revertRepeatClose(
    infoObj: {trackId: number, blockId: number, repeatClosePresentBefore: boolean,
      repeatCloseBefore: number},
  ) {
    Song.measureMeta[infoObj.blockId].repeatClosePresent = infoObj.repeatClosePresentBefore;
    Song.measureMeta[infoObj.blockId].repeatClose = infoObj.repeatCloseBefore;
    svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
    EventBus.emit("menu.activateEffectsForMarkedPos");
  }

  static restoreRepeatClose(
    infoObj: {trackId: number, blockId: number, repeatClosePresentAfter: boolean,
      repeatCloseAfter: number},
  ) {
    Song.measureMeta[infoObj.blockId].repeatClosePresent = infoObj.repeatClosePresentAfter;
    Song.measureMeta[infoObj.blockId].repeatClose = infoObj.repeatCloseAfter;
    svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
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
    svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
    EventBus.emit("menu.activateEffectsForMarkedBeat");
  }

  static restoreStroke(infoObj: {trackId: number, blockId: number, voiceId: number, beatId: number,
    strokePresentAfter: boolean, strokeAfter: Stroke }) {
    const beat = Song.measures[infoObj.trackId][infoObj.blockId][infoObj.voiceId][infoObj.beatId];
    beat.effects.stroke = infoObj.strokeAfter;
    beat.effects.strokePresent = infoObj.strokePresentAfter;
    svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
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
      svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
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
      svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
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
      svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
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
      svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
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
          menuHandler.setEffectVariable(beat, beat.notes[string], effect, effects[effect]);
        }
      }
    }
    svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
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
    svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
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
          menuHandler.setEffectVariable(beat, note, effect, infoObj.effectsBefore[effect]);
        }
      }
      svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
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
      svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
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
          menuHandler.setEffectVariable(beat, note, effect, infoObj.effectsBefore[effect]);
        }
      }
      svgDrawer.rerenderBlock(infoObj.trackId, infoObj.blockId, Song.currentVoiceId);
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
      svgDrawer.rerenderBlock(trackId, blockId, Song.currentVoiceId);
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
    sequencer.redrawSequencerMain();
  }

  static restoreRemoveBlock() {
    tab.removeBlock(true);
  }
}

const revertHandler = new RevertHandler();
export { revertHandler, RevertHandler };
export default RevertHandler;
