import fastdom from 'fastdom';
import Song, { Measure } from './songData';
import { sequencer } from './sequencer';
import { svgDrawer } from './svgDrawer';
import { revertHandler } from './revertHandler';
import AppManager from './appManager';
import Duration from './duration';
import Helper from './helper';
import Settings from './settingManager';
import { classicalNotation } from './vexflowClassical';
import { overlayHandler } from './overlayHandler';

import Menu from '../../components/Menu.vue';

class Tab {
  menu: typeof Menu;

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

  tupletManager: {originalDuration: string}[];

  blocksPerRow: {start: number, end: number}[][][];

  heightOfBlock: number[][][];

  allWidths: {minWidth: number, minOffset: number, num16ths: number}[];

  blockToRow: {rowId: number, numInRow: number}[][][];

  finalBlockWidths: number[][][];

  drawTrackCall: [number, number, boolean, (() => void) | null] | null;

  constructor(menu: typeof Menu) {
    this.menu = menu;

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
      const parent = document.getElementById('mainContent');
      const svgTestAreaDom = document.getElementById('svgTestArea');
      const complateTabDom = document.getElementById('completeTab');
      if (parent != null) {
        const scrollPosBefore = parent.scrollTop;
        svgTestAreaDom!.style.transform = `scale(${this.currentZoom})`;
        complateTabDom!.style.width = `${this.currentZoom * 31.5}cm`;
        parent.scrollLeft = (parent.scrollWidth - parent.clientWidth) / 2;
        const scrollTopPos = scrollPosBefore * (this.currentZoom / beginZoom);
        parent.scrollTop = scrollTopPos;
        svgDrawer.setScrollTop(scrollTopPos);
      }
    }
  }

  addBlock(duringRestoration: boolean) {
    if (AppManager.duringTrackCreation) {
      return;
    }
    const blockId = Song.numMeasures;
    for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
      for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
        this.addTakt(trackId, blockId, voiceId);
        Song.initEmptyMeasure(trackId, blockId, voiceId);
        this.fillMeasure(trackId, blockId, voiceId);
        svgDrawer.setDurationsOfBlock(trackId, blockId, voiceId);
      }
    }
    Song.measureMeta[blockId].numerator = Song.measureMeta[blockId - 1].numerator;
    Song.measureMeta[blockId].denominator = Song.measureMeta[blockId - 1].denominator;
    Song.numMeasures += 1;
    this.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
    sequencer.redrawSequencerMain();
    if (duringRestoration === false) {
      revertHandler.addBlock();
    }
  }

  removeBlock(duringRestoration: boolean) {
    if (AppManager.duringTrackCreation) {
      return;
    }
    fastdom.mutate(() => {
      if (Song.numMeasures <= 1) return;
      const blocksBefore: Measure[][][] = [];
      Song.numMeasures -= 1;
      if (this.markedNoteObj != null) {
        if (this.markedNoteObj.blockId === Song.numMeasures) {
          this.markedNoteObj.blockId -= 1;
          this.markedNoteObj.beatId = 0;
        }
      }
      for (let i = 0; i < Song.measures.length; i += 1) {
        blocksBefore.push(Song.measures[i].splice(-1)[0]);
      }
      const measureMetaBefore = Song.measureMeta.splice(-1)[0];
      this.drawTrack(Song.currentTrackId, Song.currentVoiceId, true, null);
      sequencer.redrawSequencerMain();
      if (duringRestoration === false) {
        revertHandler.removeBlock(blocksBefore, measureMetaBefore);
      }
    });
  }

  addTakt(trackId: number, blockId: number, voiceId: number) {
    if (this.measureOffset[trackId][blockId] == null) {
      this.measureOffset[trackId][blockId] = [];
    }
    // Default value, will be overwritten on change
    this.measureOffset[trackId][blockId][voiceId] = 20;
  }

  /**
   * [initializes measureOffset array]
   * @param  {int} trackId [description]
  */
  createTakte(trackId: number, voiceId: number) {
    if (this.measureOffset[trackId] == null) {
      this.measureOffset[trackId] = [];
    }
    for (let i = 0; i < Song.numMeasures; i += 1) {
      this.addTakt(trackId, i, voiceId);
    }
  }

  createNewTrack(
    trackId: number,
    instrObj: {name: string, channel: number, numStrings: number, strings: number[]},
  ) {
    let channelId = (trackId >= 9) ? trackId + 1 : trackId;
    if (instrObj.name === 'Drums') {
      channelId = 9;
    }
    Song.allChannels[channelId] = {
      cInstrument: instrObj.channel,
      volume: 127,
      balance: 63,
      chorus: 0,
      reverb: 0,
      phaser: 0,
      tremolo: 0,
    };
    Song.tracks[trackId] = {
      numStrings: instrObj.numStrings,
      strings: instrObj.strings,
      capo: 0,
      volume: 127,
      balance: 63,
      reverb: 0,
      name: instrObj.name,
      color: { red: 0, blue: 127, green: 0 },
      channel: { index: channelId, effectChannel: 0 },
      program: 0,
      primaryChannel: 0,
      letItRing: false,
    };

    Song.measures[trackId] = [];
    Song.measureMoveHelper[trackId] = [];

    for (let i = 0; i < Song.numMeasures; i += 1) {
      for (let j = 0; j < Song.numVoices; j += 1) {
        Song.initEmptyMeasure(trackId, i, j);
      }
    }
    this.createTakte(trackId, 0);
    AppManager.setTracks(trackId);
  }

  static initEmptyTab() {
    Song.measureMoveHelper.length = 0;
    Song.measureMoveHelper[0] = [];

    for (let i = 0; i < Song.numMeasures; i += 1) {
      for (let j = 0; j < Song.numVoices; j += 1) {
        Song.initEmptyMeasure(0, i, j);
      }
    }
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
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
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
    beat.duration = beat.duration[0];

    // only draw when current track is visible
    if (trackId === Song.currentTrackId && voiceId === Song.currentVoiceId) {
      this.menu.enableNoteEffectButtons();
      svgDrawer.setDurationsOfBlock(trackId, blockId, voiceId);
      svgDrawer.rerenderBlock(trackId, blockId, voiceId);
    }
    if (redrawSequencer) {
      sequencer.redrawSequencerMain();
    }
    if (calledDuringRestore == null && this.markedNoteObj != null) {
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
          alert('Not enough space in the bar!');
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
          alert('Not enough space in the bar!');
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
        alert('Tuplets of dotted notes or 128ths are currently not possible');
        return false;
      }
      // set note to new length
      beat.tuplet = tupletSelection;

      // fill in the new tuplet rests after the first tuplet note
      const thisTupletId = this.tupletId;
      const subFactor = Duration.tupletToNumOfSubstitutedNotes(tupletSelection);
      // we place a tuplet with half length
      let newDuration = Duration.typeToString(currentDuration / subFactor);
      // set own note to new length
      const oldDuration = beat.duration;
      if (oldDuration.length > 1) {
        beat.duration = `${newDuration}r`;
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
        newDuration += 'r';
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
      const nextBeat = Song.measures[trackId][blockId][voiceId][beatId];
      const tupletIdToSearchFor = nextBeat.tupletId;
      nextBeat.duration = this.tupletManager[nextBeat.tupletId].originalDuration;
      // dont keep dot if tuplet is eliminated
      nextBeat.dotted = false;
      nextBeat.doubleDotted = false;
      nextBeat.tuplet = -1;
      nextBeat.tupletId = -1;

      // TODO fix Mark of false position
      // delete all beats with same tupletId
      for (let i = 0; i < Song.measures[trackId][blockId][voiceId].length; i += 1) {
        const beatIn = Song.measures[trackId][blockId][voiceId][i];
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
    this.menu.setNoteLengthForMark(trackId, blockId, voiceId, beatId, this.markedNoteObj.string);

    const tupletDom = document.getElementById('tuplet');
    tupletDom?.classList.toggle('pressed');
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
      // MOVE NOTES RIGHT
      if (blockObj[beatId].duration.length !== 1) {
        if (blockObj[beatId].tuplet != null) {
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
          reachedSpace += Duration.getDurationOfNote(blockObj[beatId], false);
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
          duration: `${Duration.typeToString(nearest2Potence)}r`,
          notes: [],
          tuplet: startTuplet,
          tupletId: startTupletId,
        },
      });
    }
  }

  fillBeat(trackId: number, blockId: number, voiceId: number, beatId: number) {
    const beatObj = Song.measures[trackId][blockId][voiceId][beatId];
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
          const note = Song.measures[trackId][blockId][voiceId][j];
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
    return Duration.getDurationOfNote(Song.measures[trackId][blockId][voiceId][beatId], false);
  }

  // changes duration of given beat and adapts the complete measure to fit the new duration
  changeBeatDuration(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    newDuration: number, previousDuration: number, noteLength: string,
  ) {
    let rescaleNecessary = false;
    const blockObj = Song.measures[trackId][blockId][voiceId];

    let isTuplet = false;
    if (blockObj[beatId].tuplet != null) {
      isTuplet = true;
    }

    if (newDuration < previousDuration) {
      let diff = previousDuration - newDuration;
      // substitute one in array through
      blockObj[beatId].duration = noteLength;
      // SPECIAL CASES
      let preNotes = 1;

      let startSearchIndex = 0;
      let endSearchIndex = blockObj.length;

      if (isTuplet) {
        const tupletIdToSearchFor = blockObj[beatId].tupletId;
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
      }

      // CASES: dd64th to dd32th,  d64 to d32
      if (diff - Math.floor(diff) === 0.5) {
        // Option 1: find d64 remove dot and add 64r - WORKS
        // Option 2: find two dd64, make them d and add 64r
        // Option 3: find dd32, make it d and add 64r
        // Option 4: from 3->1.5
        let noteFound = false;
        // OPTION 1
        for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
          if (w !== beatId && Duration.getDurationOfNote(blockObj[w], true) === 1.5) {
            blockObj[w].doubleDotted = false;
            blockObj[w].dotted = false;
            noteFound = true;
            break;
          }
        }
        if (!noteFound) {
          // OPTION 2
          let found64dd = 0;
          for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
            if (w !== beatId && Duration.getDurationOfNote(blockObj[w], true) === 1.75) {
              found64dd += 1;
              if (found64dd >= 2) {
                break;
              }
            }
          }
          if (found64dd >= 2) {
            found64dd = 0;
            for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
              if (w !== beatId && Duration.getDurationOfNote(blockObj[w], true) === 1.75) {
                found64dd += 1;
                blockObj[w].doubleDotted = false;
                blockObj[w].dotted = true;
                if (found64dd >= 2) {
                  noteFound = true;
                  break;
                }
              }
            }
          }
          if (!noteFound) {
            // Option 3: find dd32, make it d and add 64r
            for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
              if (w !== beatId && Duration.getDurationOfNote(blockObj[w], true) === 3.5) {
                blockObj[w].doubleDotted = false;
                blockObj[w].dotted = true;
                noteFound = true;
                break;
              }
            }
          }
        }
        if (noteFound) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', isTuplet, blockObj[beatId], false, false);
          diff = Math.floor(diff);
          preNotes += 1;
          // Option 4: 3->1.5
        } else if (previousDuration >= newDuration + 1.5) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', isTuplet, blockObj[beatId], true, false);
          diff = previousDuration - (newDuration + 1.5);
          preNotes += 1;
        } else {
          console.log('Could not find suitable note. Error!');
          return false;
        }
      } else if (diff - Math.floor(diff) === 0.75) {
        // find dd64 make it a d64 and add 64r
        let noteFound = false;
        for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
          if (w !== beatId && Duration.getDurationOfNote(blockObj[w], true) === 1.75) {
            blockObj[w].doubleDotted = false;
            blockObj[w].dotted = true;
            noteFound = true;
            break;
          }
        }
        if (noteFound) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', isTuplet, blockObj[beatId], false, false);
          diff = Math.floor(diff);
          preNotes += 1;
        } else if (previousDuration >= newDuration + 1.75) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', isTuplet, blockObj[beatId], false, true);
          diff = previousDuration - (newDuration + 1.75);
          preNotes += 1;
        } else {
          console.log('Could not find suitable note. Error!');
          return false;
        }
      } else if (diff - Math.floor(diff) === 0.25) {
        // find dd64 make it a 64 and add 64r
        let noteFound = false;
        for (let w = startSearchIndex; w < endSearchIndex; w += 1) {
          if (w !== beatId && Duration.getDurationOfNote(blockObj[w], true) === 1.75) {
            blockObj[w].doubleDotted = false;
            blockObj[w].dotted = false;
            noteFound = true;
            break;
          }
        }
        if (noteFound) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', isTuplet, blockObj[beatId], false, false);
          diff = Math.floor(diff);
          preNotes += 1;
          // e.g. 16dd -> 64dd
        } else if (previousDuration >= newDuration + 3.25) {
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', isTuplet, blockObj[beatId], true, false);
          Tab.addNoteToBlock(trackId, blockId, voiceId, beatId + 1, 'zr', isTuplet, blockObj[beatId], false, true);
          diff = previousDuration - (newDuration + 3.25);
          preNotes += 2;
        } else {
          console.log('Could not find suitable note. Error!');
          return false;
        }
      }

      // prevent unnecessary while-loop
      for (let l = 0, n = diff; l < n; l += 1) {
        if (diff <= 0) {
          break;
        }
        // fill with greatest 2potence
        const nearest2Potence = Helper.getGreatestNotelengthToFit(diff);
        // if note smaller 16th the block gets bigger and we have to rescale
        if (nearest2Potence <= Duration.getDurationOfType('s')) {
          rescaleNecessary = true;
        }
        diff -= nearest2Potence;

        Tab.addNoteToBlock(
          trackId, blockId, voiceId, beatId + preNotes + l,
          `${Duration.typeToString(nearest2Potence)}r`,
          isTuplet, blockObj[beatId], false, false,
        );
      }
    } else if (newDuration === previousDuration) {
      blockObj[beatId].duration = noteLength;
    } else if (!isTuplet) {
      // new duration is longer than previous duration
      // check if so many rests can be deleted that note length is reached
      const diff = newDuration - previousDuration;
      if (previousDuration <= Duration.getDurationOfType('s')
        && newDuration > Duration.getDurationOfType('s')
      ) {
        rescaleNecessary = true;
      }
      console.log('DIFF2: ', diff);
      blockObj[beatId].duration = noteLength;
      this.deleteRestAndFillNote(trackId, blockId, voiceId, beatId, diff);
      rescaleNecessary = true;
    } else {
      const startTupletId = blockObj[beatId].tupletId;
      // new duration is longer than previous duration
      // check if so many rests can be deleted that note length is reached
      const diff = newDuration - previousDuration;
      if (previousDuration <= Duration.getDurationOfType('s')
        && newDuration > Duration.getDurationOfType('s')
      ) {
        rescaleNecessary = true;
      }
      let reachedSpace = 0;
      for (let p = beatId + 1; p < blockObj.length; p += 1) {
        if (reachedSpace >= diff) break;
        // check for rests that can be deleted
        if (blockObj[p].tuplet == null || blockObj[p].tupletId !== startTupletId) {
          break;
        } else if (blockObj[p].duration.length !== 1) {
          reachedSpace += Duration.getDurationOfNote(blockObj[p], true);
        }
      }
      // console.log(reachedSpace+" "+ diff);
      if (reachedSpace >= diff) {
        blockObj[beatId].duration = AppManager.typeOfNote;
        Tab.deleteRestForTuplet(trackId, blockId, voiceId, beatId, diff);
        rescaleNecessary = true;
      } else {
        alert('Not enough space in the bar!');
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
          const { notes } = Song.measures[trackId][blockId][voiceId][beatId];
          if (notes != null) {
            for (let m = 0; m < 8; m += 1) {
              if (notes[m] != null) {
                notes[m]!.noteDrawn = null;
              }
            }
          }
          let isRest = true;
          for (let i = 0; i < Song.tracks[trackId].numStrings; i += 1) {
            if (notes[i] != null) {
              isRest = false;
              break;
            }
          }
          const beat = Song.measures[trackId][blockId][voiceId][beatId];
          if (isRest && beat.duration.length < 2) {
            beat.duration += 'r';
          } else if (!isRest) {
            // eslint-disable-next-line prefer-destructuring
            beat.duration = beat.duration[0];
          }
        }
      }
    }

    for (let j = 0; j < Song.numVoices; j += 1) {
      this.createTakte(trackId, j);
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
    sequencer.drawBeat();
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
    duration: string, isTuplet: boolean, beat: Measure, dotted: boolean, doubleDotted: boolean,
  ) {
    const blockObj = Song.measures[trackId][blockId][voiceId];
    Song.setBeat(trackId, blockId, voiceId, newBeatId, duration);
    blockObj[newBeatId].dotted = dotted;
    blockObj[newBeatId].doubleDotted = doubleDotted;
    if (isTuplet) {
      blockObj[newBeatId].tuplet = beat.tuplet;
      blockObj[newBeatId].tupletId = beat.tupletId;
    }
  }

  static tupletOnlyRests(
    startBeatId: number, blockObj: {tuplet: number | null, duration: string}[],
  ) {
    let lastIndex = startBeatId;
    let onlyRests = true;
    for (let x = startBeatId; x < blockObj.length; x += 1) {
      if (blockObj[x].tuplet == null) {
        break;
      }
      if (blockObj[x].duration.length === 1) {
        onlyRests = false;
      }
      lastIndex += 1;
    }
    return { lastIndex: lastIndex - 1, onlyRests };
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
      Song.setBeat(trackId, blockId, voiceId, startBeatId + l, `${Duration.typeToString(nearest2Potence)}r`);
    }
  }

  changeNoteDuration(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteLength: string, duringRevert: boolean,
  ) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    const previousDuration = Duration.getDurationOfNote(beat, true);
    // trick to get duration with all additional effects (dots, ...)
    const previousDur = beat.duration;
    beat.duration = noteLength;
    const newDuration = Duration.getDurationOfNote(beat, true);
    beat.duration = previousDur;

    if (!this.isNotePlaceable(
      trackId, blockId, voiceId, beatId, string, newDuration, previousDuration,
    )) {
      return false;
    }
    const measureBefore = JSON.parse(JSON.stringify(Song.measures[trackId][blockId][voiceId]));

    overlayHandler.initOverlay(trackId, blockId, voiceId, beatId);

    this.changeBeatDuration(
      trackId, blockId, voiceId, beatId, string, newDuration, previousDuration, noteLength,
    );
    svgDrawer.setDurationsOfBlock(trackId, blockId, voiceId);
    this.menu.showAvailableTupletSizes(newDuration);

    if (this.trackRerenderNecessary(trackId, blockId, voiceId)) {
      this.drawTrack(trackId, voiceId, true, null);
    } else {
      svgDrawer.rerenderRow(trackId, voiceId, this.blockToRow[trackId][voiceId][blockId].rowId);
      if (Settings.vexFlowIsActive) {
        classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId);
      }
      svgDrawer.renderOverBar(trackId, blockId, voiceId, false);
    }

    if (duringRevert === false) {
      const measureAfter = JSON.parse(JSON.stringify(Song.measures[trackId][blockId][voiceId]));
      revertHandler.addNoteLengthChange(trackId, blockId, voiceId, measureBefore, measureAfter);
    }
    return true;
  }

  drawTrack(trackId: number, voiceId: number, forceScale: boolean, callback: (() => void) | null) {
    const svgWidth = svgDrawer.completeWidth;
    const svgHeight = document.getElementById('completeTab')!.offsetHeight;
    this.drawTrackMain(trackId, voiceId, forceScale, svgWidth, svgHeight, callback);
  }

  drawTrackMain(
    trackId: number, voiceId: number, forceScale: boolean, width: number,
    height: number, callback: (() => void) | null,
  ) {
    console.trace('Draw track called');
    if (AppManager.duringTrackCreation) {
      // Reschedule, we do not want the prior drawing to disturb the new
      console.log('During creation');
      this.drawTrackCall = [trackId, voiceId, forceScale, callback];
      return;
    }
    console.log('Draw track');
    AppManager.duringTrackCreation = true;
    const classicalToggleButton = document.getElementById('classicalToggleButton') as HTMLButtonElement;
    classicalToggleButton.disabled = true;
    this.initRowArrays(trackId, voiceId);
    // even compute if not shown, so switching is quicker
    if (Settings.vexFlowIsActive) {
      classicalNotation.computeVexFlowDataStructures(trackId, voiceId);
    }
    this.assignBlocksToRows(trackId, voiceId);

    const BLOCK_HEIGHT = svgDrawer.getBlockHeight(trackId);
    for (let rowId = 0; rowId < svgDrawer.numRows; rowId += 1) {
      let maxHeight = -1;
      const rowStart = this.blocksPerRow[trackId][voiceId][rowId].start;
      const rowEnd = this.blocksPerRow[trackId][voiceId][rowId].end;
      for (let blockId = rowStart; blockId < rowEnd; blockId += 1) {
        maxHeight = Math.max(maxHeight, this.computeHeightOfBlock(trackId, blockId, voiceId));
        svgDrawer.setDurationsOfBlock(trackId, blockId, voiceId);
      }
      svgDrawer.heightOfRow[trackId][voiceId][rowId] = maxHeight + BLOCK_HEIGHT;
    }
    svgDrawer.createTrack(trackId, voiceId, width, height, callback);
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
    if (svgDrawer.heightOfRow[trackId] == null) {
      svgDrawer.heightOfRow[trackId] = [];
    }
    svgDrawer.heightOfRow[trackId][voiceId] = [];
  }

  trackRerenderNecessary(trackId: number, blockId: number, voiceId: number): boolean {
    classicalNotation.convertBlockToNotation(trackId, blockId, voiceId);
    let completeRerenderNecessary = Math.abs(this.allWidths[blockId].minWidth
      - Tab.computeWidthOfBlock(trackId, blockId, voiceId).minWidth) > Settings.EPSILON;
    if (completeRerenderNecessary) {
      const { rowId } = this.blockToRow[trackId][voiceId][blockId];
      const oldMapping = this.blocksPerRow[trackId][voiceId][rowId];
      this.assignBlocksToRows(trackId, voiceId);
      completeRerenderNecessary = oldMapping.start
        !== this.blocksPerRow[trackId][voiceId][rowId].start
        || oldMapping.end !== this.blocksPerRow[trackId][voiceId][rowId].end;
      console.log(completeRerenderNecessary, oldMapping,
        this.blocksPerRow[trackId][voiceId][rowId]);
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
    if (Song.measureMeta[blockId].repeatClose) {
      padding += 10;
    }
    if (blockId === 0 || Song.measureMeta[blockId].bpmPresent) {
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
        if ((beat.effects.strokePresent || beat.effects.tremoloBar) && beatIn16ths === 1) {
          minOffsetPerNote = Math.max(minOffsetPerNote, BASIC_OFFSET + 5);
        }
      }
      // check note effects
      if (beat.notes != null) {
        for (let string = 0, w = beat.notes.length; string < w; string += 1) {
          const note = beat.notes[string];
          if (note != null) {
            if (note.bendPresent && beatIn16ths === 1) {
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
      minOffsetPerNote = Math.max(minOffsetPerNote, vexFlowOffset);
    }
    const minWidth = numOf16th * minOffsetPerNote + padding;
    return {
      minWidth, minOffset: minOffsetPerNote, num16ths: numOf16th, padding,
    };
  }

  assignBlocksToRows(trackId: number, voiceId: number) {
    const width = svgDrawer.completeWidth - 2 * svgDrawer.PAGE_MARGIN_SIDE;//* 19/21;
    console.log(width);
    let reachedWidth = 0;
    let groupStartIndex = 0;
    const numBlocks = Song.measures[0].length;
    let rowId = 0;
    this.allWidths.length = 0;
    this.blocksPerRow[trackId][voiceId] = [];
    this.finalBlockWidths[trackId][voiceId] = [];
    for (let blockId = 0; blockId < numBlocks; blockId += 1) {
      if (blockId === 0) {
        reachedWidth = 32; // TABBLOCK
      }
      this.allWidths[blockId] = Tab.computeWidthOfBlock(trackId, blockId, voiceId);
      if (reachedWidth + this.allWidths[blockId].minWidth > width) {
        const diff = width - reachedWidth;
        const numMeasures = blockId - groupStartIndex;
        const extraWidth = Math.floor(diff / numMeasures);

        this.blocksPerRow[trackId][voiceId][rowId] = {
          start: groupStartIndex,
          end: blockId,
        };
        for (let j = groupStartIndex; j < blockId; j += 1) {
          this.finalBlockWidths[trackId][voiceId][j] = this.allWidths[j].minWidth + extraWidth;
          this.measureOffset[trackId][j][voiceId] = this.allWidths[j].minOffset
            + extraWidth / this.allWidths[j].num16ths;
        }
        groupStartIndex = blockId;
        reachedWidth = 0;
        rowId += 1;
      }
      reachedWidth += this.allWidths[blockId].minWidth;
      this.setBlockToRow(trackId, blockId, voiceId, rowId);
    }
    // last measure
    const blockIdEnd = Song.measures[trackId].length;
    const diff = width - reachedWidth;
    const numMeasures = blockIdEnd - groupStartIndex;
    const extraWidth = Math.floor(diff / numMeasures);

    this.blocksPerRow[trackId][voiceId][rowId] = {
      start: groupStartIndex,
      end: blockIdEnd,
    };
    for (let j = groupStartIndex; j < blockIdEnd; j += 1) {
      this.finalBlockWidths[trackId][voiceId][j] = this.allWidths[j].minWidth + extraWidth;
      this.measureOffset[trackId][j][voiceId] = this.allWidths[j].minOffset
        + extraWidth / this.allWidths[j].num16ths;
    }
    console.trace(this.allWidths[0], this.blocksPerRow[0][0][0]);
    rowId += 1;
    svgDrawer.numRows = rowId;
  }

  static deleteNote(
    trackId: number, blockId: number, voiceId: number,
    beatId: number, string: number, calledDuringRestore: boolean,
  ) {
    const beatObj = Song.measures[trackId][blockId][voiceId][beatId];
    if (beatObj != null && beatObj.notes.length > 0) {
      if (beatObj.notes[string] != null) {
        const drawnNote = beatObj.notes[string]!.noteDrawn;
        if (drawnNote != null
          && drawnNote.parentNode != null
          && trackId === Song.currentTrackId
          && voiceId === Song.currentVoiceId
        ) { // null if tied
          drawnNote.parentNode.removeChild(drawnNote);
        }
        if (calledDuringRestore == null) {
          const clonedNote = JSON.parse(JSON.stringify(beatObj.notes[string]));
          const clonedEffect = JSON.parse(JSON.stringify(beatObj.effects));
          revertHandler.deleteNote(
            trackId, blockId, voiceId, beatId, string, clonedNote, clonedEffect,
          );
        }
        beatObj.notes[string] = null;
      }

      // check if ties must be removed
      let currentBlockId = blockId; let
        currentBeatId = beatId;
      if (currentBeatId + 1 >= Song.measures[trackId][currentBlockId][voiceId].length) {
        currentBlockId += 1;
        currentBeatId = 0;
      } else {
        currentBeatId += 1;
      }
      if (currentBlockId < Song.measures[trackId].length) {
        const note = Song.measures[trackId][currentBlockId][voiceId][currentBeatId].notes[string];
        if (note != null) {
          if (note.tied) {
            // recursive call until all is deleted
            Tab.deleteNote(trackId, currentBlockId, voiceId, currentBeatId, string, false);
          }
        }
      }
      let noteSet = false;
      for (let i = 0; i < Song.tracks[trackId].numStrings; i += 1) {
        if (beatObj.notes[i] != null) {
          noteSet = true;
          break;
        }
      }
      if (!noteSet) {
        beatObj.effects = Song.defaultMeasureEffects();
        // set rest
        beatObj.duration = `${beatObj.duration.charAt(0)}r`;
        beatObj.notes = [];
      }
    }
    if (Song.isBeatEmpty(trackId, blockId)) {
      sequencer.redrawSequencerMain();
    }
    if (Settings.vexFlowIsActive && trackId === Song.currentTrackId
      && voiceId === Song.currentVoiceId) {
      classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId);
    }
  }

  // hierarchy - 1: Marker, 2: Beat Text, 3: Repeat Alternative, 4: Chord, 5: Rest of effects
  computeHeightOfBlock(trackId: number, blockId: number, voiceId: number): number {
    let maxHeight = this.applyBeatAndNoteEffects(trackId, blockId, voiceId)
      * Settings.OVERBAR_ROW_HEIGHT;
    maxHeight += Settings.OVERBAR_ROW_HEIGHT;
    if (
      Song.measureMeta[blockId].repeatAlternativePresent
      && Song.measureMeta[blockId].repeatAlternative != null
    ) {
      maxHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    if (Song.measureMeta[blockId].markerPresent && Song.measureMeta[blockId].marker != null) {
      maxHeight += Settings.OVERBAR_ROW_HEIGHT;
    }
    this.heightOfBlock[trackId][voiceId][blockId] = maxHeight;
    return maxHeight;
  }

  setBlockToRow(trackId: number, blockId: number, voiceId: number, rowId: number) {
    if (this.blockToRow[trackId][voiceId] == null) {
      this.blockToRow[trackId][voiceId] = [];
    }
    let numInRow = 0;
    if (blockId !== 0 && this.blockToRow[trackId][voiceId][blockId - 1].rowId === rowId) {
      numInRow = this.blockToRow[trackId][voiceId][blockId - 1].numInRow + 1;
    }
    this.blockToRow[trackId][voiceId][blockId] = { rowId, numInRow };
  }

  applyBeatAndNoteEffects(trackId: number, blockId: number, voiceId: number) {
    let rowOverBarHeight = 0;
    if (this.blockToRow != null && this.blockToRow[trackId] != null
      && this.blockToRow[trackId][voiceId] != null) {
      // console.trace(trackId, blockId, voiceId, blockToRow);
      // blockToRow[trackId][voiceId][blockId]);
      rowOverBarHeight = Helper.getNumberOfOverbarRows(
        trackId, voiceId, this.blockToRow[trackId][voiceId][blockId].rowId,
      ).numberOfOverbarRows;
    }
    return rowOverBarHeight;
  }
}

export { Tab };
export default Tab;
