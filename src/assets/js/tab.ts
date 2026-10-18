import Song, { Beat } from './songData';
import { sequencerHandler } from './sequencerHandler';
import { TAB_SHEET, getAvailableRowWidth } from '../../utils/tabSheetConstants';
import { recomputeTrackLayoutFromSong } from '../../services/editor/measureLayoutEngine';
import { changeNoteDuration as changeNoteDurationCommand } from '../../services/editor/durationCommands';
import {
  addNoteToBlock as addNoteToBlockCommand,
  deleteNote as deleteNoteCommand,
  tupletOnlyRests as tupletOnlyRestsCommand,
} from '../../services/editor/noteCommands';
import {
  addBlock as addBlockCommand,
  removeBlock as removeBlockCommand,
  addMeasureSlot as addMeasureSlotCommand,
  createMeasures as createMeasuresCommand,
  createNewTrack as createNewTrackCommand,
  initEmptyTab as initEmptyTabCommand,
} from '../../services/editor/measureStructureCommands';
import { revertHandler } from './revertHandler';
import AppManager from './appManager';
import Duration from './duration';
import Helper from './helper';
import Settings from './settingManager';
import { classicalNotation } from '../../services/editor/classicalNotationAdapter';
import { overlayHandler } from './overlayHandler';
import { invalidateTrackLayout } from '../../services/editor/layoutInvalidation';
import { typedEventBus } from '../../utils/typedEventBus';
import { menuHandler } from './menuHandler';
import { changeBeatDurationViaReplacer } from './durationReplacerAdapter';
import type { BeatDuration } from '../../types/tab';
import { isRestDuration, noteLengthOf, restOf } from '../../utils/durationUtils';

class Tab {
  currentZoom: number;

  ZOOM_STEP: number;

  ZOOM_MAX: number;

  ZOOM_MIN: number;

  isDinA4: boolean;

  tupletIdCounter: number;

  tupletHelperCounter: number;

  tupletId: number;

  measureOffset: number[][][];

  markedNoteObj: {trackId: number, voiceId: number, blockId: number,
    beatId: number, string: number};
  
  // Flag to track if user has explicitly clicked to select a note position
  hasExplicitSelection: boolean;

  tupletManager: {originalDuration: BeatDuration | ''}[];

  blocksPerRow: {start: number, end: number}[][][];

  heightOfBlock: number[][][];

  allWidths: {minWidth: number, minOffset: number, num16ths: number}[];

  blockToRow: {rowId: number, numInRow: number}[][][];

  finalBlockWidths: number[][][];

  drawTrackCall: [number, number, boolean, (() => void) | null] | null;

  constructor() {
    this.currentZoom = 1.0;
    this.ZOOM_STEP = 0.05;
    this.ZOOM_MAX = 1.5;
    this.ZOOM_MIN = 0.5;
    this.measureOffset = [];
    this.markedNoteObj = {
      trackId: 0,
      voiceId: 0,
      blockId: 0,
      beatId: 0,
      string: 0,
    };
    this.hasExplicitSelection = false;
    this.isDinA4 = false;
    this.tupletManager = [];
    this.tupletIdCounter = 0;
    this.tupletHelperCounter = 0;
    this.tupletId = 0;
    this.drawTrackCall = null;
    this.blocksPerRow = [];
    this.heightOfBlock = [];
    this.allWidths = [];
    this.blockToRow = [];
    this.finalBlockWidths = [];
  }

  scaleCompleteTab(up: boolean) {
    const beginZoom = this.currentZoom;
    if (up) {
      this.currentZoom = Math.min(this.currentZoom + this.ZOOM_STEP, this.ZOOM_MAX);
    } else {
      this.currentZoom = Math.max(this.currentZoom - this.ZOOM_STEP, this.ZOOM_MIN);
    }
    AppManager.showNotification(`${Math.round(this.currentZoom * 100)}%`);
    if (beginZoom !== this.currentZoom) {
      Settings.currentZoom = this.currentZoom;
      typedEventBus.emit('ui.zoomChanged', this.currentZoom);
    }
  }

  addBlock(duringRestoration: boolean) {
    addBlockCommand(this, duringRestoration);
  }

  removeBlock(duringRestoration: boolean) {
    removeBlockCommand(this, duringRestoration);
  }

  addMeasureSlot(trackId: number, blockId: number, voiceId: number) {
    addMeasureSlotCommand(this, trackId, blockId, voiceId);
  }

  /**
   * [initializes measureOffset array]
   * @param  {int} trackId [description]
  */
  createMeasures(trackId: number, voiceId: number) {
    createMeasuresCommand(this, trackId, voiceId);
  }

  createNewTrack(
    trackId: number,
    instrObj: {name: string, channel: number, numStrings: number, strings: number[]},
  ) {
    createNewTrackCommand(this, trackId, instrObj);
  }

  static initEmptyTab() {
    initEmptyTabCommand();
  }

  toggleDinA4Layout() {
    const completeTabDom = document.getElementById('completeTab');
    if (!this.isDinA4) {
      completeTabDom?.classList.add('dinA4Size');
      this.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    } else {
      completeTabDom?.classList.remove('dinA4Size');
      this.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    }
    this.isDinA4 = !this.isDinA4;
  }

  drawNote(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, fretNumber: number, calledDuringRestore: boolean,
  ) {
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId });
    let oldFret = -1;
    let redrawSequencer = false;
    // console.trace("drawNote");
    if (beat.notes[string] == null) {
      beat.notes[string] = Song.defaultNote();
      redrawSequencer = Song.isBeatEmpty(trackId, blockId);
    } else {
      oldFret = beat.notes[string]!.fret;
    }
    beat.notes[string]!.fret = fretNumber;
    // TODO same object???
    if (beat.effects == null) {
      beat.effects = Song.defaultMeasureEffects();
    }
    // eslint-disable-next-line prefer-destructuring
    beat.duration = noteLengthOf(beat.duration);

    // only draw when current track is visible
    if (trackId === Song.currentTrackId && voiceId === Song.currentVoiceId) {
      typedEventBus.emit('menu.activateEffectsForMarkedPos');
    }
    if (redrawSequencer) {
      sequencerHandler.redrawSequencerMain();
    }
    if (!calledDuringRestore && this.markedNoteObj != null) {
      revertHandler.addFretNumber(
        this.markedNoteObj.trackId, this.markedNoteObj.blockId, this.markedNoteObj.voiceId,
        this.markedNoteObj.beatId, this.markedNoteObj.string, oldFret, fretNumber,
      );
    }
  }

  isNotePlaceable(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, newDuration: number, previousDuration: number,
  ) {
    const blockObj = Song.measures[trackId][blockId][voiceId];

    if (newDuration > previousDuration) {
      if (blockObj[beatId].tuplet == null) {
        const diff = newDuration - previousDuration;
        let reachedSpace = 0;
        for (let p = beatId + 1; p < blockObj.length; p += 1) {
          // check for rests that can be deleted
          if (blockObj[p].tuplet == null) {
            if (blockObj[p].duration.length > 1) {
              reachedSpace += Duration.getDurationOfNote(blockObj[p], false);
            }
          } else {
            const tupRe = Tab.tupletOnlyRests(p, blockObj);
            if (tupRe.onlyRests) {
              reachedSpace += Duration.getDurationOfType(
                this.tupletManager[blockObj[p].tupletId].originalDuration,
              );
            }
            p = tupRe.lastIndex;
          }

          if (reachedSpace >= diff) {
            const currentDiff = reachedSpace - diff;
            if (!(currentDiff < 1
              || ((currentDiff - Math.floor(currentDiff)) === 0.25 && currentDiff < 3.25))) {
              break;
            }
          }
        }
        const currentDiff = reachedSpace - diff;
        if (reachedSpace < diff
          || (currentDiff > 0 && currentDiff < 1)
          || ((currentDiff - Math.floor(currentDiff)) === 0.25 && currentDiff < 3.25)) {
          AppManager.showNotification('Not enough space in the bar.', 'error');
          return false;
        }
      } else {
        const startTupletId = blockObj[beatId].tupletId;
        // new duration is longer than previous duration
        // check if so many rests can be deleted that note length is reached
        const diff = newDuration - previousDuration;
        // if (previousDuration < Duration.getDurationOfType('s')
        // && newDuration >= Duration.getDurationOfType('s')) {
        //   rescaleNecessary = true;
        // }

        let reachedSpace = 0;
        for (let p = beatId + 1; p < blockObj.length; p += 1) {
          // check for rests that can be deleted
          if (blockObj[p].tuplet == null || blockObj[p].tupletId !== startTupletId) {
            break;
          } else if (blockObj[p].duration.length !== 1) {
            reachedSpace += Duration.getDurationOfNote(blockObj[p], true);
            if (reachedSpace >= diff) {
              const currentDiff = reachedSpace - diff;
              if (!(currentDiff < 1
                || ((currentDiff - Math.floor(currentDiff)) === 0.25 && currentDiff < 3.25))) {
                break;
              }
            }
          }
        }
        const currentDiff = reachedSpace - diff;
        if (reachedSpace < diff
          || (currentDiff > 0 && currentDiff < 1)
          || ((currentDiff - Math.floor(currentDiff)) === 0.25 && currentDiff < 3.25)) {
          AppManager.showNotification('Not enough space in the bar.', 'error');
          return false;
        }
      }
    }
    return true;
  }

  setTuplet(
    trackId: number, blockId: number, voiceId: number, beatIdIn: number,
    tupletSelection: number,
  ) {
    let beatId = beatIdIn;
    const block = Song.measures[trackId][blockId][voiceId];
    const beat = block[beatId];

    if (beat.tuplet == null || beat.tuplet === 0) {
      // Try to place the tuplet
      const currentDuration = Duration.getDurationOfNote(beat, true);

      if (beat.dotted || beat.doubleDotted || currentDuration <= 1) {
        AppManager.showNotification('Tuplets of dotted notes or 128ths are not possible yet.', 'error');
        return false;
      }
      // set note to new length
      beat.tuplet = tupletSelection;

      // fill in the new tuplet rests after the first tuplet note
      const thisTupletId = this.tupletId;
      const subFactor = Duration.tupletToNumOfSubstitutedNotes(tupletSelection);
      // we place a tuplet with half length
      let newDuration: BeatDuration = Duration.typeToString(currentDuration / subFactor);
      // set own note to new length
      const oldDuration = beat.duration;
      if (isRestDuration(oldDuration)) {
        beat.duration = restOf(newDuration);
      } else {
        beat.duration = newDuration;
      }
      beat.tupletId = thisTupletId;

      this.tupletManager[thisTupletId] = { originalDuration: oldDuration };

      // check if notes must be tied
      const notes = [];
      for (let k = 0; k < Song.tracks[trackId].numStrings; k += 1) {
        if (beat.notes[k] != null) {
          if (beat.notes[k]!.tieBegin) {
            notes[k] = { fret: beat.notes[k]!.fret, tied: true };
          } else if (beat.notes[k]!.tied) {
            const noteTiedTo = beat.notes[k]!.tiedTo;
            const { fret } = Song.measures[trackId][noteTiedTo.blockId][
              voiceId][noteTiedTo.beatId].notes[k] ?? { fret: -1 };
            notes[k] = { fret, tied: true };
          }
        }
      }

      if (notes.length === 0) {
        newDuration = restOf(newDuration);
      }

      for (let j = 1; j < tupletSelection; j += 1) {
        const notesObj = JSON.parse(JSON.stringify(notes));
        block.splice(beatId + j, 0, {
          ...Song.defaultMeasure(),
          ...{
            duration: newDuration,
            notes: notesObj,
            tuplet: tupletSelection,
            tupletId: thisTupletId,
          },
        });
      }
      this.tupletId += 1;
    } else {
      // only keep selected note and delete rest
      const nextBeat = Song.getBeat({ trackId, blockId, voiceId, beatId });
      const tupletIdToSearchFor = nextBeat.tupletId;
      // '' marks a cleared slot; keep the beat's length rather than storing an empty one
      nextBeat.duration = this.tupletManager[nextBeat.tupletId].originalDuration || nextBeat.duration;
      // dont keep dot if tuplet is eliminated
      nextBeat.dotted = false;
      nextBeat.doubleDotted = false;
      nextBeat.tuplet = -1;
      nextBeat.tupletId = -1;

      // TODO fix Mark of false position
      // delete all beats with same tupletId
      for (let i = 0; i < Song.measures[trackId][blockId][voiceId].length; i += 1) {
        const beatIn = Song.getBeat({ trackId, blockId, voiceId, beatId: i });
        if (i !== beatId && beatIn.tuplet != null && beatIn.tupletId === tupletIdToSearchFor) {
          Song.measures[trackId][blockId][voiceId].splice(i, 1);
          if (i < beatId) {
            beatId -= 1;
          }
          i -= 1;
        }
      }
      this.tupletManager[nextBeat.tupletId] = { originalDuration: '' };
      this.markedNoteObj.beatId = beatId;
    }
    menuHandler.setNoteLengthForMark(trackId, blockId, voiceId, beatId, this.markedNoteObj.string);
    return true;
  }

  deleteRestAndFillNote(
    trackId: number, blockId: number, voiceId: number, startBeatId: number, diff: number,
  ) {
    const blockObj = Song.measures[trackId][blockId][voiceId];
    // Delete all found rest notes and move notes after the deleted rests to new position
    let reachedSpace = 0;
    let beatId = 0;
    let currentDiff = 0;
    
    for (beatId = startBeatId + 1; beatId < blockObj.length; beatId += 1) {
      const beat = blockObj[beatId];
      
      // Check if it is a rest (no notes)
      let isRest = true;
      if (beat.notes) {
        for (let n of beat.notes) {
          if (n) { isRest = false; break; }
        }
      }

      // MOVE NOTES RIGHT
      if (isRest) {
        if (beat.tuplet != null) {
          // only delete if completely empty
          const tupRe = Tab.tupletOnlyRests(beatId, Song.measures[trackId][blockId][voiceId]);
          if (!tupRe.onlyRests) {
            beatId = tupRe.lastIndex;
            // eslint-disable-next-line no-continue
            continue;
          }
          reachedSpace += Duration.getDurationOfType(
            this.tupletManager[Song.measures[trackId][blockId][
              voiceId][beatId].tupletId].originalDuration,
          );
          for (let x = beatId; x < tupRe.lastIndex + 1; x += 1) {
            blockObj.splice(beatId, 1);
          }
          beatId -= 1;
        } else {
          reachedSpace += Duration.getDurationOfNote(beat, false);
          blockObj.splice(beatId, 1);
          beatId -= 1;
        }
        if (reachedSpace >= diff) {
          currentDiff = reachedSpace - diff;
          if ((currentDiff > 0 && currentDiff < 1)) {
            // continue;
          } else if (
            (currentDiff - Math.floor(currentDiff)) === 0.25
            && currentDiff < 3.25
          ) {
            // continue;
          } else {
            beatId += 1;
            break;
          }
        }
      }
    }
    // Object is placeable (checked in isPlaceable), now place notes
    // insert new rest that not too much gets deleted
    // (e.g. quarter rest deleted, but only eighth needed)
    // remove digits after comma
    if ((currentDiff - Math.floor(currentDiff)) === 0.25) {
      // add a dotted 64th and double dotted 64th
      blockObj.splice(beatId, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: 'zr',
          dotted: true,
          notes: [],
        },
      });
      beatId += 1;
      blockObj.splice(beatId, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: 'zr',
          doubleDotted: true,
          notes: [],
        },
      });
      beatId += 1;
      currentDiff -= 3.25;
    } else if ((currentDiff - Math.floor(currentDiff)) === 0.5) {
      // add a dotted 64th and double dotted 64th
      blockObj.splice(beatId, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: 'zr',
          dotted: true,
          notes: [],
        },
      });
      beatId += 1;
      currentDiff -= 1.5;
    } else if ((currentDiff - Math.floor(currentDiff)) === 0.75) {
      // add a double dotted 64th
      blockObj.splice(beatId, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: 'zr',
          doubleDotted: true,
          notes: [],
        },
      });
      beatId += 1;
      currentDiff -= 1.75;
    }

    Tab.fillAvailableSpaceWithRests(trackId, blockId, voiceId, beatId, currentDiff);
  }

  static deleteRestForTuplet(
    trackId: number, blockId: number, voiceId: number, beatId: number, diff: number,
  ) {
    const blockObj = Song.measures[trackId][blockId][voiceId];
    const startTupletId = blockObj[beatId].tupletId;
    const startTuplet = blockObj[beatId].tuplet;
    // Delete all found rest notes and move notes after the deleted rests to new position
    let reachedSpace = 0;
    let currentDiff = 0;
    let p = 0;
    for (p = beatId + 1; p < blockObj.length; p += 1) {
      // MOVE NOTES RIGHT
      if (blockObj[p].duration.length !== 1) {
        reachedSpace += Duration.getDurationOfNote(blockObj[p], true);
        blockObj.splice(p, 1);
        p -= 1;

        if (reachedSpace >= diff) {
          currentDiff = reachedSpace - diff;
          if (!((currentDiff > 0 && currentDiff < 1)
            || ((currentDiff - Math.floor(currentDiff)) === 0.25 && currentDiff < 3.25))) {
            p += 1;
            break;
          }
        }
      }
    }

    currentDiff = reachedSpace - diff;
    console.log(`Hu${currentDiff}`);
    // insert new rest that not too much gets deleted
    // (e.g. quarter rest deleted, but only eighth needed)
    let insertPosition = p;
    if ((currentDiff - Math.floor(currentDiff)) === 0.25) {
      // add a dotted 64th and double dotted 64th
      blockObj.splice(insertPosition, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: 'zr',
          dotted: true,
          notes: [],
          tuplet: startTuplet,
          tupletId: startTupletId,
        },
      });
      p += 1;
      insertPosition += 1;
      blockObj.splice(insertPosition, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: 'zr',
          doubleDotted: true,
          notes: [],
          tuplet: startTuplet,
          tupletId: startTupletId,
        },
      });
      p += 1;
      currentDiff -= 3.25;
    } else if ((currentDiff - Math.floor(currentDiff)) === 0.5) {
      // add a dotted 64th and double dotted 64th
      blockObj.splice(insertPosition, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: 'zr',
          dotted: true,
          notes: [],
          tuplet: startTuplet,
          tupletId: startTupletId,
        },
      });
      p += 1;
      currentDiff -= 1.5;
    } else if ((currentDiff - Math.floor(currentDiff)) === 0.75) {
      // add a double dotted 64th
      blockObj.splice(insertPosition, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: 'zr',
          doubleDotted: true,
          notes: [],
          tuplet: startTuplet,
          tupletId: startTupletId,
        },
      });
      p += 1;
      currentDiff -= 1.75;
    }

    for (let l = 0, n = currentDiff; l < n; l += 1) {
      if (currentDiff <= 0) break;
      console.log(`DIFF: ${currentDiff}`);
      // fill with greatest 2potence and fill the rest with eighths
      const nearest2Potence = Helper.getGreatestNotelengthToFit(currentDiff);
      // if note smaller 16th the block gets bigger and we have to rescale
      // if (nearest2Potence < Duration.getDurationOfType('s')) {
      //   rescaleNecessary = true;
      // }
      currentDiff -= nearest2Potence;

      blockObj.splice(p + l, 0, {
        ...Song.defaultMeasure(),
        ...{
          duration: restOf(Duration.typeToString(nearest2Potence)),
          notes: [],
          tuplet: startTuplet,
          tupletId: startTupletId,
        },
      });
    }
  }

  fillBeat(trackId: number, blockId: number, voiceId: number, beatId: number) {
    const beatObj = Song.getBeat({ trackId, blockId, voiceId, beatId });
    if (beatObj.effects == null) {
      beatObj.effects = Song.defaultMeasureEffects();
    }
    if (beatObj.tuplet != null) {
      if (this.tupletHelperCounter <= 0) {
        this.tupletIdCounter += 1;

        // add notes until the note is dividable by tuplet
        const startTuplet = beatObj.tuplet;
        let durationSum = 0;
        let numNotes = 0;
        let breakPoint = 0;
        let distanceBetweenNumNotesAndTupletLength = 999999;

        for (let j = beatId, n = Song.measures[trackId][blockId][voiceId].length; j < n; j += 1) {
          const note = Song.getBeat({ trackId, blockId, voiceId, beatId: j });
          if (note.tuplet !== startTuplet) break;
          durationSum += Duration.getDurationOfNote(note, true);
          numNotes += 1;
          if (durationSum % startTuplet === 0) { // is an option, look for better tuplets
            if (distanceBetweenNumNotesAndTupletLength > Math.abs(startTuplet - numNotes)) {
              distanceBetweenNumNotesAndTupletLength = Math.abs(startTuplet - numNotes);
              breakPoint = numNotes;
            }
          }
        }

        this.tupletHelperCounter = breakPoint;
        this.tupletManager[this.tupletIdCounter] = { originalDuration: '' };
        // TODO can this be 1.5 or so???
        const durationType = Math.round((durationSum / startTuplet) * 2);
        this.tupletManager[
          this.tupletIdCounter].originalDuration = Duration.typeToString(durationType);
      }
      beatObj.tupletId = this.tupletIdCounter;
      this.tupletHelperCounter -= 1;
    }
    return Duration.getDurationOfNote(Song.getBeat({ trackId, blockId, voiceId, beatId }), false);
  }

  // changes duration of given beat and adapts the complete measure to fit the new duration
  changeBeatDuration(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    newDuration: number, previousDuration: number, noteLength: BeatDuration,
  ) {
    const blockObj = Song.measures[trackId][blockId][voiceId];
    const isTuplet = blockObj[beatId].tuplet != null;

    if (!isTuplet) {
      // Delegate to DurationReplacer for clean, tested logic
      const numStrings = Song.tracks[trackId].numStrings;
      const result = changeBeatDurationViaReplacer(
        trackId, blockId, voiceId, beatId, numStrings, noteLength,
      );
      if (!result.success) {
        AppManager.showNotification('Not enough space in the bar.', 'error');
        return false;
      }
      return result.rescaleNeeded;
    }

    // Tuplet path — kept as-is for now (complex tuplet-specific rules)
    let rescaleNecessary = false;
    if (newDuration < previousDuration) {
      let diff = previousDuration - newDuration;
      blockObj[beatId].duration = noteLength;
      let preNotes = 1;

      const tupletIdToSearchFor = blockObj[beatId].tupletId;
      let startSearchIndex = 0;
      let endSearchIndex = blockObj.length;
      let isFirst = true;
      for (let w = 0; w < blockObj.length; w += 1) {
        if (blockObj[w].tuplet != null && blockObj[w].tupletId === tupletIdToSearchFor) {
          if (isFirst) {
            startSearchIndex = w;
            isFirst = false;
          }
        } else if (!isFirst) {
          endSearchIndex = w;
          break;
        }
      }

      // Handle fractional tick remainders
      const EPS = 1e-9;
      const frac = diff - Math.floor(diff + EPS);

      if (Math.abs(frac - 0.5) < EPS) {
        let noteFound = false;
        for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
          if (w !== beatId && Math.abs(Duration.getDurationOfNote(blockObj[w], true) - 1.5) < EPS) {
            blockObj[w].doubleDotted = false;
            blockObj[w].dotted = false;
            noteFound = true;
            break;
          }
        }
        if (noteFound) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], false, false);
          diff = Math.floor(diff + EPS);
          preNotes += 1;
        } else if (previousDuration >= newDuration + 1.5 - EPS) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], true, false);
          diff = previousDuration - (newDuration + 1.5);
          preNotes += 1;
        } else {
          return false;
        }
      } else if (Math.abs(frac - 0.75) < EPS) {
        let noteFound = false;
        for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
          if (w !== beatId && Math.abs(Duration.getDurationOfNote(blockObj[w], true) - 1.75) < EPS) {
            blockObj[w].doubleDotted = false;
            blockObj[w].dotted = true;
            noteFound = true;
            break;
          }
        }
        if (noteFound) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], false, false);
          diff = Math.floor(diff + EPS);
          preNotes += 1;
        } else if (previousDuration >= newDuration + 1.75 - EPS) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], false, true);
          diff = previousDuration - (newDuration + 1.75);
          preNotes += 1;
        } else {
          return false;
        }
      } else if (Math.abs(frac - 0.25) < EPS) {
        let noteFound = false;
        for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
          if (w !== beatId && Math.abs(Duration.getDurationOfNote(blockObj[w], true) - 1.75) < EPS) {
            blockObj[w].doubleDotted = false;
            blockObj[w].dotted = false;
            noteFound = true;
            break;
          }
        }
        if (noteFound) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], false, false);
          diff = Math.floor(diff + EPS);
          preNotes += 1;
        } else if (previousDuration >= newDuration + 3.25 - EPS) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], true, false);
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', true, blockObj[beatId], false, true);
          diff = previousDuration - (newDuration + 3.25);
          preNotes += 2;
        } else {
          return false;
        }
      }

      for (let l = 0, n = diff; l < n; l += 1) {
        if (diff <= 0) break;
        const nearest2Potence = Helper.getGreatestNotelengthToFit(diff);
        if (nearest2Potence <= Duration.getDurationOfType('s')) {
          rescaleNecessary = true;
        }
        diff -= nearest2Potence;

        Tab.addNoteToBlock(
          trackId, blockId, voiceId, beatId + preNotes + l,
          restOf(Duration.typeToString(nearest2Potence)),
          true, blockObj[beatId], false, false,
        );
      }
    } else if (newDuration === previousDuration) {
      blockObj[beatId].duration = noteLength;
    } else {
      const startTupletId = blockObj[beatId].tupletId;
      const diff = newDuration - previousDuration;
      if (previousDuration <= Duration.getDurationOfType('s')
        && newDuration > Duration.getDurationOfType('s')
      ) {
        rescaleNecessary = true;
      }
      let reachedSpace = 0;
      for (let p = beatId + 1; p < blockObj.length; p += 1) {
        if (reachedSpace >= diff) break;
        if (blockObj[p].tuplet == null || blockObj[p].tupletId !== startTupletId) {
          break;
        } else if (blockObj[p].duration.length !== 1) {
          reachedSpace += Duration.getDurationOfNote(blockObj[p], true);
        }
      }
      if (reachedSpace >= diff) {
        blockObj[beatId].duration = AppManager.typeOfNote;
        Tab.deleteRestForTuplet(trackId, blockId, voiceId, beatId, diff);
        rescaleNecessary = true;
      } else {
        AppManager.showNotification('Not enough space in the bar.', 'error');
      }
    }
    // set to rest if no note is set
    let isRest = true;
    for (let i = 0; i < Song.tracks[trackId].numStrings; i += 1) {
      if (blockObj[beatId].notes[i] != null) {
        isRest = false;
        break;
      }
    }
    if (isRest && blockObj[beatId].duration.length < 2) {
      blockObj[beatId].duration += 'r';
    }
    return rescaleNecessary;
  }

  redrawCompleteTrack(trackId: number) {
    // Set to rest where no notes are available
    for (let blockId = 0; blockId < Song.measures[trackId].length; blockId += 1) {
      for (let voiceId = 0; voiceId < Song.measures[trackId][blockId].length; voiceId += 1) {
        for (let beatId = 0; beatId < Song.measures[trackId][
          blockId][voiceId].length; beatId += 1) {
          const { notes } = Song.getBeat({ trackId, blockId, voiceId, beatId });
          if (notes != null) {
            let isRest = true;
            for (let i = 0; i < Song.tracks[trackId].numStrings; i += 1) {
              if (notes[i] != null) {
                isRest = false;
                break;
              }
            }
            const beat = Song.getBeat({ trackId, blockId, voiceId, beatId });
            if (isRest) {
              beat.duration = restOf(beat.duration);
            } else {
              beat.duration = noteLengthOf(beat.duration);
            }
          }
        }
      }
    }

    for (let j = 0; j < Song.numVoices; j += 1) {
      this.createMeasures(trackId, j);
      this.fillMeasures(trackId, j);
    }
    AppManager.setTimeMeterToAllTracks();

    // Set default marking
    if (trackId === Song.currentTrackId) {
      this.drawTrack(trackId, Song.currentVoiceId, false, null);

      const img = document.getElementById('trackSignImg') as HTMLImageElement;
      img.src = Helper.getIconSrc(Song.playBackInstrument[trackId].instrument);
      // visualInstruments.createGuitar(Song.tracks[trackId].strings.length, 25);
    }
    // draw suitable sequencer
    sequencerHandler.drawBeat();
  }

  fillMeasures(trackId: number, voiceId: number) {
    const numBlocks = Song.measures[trackId].length;
    for (let blockId = 0; blockId < numBlocks; blockId += 1) {
      this.fillMeasure(trackId, blockId, voiceId);
    }
  }

  fillMeasure(trackId: number, blockId: number, voiceId: number) {
    const beatLength = Song.measures[trackId][blockId][voiceId].length;
    for (let beatId = 0; beatId < beatLength; beatId += 1) {
      this.fillBeat(trackId, blockId, voiceId, beatId);
    }
  }

  static addNoteToBlock(
    trackId: number, blockId: number, voiceId: number, newBeatId: number,
    duration: BeatDuration, isTuplet: boolean, beat: Beat, dotted: boolean, doubleDotted: boolean,
  ) {
    addNoteToBlockCommand(
      trackId, blockId, voiceId, newBeatId, duration, isTuplet, beat, dotted, doubleDotted,
    );
  }

  static tupletOnlyRests(
    startBeatId: number, blockObj: {tuplet: number | null, duration: BeatDuration}[],
  ) {
    return tupletOnlyRestsCommand(startBeatId, blockObj);
  }

  static fillAvailableSpaceWithRests(
    trackId: number, blockId: number, voiceId: number, startBeatId: number,
    durationLengthIn: number,
  ) {
    let durationLength = durationLengthIn;
    for (let l = 0, n = durationLength; l < n; l += 1) {
      if (durationLength <= 0) break;
      // console.log("DIFF: "+durationLength);
      // fill with greatest 2potence and fill the rest with eighths
      const nearest2Potence = Helper.getGreatestNotelengthToFit(durationLength);
      durationLength -= nearest2Potence;
      Song.setBeat(trackId, blockId, voiceId, startBeatId + l, restOf(Duration.typeToString(nearest2Potence)));
    }
  }

  changeNoteDuration(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteLength: BeatDuration, duringRevert: boolean,
  ) {
    return changeNoteDurationCommand(
      this, trackId, blockId, voiceId, beatId, string, noteLength, duringRevert,
    );
  }

  drawTrack(trackId: number, voiceId: number, forceScale: boolean, callback: (() => void) | null) {
    this.drawTrackMain(trackId, voiceId, forceScale, callback);
  }

  drawTrackMain(
    trackId: number,
    voiceId: number,
    _forceScale: boolean,
    callback: (() => void) | null,
  ) {
    invalidateTrackLayout(this, trackId, voiceId, callback);
  }

  initRowArrays(trackId: number, voiceId: number) {
    if (this.finalBlockWidths[trackId] == null) {
      this.finalBlockWidths[trackId] = [];
    }
    if (this.blocksPerRow[trackId] == null) {
      this.blocksPerRow[trackId] = [];
    }
    if (this.blockToRow[trackId] == null) {
      this.blockToRow[trackId] = [];
    }
    if (this.heightOfBlock[trackId] == null) {
      this.heightOfBlock[trackId] = [];
    }
    this.heightOfBlock[trackId][voiceId] = [];
  }

  trackRerenderNecessary(trackId: number, blockId: number, voiceId: number): boolean {
    if (Settings.vexFlowIsActive) {
      classicalNotation.convertBlockToNotation(trackId, blockId, voiceId);
    }
    if (!this.allWidths[blockId]) {
      return true;
    }
    let completeRerenderNecessary = Math.abs(this.allWidths[blockId].minWidth
      - Tab.computeWidthOfBlock(trackId, blockId, voiceId).minWidth) > Settings.EPSILON;
    if (completeRerenderNecessary) {
      const { rowId } = this.blockToRow[trackId][voiceId][blockId];
      const oldMapping = this.blocksPerRow[trackId][voiceId][rowId];
      recomputeTrackLayoutFromSong(trackId, voiceId, getAvailableRowWidth());
      completeRerenderNecessary = oldMapping.start
        !== this.blocksPerRow[trackId][voiceId][rowId].start
        || oldMapping.end !== this.blocksPerRow[trackId][voiceId][rowId].end;
    }
    return completeRerenderNecessary;
  }

  /**
   * [computeWidthOfBlock computes Width of a specified block]
   * @param  {[int]} trackId
   * @param  {[int]} blockId
   * @return {[int,int,int]}         [width of measure, offset, padding]
  */
  static computeWidthOfBlock(trackId: number, blockId: number, voiceId: number) {
    let padding = Helper.OFFSET_LEFT() * 2;
    if (Song.measureMeta[blockId].repeatOpen) {
      padding += 20;
    }
    if (Song.measureMeta[blockId].repeatClose != null) {
      padding += 10;
    }
    if (blockId === 0 || Song.measureMeta[blockId].bpm != null) {
      padding += 43;
      if ((`${Song.measureMeta[blockId].bpm}`).length > 2) {
        padding += 8;
      }
    } else if (blockId === 0 || Song.measureMeta[blockId].timeMeterPresent) {
      padding += 10;
    }

    // run over all notes and get biggest size
    // Consider: Bend (width += 25), TremoloBar (width = 25), PalmMute (width = 20),
    // Trill (width = 13), note (width = 17), harmonic (width = 22),
    // stroke (width = 25 (note + arrow))
    // Varibale lengths: chords, texts & marker (not bigger than measure)
    const BASIC_OFFSET = 20;
    let minOffsetPerNote = 25;
    let numOf16th = 0;
    const block = Song.measures[trackId][blockId][voiceId];
    if (block == null) {
      console.log(`${trackId} ${blockId} ${voiceId}`);
    }

    for (let beatId = 0, n = block.length; beatId < n; beatId += 1) {
      // check beat effects
      const beat = block[beatId];
      const beatIn16ths = Duration.getDurationWidth(beat);
      numOf16th += beatIn16ths;

      if (beat.effects != null) {
        if ((beat.effects.stroke != null || beat.effects.tremoloBar != null) && beatIn16ths === 1) {
          minOffsetPerNote = Math.max(minOffsetPerNote, BASIC_OFFSET + 5);
        }
      }
      // check note effects
      if (beat.notes != null) {
        for (let string = 0, w = beat.notes.length; string < w; string += 1) {
          const note = beat.notes[string];
          if (note != null) {
            if (note.bendObj != null && beatIn16ths === 1) {
              minOffsetPerNote = Math.max(minOffsetPerNote, BASIC_OFFSET + 17);
            }
          }
        }
      }
      /* if(Settings.vexFlowIsActive && beatIn16ths == 1){
          minOffsetPerNote = Math.max(minOffsetPerNote, vexFlowOffset[beatId]- 5);
          //-5 for assumed right side :)
      } */
    }
    if (Settings.vexFlowIsActive) {
      const vexFlowOffset = classicalNotation.calculateLargestBeatWidth(trackId, blockId, voiceId);
      if (Number.isFinite(vexFlowOffset) && vexFlowOffset > minOffsetPerNote) {
        minOffsetPerNote = vexFlowOffset;
      }
    }
    const minWidth = numOf16th * minOffsetPerNote + padding;
    return {
      minWidth, minOffset: minOffsetPerNote, num16ths: numOf16th, padding,
    };
  }

  assignBlocksToRows(trackId: number, voiceId: number) {
    recomputeTrackLayoutFromSong(trackId, voiceId, getAvailableRowWidth());
  }

  static deleteNote(
    trackId: number, blockId: number, voiceId: number,
    beatId: number, string: number, calledDuringRestore: boolean,
  ) {
    deleteNoteCommand(trackId, blockId, voiceId, beatId, string, calledDuringRestore);
  }

  // hierarchy - 1: Marker, 2: Beat Text, 3: Repeat Alternative, 4: Chord, 5: Rest of effects
  computeHeightOfBlock(trackId: number, blockId: number, voiceId: number): number {
    let maxHeight = this.applyBeatAndNoteEffects(trackId, blockId, voiceId)
      * Settings.OVERBAR_ROW_HEIGHT;
    maxHeight += Settings.OVERBAR_ROW_HEIGHT;
    if (Song.measureMeta[blockId].repeatAlternative != null) {
      maxHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (Song.measureMeta[blockId].marker != null) {
      maxHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    this.heightOfBlock[trackId][voiceId][blockId] = maxHeight;
    return maxHeight;
  }

  applyBeatAndNoteEffects(trackId: number, blockId: number, voiceId: number) {
    let rowOverBarHeight = 0;
    if (this.blockToRow != null && this.blockToRow[trackId] != null
      && this.blockToRow[trackId][voiceId] != null) {
      rowOverBarHeight = Helper.getNumberOfOverbarRows(
        trackId, voiceId, this.blockToRow[trackId][voiceId][blockId].rowId,
      ).numberOfOverbarRows;
    }
    return rowOverBarHeight;
  }
}

const tab = new Tab();
export { tab, Tab };
export default Tab;
