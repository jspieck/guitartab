import Settings from './settingManager';
import Song, { Measure, Note, Interval } from './songData';
import { revertHandler } from './revertHandler';
import Duration from './duration';
import Helper from './helper';
import playBackLogic from './playBackLogicNew';
import { tab } from './tab';
import { sequencerHandler, SequencerHandler } from './sequencerHandler';
import { svgDrawer } from './svgDrawer';
import { menuHandler } from './menuHandler';

class OverlayHandler {
  startPosOverlay: { trackId: number, blockId: number, voiceId: number,
    beatId: number, abstractTimePos: number } | null;

  endPosOverlay: { trackId: number, blockId: number, voiceId: number,
    beatId: number, abstractTimePos: number } | null;

  copyObject: { array: Measure[]};

  highestBlockOverlay: number;

  overlaysPerRow: SVGRectElement[];

  selectionClicked: boolean;

  lastTriPointer: HTMLElement | null;

  isOverlaySet: boolean;

  loopingInterval: Interval | null;

  constructor() {
    this.startPosOverlay = null;
    this.endPosOverlay = null;
    this.copyObject = { array: [] };
    this.highestBlockOverlay = 0;
    // TODO: for later
    this.overlaysPerRow = [];
    this.selectionClicked = false;
    this.lastTriPointer = null;
    this.isOverlaySet = false;
    this.loopingInterval = null;
  }

  getEndOverlay() {
    return this.endPosOverlay;
  }

  initOverlay(trackId: number, blockId: number, voiceId: number, beatId: number) {
    this.selectionClicked = true;
    this.clearAllOverlays();
    this.highestBlockOverlay = blockId;
    this.setStartOverlay(trackId, blockId, voiceId, beatId);
    this.endPosOverlay = null;
    this.isOverlaySet = false;
    // createTrianglePointer(trackId, blockId, voiceId, startPosOverlay.leftPos);
    if (this.loopingInterval != null) {
      const oldloopingInterval = this.loopingInterval;
      this.loopingInterval = null;
      if (Settings.songPlaying) {
        playBackLogic.adaptPlayBackToLoopIntervalChange(oldloopingInterval, this.loopingInterval);
      }
    }
  }

  resetOverlays() {
    this.clearAllOverlays();
    this.startPosOverlay = null;
    this.endPosOverlay = null;
    this.highestBlockOverlay = 0;
    this.overlaysPerRow.length = 0;
    this.selectionClicked = false;
    this.lastTriPointer = null;
    this.loopingInterval = null;
  }

  getLoopingInterval() {
    if (!this.isOverlaySet) {
      return null;
    }
    return this.loopingInterval;
  }

  setStartOverlay(trackId: number, blockId: number, voiceId: number, beatId: number) {
    let timeNeeded = 0;
    for (let i = 0; i < beatId; i += 1) {
      timeNeeded += Duration.getDurationOfNote(Song.measures[trackId][blockId][voiceId][i], false);
    }
    this.startPosOverlay = {
      trackId,
      blockId,
      voiceId,
      beatId,
      abstractTimePos: timeNeeded / Duration.getDurationOfType('wr'),
    };
  }

  setEndOverlay(trackId: number, blockId: number, voiceId: number, beatId: number) {
    // compute ratio of beat in block
    let timeNeeded = 0;
    for (let i = 0; i <= beatId; i += 1) {
      timeNeeded += Duration.getDurationOfNote(Song.measures[trackId][blockId][voiceId][i], false);
    }
    this.endPosOverlay = {
      trackId,
      blockId,
      voiceId,
      beatId,
      abstractTimePos: timeNeeded / Duration.getDurationOfType('wr'),
    };
  }

  setLoopingInterval() {
    const previousInterval = this.loopingInterval;
    if (this.startPosOverlay == null || this.endPosOverlay == null) {
      return;
    }
    const {
      trackId, blockId: blockIdStart, voiceId: voiceIdStart, beatId: beatIdStart,
    } = this.startPosOverlay;
    const {
      blockId: blockEnd, voiceId: voiceEnd, beatId: beatEnd,
    } = this.endPosOverlay;

    if (blockIdStart > blockEnd
      || ((blockIdStart === blockEnd) && beatIdStart > beatEnd)
    ) {
      const durEnd = Duration.getDurationOfNote(Song.measures[trackId][blockEnd][voiceEnd][beatEnd],
        false);
      const startRatio = this.endPosOverlay.abstractTimePos - durEnd / Duration.getDurationOfType('wr');
      const durStart = Duration.getDurationOfNote(
        Song.measures[trackId][blockIdStart][voiceIdStart][beatIdStart],
        false,
      );
      const endRatio = this.startPosOverlay.abstractTimePos + durStart / Duration.getDurationOfType('wr');
      this.loopingInterval = {
        trackId,
        startBlock: blockEnd,
        startBeat: beatEnd,
        startRatio,
        endBlock: blockIdStart,
        endBeat: beatIdStart,
        endRatio,
      };
    } else {
      this.loopingInterval = {
        trackId,
        startBlock: this.startPosOverlay.blockId,
        startBeat: this.startPosOverlay.beatId,
        startRatio: this.startPosOverlay.abstractTimePos,
        endBlock: this.endPosOverlay.blockId,
        endBeat: this.endPosOverlay.beatId,
        endRatio: this.endPosOverlay.abstractTimePos,
      };
    }
    if (Settings.songPlaying) {
      playBackLogic.adaptPlayBackToLoopIntervalChange(previousInterval, this.loopingInterval);
      const {
        startBlock, startRatio, startBeat,
      } = this.loopingInterval;
      playBackLogic.jumpToPosition(startBlock, startRatio, startBeat);
    }
  }

  drawOverlay(trackId: number, voiceId: number, blockIdStart: number,
    blockIdEnd: number, beatIdStart: number, beatIdEnd: number) {
    const rowBegin = tab.blockToRow[trackId][voiceId][blockIdStart].rowId;
    const rowEnd = tab.blockToRow[trackId][voiceId][blockIdEnd].rowId;
    for (let rowId = rowBegin; rowId <= rowEnd; rowId += 1) {
      let xPosStart;
      if (rowId === rowBegin) {
        xPosStart = svgDrawer.getPositionInRow(trackId, voiceId, blockIdStart, beatIdStart);
      } else {
        xPosStart = 0;
      }

      let xPosEnd;
      if (rowId === rowEnd) {
        if (Song.measures[trackId][blockIdEnd][voiceId].length === beatIdEnd + 1) {
          xPosEnd = svgDrawer.getXForBlock(trackId, voiceId, blockIdEnd)
            + tab.finalBlockWidths[trackId][voiceId][blockIdEnd];
        } else {
          xPosEnd = svgDrawer.getPositionInRow(trackId, voiceId, blockIdEnd, beatIdEnd + 1);
        }
      } else {
        xPosEnd = svgDrawer.getRowWidth();
      }

      this.overlaysPerRow[rowId] = svgDrawer.drawOverlayRow(trackId, voiceId, rowId,
        xPosStart, xPosEnd);
    }
  }

  createTrianglePointer(trackId: number, blockId: number, voiceId: number, leftPos: number) {
    const triPointer = document.createElement('div');
    triPointer.setAttribute('id', 'triangleUp');
    triPointer.setAttribute('class', 'triangleUp');
    triPointer.style.left = `${leftPos}px`;

    let topPosition = tab.heightOfBlock[trackId][voiceId][blockId];
    if (Song.measureMeta[blockId].bpmPresent) {
      topPosition -= Settings.OVERBAR_ROW_HEIGHT;
    }
    triPointer.style.top = `${-topPosition}px`;
    document.getElementById(`lineBlock_${trackId}_${blockId}_${voiceId}`)?.appendChild(triPointer);
    this.lastTriPointer = triPointer;
  }

  /* static resetTrianglePointer(trackId, voiceId, blockId) {
    if(document.getElementById("triangleUp") != null){
      var topPosition = svgDrawer.heightOfRow[trackId][voiceId][blockId];
      if(Song.measureMeta[blockId].bpmPresent){
          topPosition -= Settings.OVERBAR_ROW_HEIGHT;
      }
      document.getElementById("triangleUp").style.top = (-topPosition)+"px";
    }
  } */

  clearAllOverlays() {
    // empty previous overlays
    for (let key in this.overlaysPerRow) {
      if (this.overlaysPerRow.hasOwnProperty(key) && this.overlaysPerRow[key] != null) {
        let parentNode = this.overlaysPerRow[key].parentNode;
        if (parentNode) {
          parentNode.removeChild(this.overlaysPerRow[key]);
        }
      }
    }
    this.overlaysPerRow.length = 0;
    SequencerHandler.removeOverlay();
    // clear triangle pointer
    if (this.lastTriPointer != null) {
      this.lastTriPointer.parentNode?.removeChild(this.lastTriPointer);
      this.lastTriPointer = null;
    }
  }

  redrawOverlays() {
    if (this.startPosOverlay != null && this.endPosOverlay != null) {
      this.clearAllOverlays();
      const {
        trackId, blockId: blockIdStart, voiceId: voiceIdStart, beatId: beatIdStart,
      } = this.startPosOverlay;
      const { blockId: blockEnd, beatId: beatEnd } = this.endPosOverlay;
      // createTrianglePointer(trackId, blockIdStart, voiceId, this.startPosOverlay.leftPos)
      if (blockIdStart < blockEnd) {
        this.drawOverlay(trackId, voiceIdStart, blockIdStart, blockEnd, beatIdStart, beatEnd);
      } else if (blockIdStart === blockEnd) {
        if (this.startPosOverlay.beatId <= beatEnd) {
          this.drawOverlay(trackId, voiceIdStart, blockIdStart, blockEnd, beatIdStart, beatEnd);
        } else {
          this.drawOverlay(trackId, voiceIdStart, blockIdStart, blockEnd, beatEnd, beatIdStart);
        }
      } else {
        this.drawOverlay(trackId, voiceIdStart, blockEnd, blockIdStart, beatEnd, beatIdStart);
      }
    }
  }

  selectionMove(e: Event, trackId: number, blockId: number, voiceId: number, beatId: number) {
    this.isOverlaySet = true;
    this.setEndOverlay(trackId, blockId, voiceId, beatId);
    this.redrawOverlays();
    if (this.isNoteSelected()) {
      menuHandler.enableNoteEffectButtons();
    } else {
      menuHandler.disableNoteEffectButtons();
    }
  }

  isNoteSelected() {
    if (this.startPosOverlay == null || this.endPosOverlay == null) {
      return false;
    }
    let interval: Interval = {
      trackId: this.startPosOverlay.trackId,
      startBlock: this.startPosOverlay.blockId,
      startBeat: this.startPosOverlay.beatId,
      startRatio: this.startPosOverlay.abstractTimePos,
      endBlock: this.endPosOverlay.blockId,
      endBeat: this.endPosOverlay.beatId,
      endRatio: this.endPosOverlay.abstractTimePos,
    };
    if (this.startPosOverlay.blockId > this.endPosOverlay.blockId
      || ((this.startPosOverlay.blockId === this.endPosOverlay.blockId)
      && this.startPosOverlay.beatId > this.endPosOverlay.beatId)) {
      interval = {
        trackId: this.startPosOverlay.trackId,
        startBlock: this.endPosOverlay.blockId,
        startBeat: this.endPosOverlay.beatId,
        startRatio: this.endPosOverlay.abstractTimePos,
        endBlock: this.startPosOverlay.blockId,
        endBeat: this.startPosOverlay.beatId,
        endRatio: this.startPosOverlay.abstractTimePos,
      };
    }
    const result = this.getNotesInInterval(interval);
    if (result == null) {
      return false;
    }
    const { notes } = result;
    return notes.length > 0 && notes[0].note != null;
  }

  copyHandler() {
    // Song.measures from start to finish
    const copyArray = [];
    if (this.startPosOverlay != null && this.endPosOverlay != null) {
      for (let i = this.startPosOverlay.blockId; i <= this.endPosOverlay.blockId; i += 1) {
        const startIndex = (i !== this.startPosOverlay.blockId) ? 0 : this.startPosOverlay.beatId;
        const endIndex = (i !== this.endPosOverlay.blockId)
          ? Song.measures[this.endPosOverlay.trackId][i][this.endPosOverlay.voiceId].length - 1
          : this.endPosOverlay.beatId;
        for (let j = startIndex; j <= endIndex; j += 1) {
          copyArray.push(
            Song.measures[this.endPosOverlay.trackId][i][this.endPosOverlay.voiceId][j],
          );
        }
      }
      console.log(copyArray);
      this.copyObject.array = copyArray;
    }
  }

  static createFreshMeasure(measureIn: Measure) {
    const measure = JSON.parse(JSON.stringify(measureIn));
    // delete old properties saved in the note
    for (let p = 0; p < measure.notes.length; p += 1) {
      if (measure.notes[p] != null) {
        measure.notes[p].noteDrawn = null;
      }
    }
    return measure;
  }

  static giveMinNumberOfNotesForDuration(noteSize: number) {
    let givenNoteSize = noteSize;
    const result = [];
    while (givenNoteSize > 0) {
      const bestFit = Helper.getGreatestNotelengthToFit(givenNoteSize);
      if (bestFit + bestFit / 2 <= givenNoteSize) {
        result.push({ noteSize: bestFit, dotted: true });
        givenNoteSize -= (bestFit + bestFit / 2);
      } else {
        result.push({ noteSize: bestFit, dotted: false });
        givenNoteSize -= bestFit;
      }
    }
    return result;
  }

  private validatePasteOperation(): boolean {
    if (this.copyObject.array == null
      || this.startPosOverlay == null
      || this.endPosOverlay == null
    ) {
      return false;
    }
    return true;
  }

  private computeNoteDurationToReach(copyArray: Measure[]): number {
    let noteDurationToReach = 0;
    for (let i = 0, n = copyArray.length; i < n; i += 1) {
      noteDurationToReach += Duration.getDurationOfNote(copyArray[i], false);
    }
    return noteDurationToReach;
  }

  private validatePastingPossibility(
    noteDurationToReach: number,
    startBlockId: number,
    startBeatId: number,
    endBlockId: number,
    endBeatId: number,
    trackId: number,
    voiceId: number
  ): { valid: boolean; currentBlockId: number; currentBeatId: number } {
    let currentBlockId = startBlockId;
    let currentBeatId = startBeatId;
    let duration = noteDurationToReach;

    while (duration > 0) {
      const ms = Song.measures[trackId][currentBlockId][voiceId][currentBeatId];
      duration -= Duration.getDurationOfNote(ms, false);
      
      if (duration <= Settings.EPSILON) {
        duration = 0;
        break;
      }
      
      if (Song.measures[trackId][currentBlockId][voiceId].length <= currentBeatId + 1) {
        if (duration - Math.floor(duration) !== 0) {
          alert('Pasting is not allowed with non-integer duration sizes in one block!');
          return { valid: false, currentBlockId, currentBeatId };
        }
        
        if (Song.measures[trackId].length <= currentBlockId || endBlockId <= currentBlockId) {
          console.log('We only copy a part! 1');
          break;
        }
        
        currentBlockId += 1;
        currentBeatId = 0;
      } else {
        if (currentBlockId >= endBlockId && currentBeatId >= endBeatId) {
          console.log('We only copy a part! 2');
          break;
        }
        currentBeatId += 1;
      }
    }

    return { valid: true, currentBlockId, currentBeatId };
  }

  private saveBlocksBefore(startBlockId: number, endBlockId: number, trackId: number): {blockId: number, block: Measure[][]}[] {
    const blocksBefore: {blockId: number, block: Measure[][]}[] = [];
    for (let i = startBlockId; i <= endBlockId; i += 1) {
      blocksBefore.push({
        blockId: i,
        block: JSON.parse(JSON.stringify(Song.measures[trackId][i])),
      });
    }
    return blocksBefore;
  }

  private processBlock(
    blockId: number,
    startBlockId: number,
    endBlockId: number,
    startBeatId: number,
    endBeatId: number,
    trackId: number,
    voiceId: number,
    copyArray: Measure[],
    copyArrayIndex: { value: number },
    noteElemToMoveToTheNextBlock: { elem: Measure | null, duration: number }
  ): void {
    const startIndex = (blockId !== startBlockId) ? 0 : startBeatId;
    const endIndex = (blockId !== endBlockId)
      ? Song.measures[trackId][blockId][voiceId].length - 1
      : endBeatId;

    // Delete necessary notes and dom objects
    let availableSpaceInBlock = 0;
    for (let beatId = startIndex; beatId <= endIndex; beatId += 1) {
      availableSpaceInBlock += Duration.getDurationOfNote(
        Song.measures[trackId][blockId][voiceId][beatId], false,
      );
      OverlayHandler.deleteBeatObjects(trackId, blockId, voiceId, beatId);
    }

    Song.measures[trackId][blockId][voiceId].splice(startIndex, endIndex - startIndex + 1);

    let beatId = startIndex;

    // Set note that did not fit in the last block
    if (noteElemToMoveToTheNextBlock.duration > 0 && noteElemToMoveToTheNextBlock.elem != null) {
      beatId = this.addTiedNotesToBlock(
        trackId,
        blockId,
        voiceId,
        beatId,
        noteElemToMoveToTheNextBlock.elem,
        noteElemToMoveToTheNextBlock.duration
      );
      noteElemToMoveToTheNextBlock.duration = 0;
      noteElemToMoveToTheNextBlock.elem = null;
    }

    // Fill the rest of the block
    this.fillBlockWithNotes(
      trackId,
      blockId,
      voiceId,
      beatId,
      availableSpaceInBlock,
      copyArray,
      copyArrayIndex,
      noteElemToMoveToTheNextBlock
    );

    svgDrawer.setDurationsOfBlock(trackId, blockId, voiceId);
    tab.fillMeasure(trackId, blockId, voiceId);
  }

  private addTiedNotesToBlock(
    trackId: number,
    blockId: number,
    voiceId: number,
    startBeatId: number,
    noteElem: Measure,
    noteDuration: number
  ): number {
    const foundSize = OverlayHandler.giveMinNumberOfNotesForDuration(noteDuration);
    let beatId = startBeatId;

    for (let k = 0; k < foundSize.length; k += 1) {
      const freshNote = OverlayHandler.createFreshMeasure(noteElem);
      freshNote.dotted = foundSize[k].dotted;
      freshNote.duration = Duration.typeToString(foundSize[k].noteSize);
      
      // Tie all notes
      if (freshNote.notes != null) {
        for (let l = 0; l < freshNote.notes.length; l += 1) {
          if (freshNote.notes[l] != null) {
            freshNote.notes[l].tied = true;
          }
        }
      }
      
      Song.measures[trackId][blockId][voiceId].splice(beatId, 0, freshNote);
      beatId += 1;
    }

    return beatId;
  }

  private fillBlockWithNotes(
    trackId: number,
    blockId: number,
    voiceId: number,
    startBeatId: number,
    availableSpace: number,
    copyArray: Measure[],
    copyArrayIndex: { value: number },
    noteElemToMoveToTheNextBlock: { elem: Measure | null, duration: number }
  ): void {
    let beatId = startBeatId;
    let availableSpaceInBlock = availableSpace;

    while (availableSpaceInBlock > Settings.EPSILON) {
      if (copyArray.length <= copyArrayIndex.value) {
        console.log('No more elems in array');
        this.fillWithRests(trackId, blockId, voiceId, beatId, availableSpaceInBlock);
        break;
      }

      const noteElem = OverlayHandler.createFreshMeasure(copyArray[copyArrayIndex.value]);
      const noteLength = Duration.getDurationOfNote(noteElem, false);

      if (Math.abs(availableSpaceInBlock - noteLength) >= -Settings.EPSILON) {
        availableSpaceInBlock -= noteLength;
        Song.measures[trackId][blockId][voiceId].splice(beatId, 0, noteElem);
        beatId += 1;
      } else {
        // Note doesn't fit - split it
        beatId = this.addTiedNotesToBlock(
          trackId,
          blockId,
          voiceId,
          beatId,
          noteElem,
          availableSpaceInBlock
        );
        noteElemToMoveToTheNextBlock.duration = noteLength - availableSpaceInBlock;
        noteElemToMoveToTheNextBlock.elem = noteElem;
        availableSpaceInBlock = 0;
      }
      copyArrayIndex.value += 1;
    }
  }

  private fillWithRests(
    trackId: number,
    blockId: number,
    voiceId: number,
    startBeatId: number,
    availableSpace: number
  ): void {
    const foundSize = OverlayHandler.giveMinNumberOfNotesForDuration(availableSpace);
    let beatId = startBeatId;

    for (let q = 0; q < foundSize.length; q += 1) {
      Song.measures[trackId][blockId][voiceId].splice(beatId, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: Duration.typeToString(foundSize[q].noteSize),
          dotted: foundSize[q].dotted,
          notes: [],
        },
      });
      beatId += 1;
    }
  }

  pasteHandler() {
    if (!this.validatePasteOperation()) {
      return;
    }

    const startBlockId = this.startPosOverlay!.blockId;
    const startBeatId = this.startPosOverlay!.beatId;
    const trackId = Song.currentTrackId;
    const voiceId = Song.currentVoiceId;
    let endBlockId = this.endPosOverlay!.blockId;
    let endBeatId = this.endPosOverlay!.beatId;

    const copyArray = this.copyObject.array;
    const noteDurationToReach = this.computeNoteDurationToReach(copyArray);

    console.log(`Duration To Reach: ${noteDurationToReach}`);

    // Validate if pasting is possible
    const validation = this.validatePastingPossibility(
      noteDurationToReach,
      startBlockId,
      startBeatId,
      endBlockId,
      endBeatId,
      trackId,
      voiceId
    );

    if (!validation.valid) {
      return;
    }

    endBlockId = validation.currentBlockId;
    endBeatId = validation.currentBeatId;

    // Save blocks before modification
    const blocksBefore = this.saveBlocksBefore(startBlockId, endBlockId, trackId);

    // Process each block
    const copyArrayIndex = { value: 0 };
    const noteElemToMoveToTheNextBlock = { elem: null as Measure | null, duration: 0 };

    for (let i = startBlockId; i <= endBlockId; i += 1) {
      this.processBlock(
        i,
        startBlockId,
        endBlockId,
        startBeatId,
        endBeatId,
        trackId,
        voiceId,
        copyArray,
        copyArrayIndex,
        noteElemToMoveToTheNextBlock
      );
    }

    // Save blocks after modification and add to revert handler
    const blocksAfter = [];
    for (let i = startBlockId; i <= endBlockId; i += 1) {
      blocksAfter.push({
        blockId: i,
        block: JSON.parse(JSON.stringify(Song.measures[trackId][i])),
      });
    }

    revertHandler.addCopyPaste(trackId, voiceId, blocksBefore, blocksAfter);
    tab.drawTrack(trackId, voiceId, true, null);
    sequencerHandler.redrawSequencerMain();
  }

  static deleteBeatObjects(trackId: number, blockId: number, voiceId: number, beatId: number) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    if (beat.notes != null) {
      for (let i = 0; i < beat.notes.length; i += 1) {
        if (beat.notes[i] != null) {
          Helper.deleteDOMObject(beat.notes[i]!.noteDrawn);
        }
      }
    }
  }

  getNotesInInterval(interval: Interval | null): {
    notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
      string: number, note: Note}[],
    blocks: number[],
    beats: {trackId: number, blockId: number, voiceId: number, beatId: number,
      beat: Measure}[]
  } | null {
    const notesToExecuteOn: {trackId: number, blockId: number, voiceId: number,
      beatId: number, string: number, note: Note}[] = [];
    const blocks = [];
    const beats = [];
    let loopI = interval;
    if (interval == null) {
      loopI = this.getLoopingInterval();
    }
    
    // Safety check for tab.markedNoteObj
    if (!tab.markedNoteObj) {
      return null;
    }
    
    const { trackId } = tab.markedNoteObj;
    const { voiceId } = tab.markedNoteObj;
    
    // Safety checks for Song.measures structure
    if (!Song.measures[trackId] || !Song.measures[trackId][tab.markedNoteObj.blockId] 
        || !Song.measures[trackId][tab.markedNoteObj.blockId][voiceId]) {
      return null;
    }

    if (loopI == null || loopI.trackId !== Song.currentTrackId) {
      // Handle single note case
      const blockId = tab.markedNoteObj.blockId;
      const beatId = tab.markedNoteObj.beatId;
      const stringNum = tab.markedNoteObj.string;
      
      if (Song.measures[trackId][blockId][voiceId][beatId] && 
          Song.measures[trackId][blockId][voiceId][beatId].notes &&
          Song.measures[trackId][blockId][voiceId][beatId].notes[stringNum]) {
        const note = Song.measures[trackId][blockId][voiceId][beatId].notes[stringNum];
        if (note != null) {
          notesToExecuteOn.push({
            trackId,
            blockId,
            voiceId,
            beatId,
            string: stringNum,
            note,
          });
        }
      }
      
      blocks.push(tab.markedNoteObj.blockId);
      beats.push({
        trackId,
        blockId: tab.markedNoteObj.blockId,
        voiceId,
        beatId: tab.markedNoteObj.beatId,
        beat: Song.measures[trackId][tab.markedNoteObj.blockId][voiceId][tab.markedNoteObj.beatId],
      });
    } else {
      // Handle interval case
      for (let blockId = loopI.startBlock; blockId <= loopI.endBlock; blockId += 1) {
        // Safety check for each block
        if (!Song.measures[trackId][blockId] || !Song.measures[trackId][blockId][voiceId]) {
          continue;
        }
        
        const startIndex = (blockId !== loopI.startBlock) ? 0 : loopI.startBeat;
        const endIndex = (blockId !== loopI.endBlock)
          ? Song.measures[trackId][blockId][voiceId].length - 1
          : loopI.endBeat;
          
        for (let beatId = startIndex; beatId <= endIndex; beatId += 1) {
          // Safety check for each beat
          if (!Song.measures[trackId][blockId][voiceId][beatId] ||
              !Song.measures[trackId][blockId][voiceId][beatId].notes) {
            continue;
          }
          
          let noteExists = false;
          const beatNotes = Song.measures[trackId][blockId][voiceId][beatId].notes;
          
          for (let string = 0, n = beatNotes.length; string < n; string += 1) {
            if (beatNotes[string] != null) {
              noteExists = true;
              notesToExecuteOn.push({
                trackId,
                blockId,
                voiceId,
                beatId,
                string,
                note: beatNotes[string]!,
              });
            }
          }
          
          if (noteExists) {
            beats.push({
              trackId,
              blockId,
              voiceId,
              beatId,
              beat: Song.measures[trackId][blockId][voiceId][beatId],
            });
          }
        }
        blocks.push(blockId);
      }
    }
    return { notes: notesToExecuteOn, blocks, beats };
  }
}

const overlayHandler = new OverlayHandler();
export { overlayHandler, OverlayHandler };
export default OverlayHandler;
