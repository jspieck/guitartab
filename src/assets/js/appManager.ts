import tinycolor from 'tinycolor2';
import fastdom from 'fastdom';
import LZString from 'lz-string';
import { tab, Tab } from './tab';
import { overlayHandler } from './overlayHandler';
import {
  Song, PlayBackInstrument, Note,
} from './songData';
import { modalHandler } from './modalHandler';
import EventBus from "./eventBus";
import { svgDrawer } from './svgDrawer';
import { visualInstruments } from './visualInstruments';
import midiEngine from './midiReceiver';
import playBackLogic from './playBackLogicNew';
import Helper from './helper';
import { numToInstr } from './instrumentData';
import { audioEngine } from './audioEngine';
import { sequencer } from './sequencer';
import Duration from './duration';
import Tuning from './tuning';

const AppManager = {
  notificationTimeOut: null as ReturnType<typeof setTimeout> | null,
  stillMouseDown: false,
  loopIntervalChanged: false,
  duringTrackCreation: false,
  typeOfNote: 'e',

  resetVariables() {
    playBackLogic.stopSong();
    Song.currentTrackId = 0;
    Song.currentVoiceId = 0;
    tab.markedNoteObj = {
      trackId: 0, voiceId: 0, blockId: 0, beatId: 0, string: 0,
    };
    tab.tupletManager.length = 0;
    overlayHandler.resetOverlays();
    playBackLogic.resetPlayBack();
  },

  showNotification(text: string) {
    const notificationLabel = document.getElementById('notificationLabel');
    if (notificationLabel) {
      notificationLabel.textContent = text;
    }
    if (this.notificationTimeOut != null) {
      clearTimeout(this.notificationTimeOut);
    }
    // Fade-in and fade-out
    let notificationEmblem = document.getElementById('notificationEmblem');
    if (notificationEmblem) {
      notificationEmblem.style.opacity = '0';
      notificationEmblem.style.transition = 'opacity 0.5s';
      notificationEmblem.style.display = 'block';
      setTimeout(() => {
        notificationEmblem!.style.opacity = '1';
      }, 0);
      this.notificationTimeOut = setTimeout(() => {
        notificationEmblem!.style.opacity = '0';
        setTimeout(() => {
          notificationEmblem!.style.display = 'none';
        }, 500);
      }, 5000);
    }
  },

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

  processKeyPress(pressedValue: string, keyCode: number) {
    const { activeElement } = document;
    const inputs = ['input', 'select', 'textarea'];
    if (activeElement && inputs.indexOf(activeElement.tagName.toLowerCase()) !== -1) {
      return;
    }
    if (this.duringTrackCreation) return;

    fastdom.mutate(() => {
      const {
        trackId, blockId, voiceId, beatId, string,
      } = tab.markedNoteObj;
      switch (pressedValue) {
        case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9': {
          const pressedNumber = parseInt(pressedValue, 10);
          this.placeNote(trackId, blockId, voiceId, beatId, string, pressedNumber);
          break;
        }
        case 'x':
          break;
        case 'w':
          EventBus.emit("menu.noteLengthSelect", {name: '#wholeNote', value: pressedValue})
          break;
        case 'h':
          EventBus.emit("menu.noteLengthSelect", {name: '#halfNote', value: pressedValue})
          break;
        case 'q':
          EventBus.emit("menu.noteLengthSelect", {name: '#4thNote', value: pressedValue})
          break;
        case 'e':
          EventBus.emit("menu.noteLengthSelect", {name: '#8thNote', value: pressedValue})
          break;
        case 's':
          EventBus.emit("menu.noteLengthSelect", {name: '#16thNote', value: pressedValue})
          break;
        case 't':
          EventBus.emit("menu.noteLengthSelect", {name: '#32ndNote', value: pressedValue})
          break;
        default:
          break;
      }
      if (keyCode === 46 || keyCode === 8) {
        const loopI = overlayHandler.getLoopingInterval();
        if (loopI == null || loopI.trackId !== Song.currentTrackId) {
          Tab.deleteNote(trackId, blockId, voiceId, beatId, string, false);
          svgDrawer.rerenderBlock(trackId, blockId, voiceId);
          svgDrawer.setDurationsOfBlock(trackId, blockId, voiceId);
        } else {
          const blocks = [];
          for (let blockIdIt = loopI.startBlock; blockIdIt <= loopI.endBlock; blockIdIt += 1) {
            const startIndex = (blockIdIt !== loopI.startBlock) ? 0 : loopI.startBeat;
            const endIndex = (blockIdIt !== loopI.endBlock)
              ? Song.measures[trackId][blockIdIt][voiceId].length - 1
              : loopI.endBeat;
            for (let beatIdIt = startIndex; beatIdIt <= endIndex; beatIdIt += 1) {
              if (Song.measures[trackId][blockIdIt][voiceId][beatIdIt].notes != null) {
                for (let stringIt = 0,
                  n = Song.measures[trackId][blockIdIt][voiceId][beatIdIt].notes.length;
                  stringIt < n; stringIt += 1) {
                  if (
                    Song.measures[trackId][blockIdIt][voiceId][beatIdIt].notes[stringIt] != null
                  ) {
                    Tab.deleteNote(trackId, blockIdIt, voiceId, beatIdIt, stringIt, false);
                  }
                }
              }
            }
            blocks.push(blockIdIt);
            svgDrawer.setDurationsOfBlock(trackId, blockIdIt, voiceId);
          }
          svgDrawer.rerenderBlocks(trackId, blocks, voiceId);
        }
        EventBus.emit("menu.activateEffectsForPos", {trackId, blockId, voiceId, beatId, string});
      }
    });
    // left = 37, up = 38, right = 39, down = 40
    if (keyCode >= 37 && keyCode <= 40) {
      // Try to move markedNoteObj left
      if (tab.markedNoteObj != null) {
        const { trackId } = tab.markedNoteObj;
        let { blockId } = tab.markedNoteObj;
        const { voiceId } = tab.markedNoteObj;
        let { beatId } = tab.markedNoteObj;
        let { string } = tab.markedNoteObj;

        if (keyCode === 37) { // LEFT
          if (beatId > 0) {
            beatId -= 1;
          } else if (blockId > 0) {
            blockId -= 1;
            beatId = Song.measures[trackId][blockId][voiceId].length - 1;
          }
        }
        if (keyCode === 39) { // RIGHT
          if (beatId + 1 < Song.measures[trackId][blockId][voiceId].length) {
            beatId += 1;
          } else if (blockId + 1 < Song.measures[trackId].length) {
            blockId += 1;
            beatId = 0;
          }
        }
        if (keyCode === 40) { // DOWN
          if (string > 0) {
            string -= 1;
          }
        }
        if (keyCode === 38) { // UP
          if (string + 1 < Song.tracks[trackId].numStrings) {
            string += 1;
          }
        }
        svgDrawer.setNewClickedPos(trackId, blockId, voiceId, beatId, string);
      }
    }
  },

  keyDownEvent(e: KeyboardEvent) {
    const pressedValue = String.fromCharCode(e.which);
    if ([38, 40].indexOf(e.keyCode) > -1) {
      e.preventDefault();
    }
    this.processKeyPress(pressedValue, e.keyCode);
    if (!this.duringTrackCreation) {
      /* if ((e.metaKey || e.ctrlKey) && ( String.fromCharCode(e.which).toLowerCase() === 'Z') ) {
              revertHandler.revertState();
          } */
      if (!modalHandler.isAModalOpen()) {
        if ((e.metaKey || e.ctrlKey)
        && (String.fromCharCode(e.which).toLowerCase() === 'c')) {
          overlayHandler.copyHandler();
        }
        if ((e.metaKey || e.ctrlKey)
        && (String.fromCharCode(e.which).toLowerCase() === 'v')) {
          overlayHandler.pasteHandler();
        }
      }
    }
  },

  clickEnding() {
    this.stillMouseDown = false;
    const clickedKey = visualInstruments.clickedKeyOnPiano;
    if (clickedKey !== -1) {
      midiEngine.noteOff(clickedKey);
      visualInstruments.clickedKeyOnPiano = -1;
    }
    if (this.loopIntervalChanged) {
      overlayHandler.setLoopingInterval();
      this.loopIntervalChanged = false;
    }
  },

  setTrackInfo() {
    const tabTitleDom = document.getElementById('tabTitle');
    tabTitleDom!.textContent = Song.songDescription.title;
    const tabAuthorDom = document.getElementById('tabAuthor');
    tabAuthorDom!.textContent = Song.songDescription.author;
    (document.getElementById('songTitleInput') as HTMLInputElement).value = Song.songDescription.title;
    (document.getElementById('songSubtitleInput') as HTMLInputElement).value = Song.songDescription.subtitle;
    (document.getElementById('songArtistInput') as HTMLInputElement).value = Song.songDescription.artist;
    (document.getElementById('songAlbumInput') as HTMLInputElement).value = Song.songDescription.album;
    (document.getElementById('songAuthorInput') as HTMLInputElement).value = Song.songDescription.author;
    if (Song.songDescription.music != null) {
      (document.getElementById('songMusicInput') as HTMLInputElement).value = Song.songDescription.music;
    }
    (document.getElementById('songCopyrightInput') as HTMLInputElement).value = Song.songDescription.copyright;
    (document.getElementById('songWriterInput') as HTMLInputElement).value = Song.songDescription.writer;
    (document.getElementById('songInstructionInput') as HTMLInputElement).value = Song.songDescription.instructions;

    if (Song.songDescription.comments != null) {
      let commentStr = '';
      for (let i = 0; i < Song.songDescription.comments.length; i += 1) {
        commentStr += `${Song.songDescription.comments[i]}\n`;
      }
      (document.getElementById('songCommentsInput') as HTMLInputElement).value = commentStr;
    }
  },

  setCapo(newCapo: number) {
    const capoTitleDom = document.getElementById('capoTitle');
    capoTitleDom!.textContent = `Capo: ${newCapo}`;
    const capoLabelDom = document.getElementById('capoLabel');
    capoLabelDom!.textContent = `Capo: ${newCapo}`;
    visualInstruments.setCapo(newCapo);
  },

  setTrackInstrument(trackId: number) {
    if (trackId === Song.currentTrackId) {
      let tuningStrings = '';
      for (let j = 0; j < Song.tracks[trackId].strings.length; j += 1) {
        tuningStrings += Tuning.octave[Song.tracks[trackId].strings[j] % 12];
      }
      const tuningTitleDom = document.getElementById('tuningTitle');
      tuningTitleDom!.textContent = `Tuning: ${tuningStrings}`;
      const tuningFooterDom = document.getElementById('tuningFooter');
      tuningFooterDom!.textContent = `Tuning: ${tuningStrings}`;
      const trackTitleDom = document.getElementById('trackTitle');
      trackTitleDom!.textContent = Song.tracks[trackId].name;

      const { red, green, blue } = Song.tracks[trackId].color;
      const colorString = `rgb(${red},${green},${blue})`;
      const trackTitelDom = document.getElementById('trackTitle');
      trackTitelDom!.style.color = colorString;
      if (tinycolor(colorString).isLight()) {
        trackTitelDom!.classList.add('isTooBright');
      } else {
        trackTitelDom!.classList.remove('isTooBright');
      }
    }
  },

  createGuitarTab(trackId: number) {
    this.resetVariables();
    const t0 = performance.now();
    Song.currentTrackId = trackId;
    const areas = document.getElementById('tabAreas');
    Helper.removeAllChildren(areas);
    Song.measureMoveHelper = [];
    const t1 = performance.now();
    let durComplete = 0;
    // create tab divs
    for (let i = 0; i < Song.measures.length; i += 1) {
      Song.measureMoveHelper[i] = [];
      for (let j = 0; j < Song.measures[i].length; j += 1) {
        Song.measureMoveHelper[i][j] = [];
        for (let k = 0; k < Song.measures[i][j].length; k += 1) {
          Song.measureMoveHelper[i][j][k] = [];
        }
      }
      console.log('Create Guitar Tab:', Song.numVoices);
      for (let j = 0; j < Song.numVoices; j += 1) {
        tab.createTakte(i, j);
        const tx = performance.now();
        tab.fillMeasures(i, j);

        durComplete += performance.now() - tx;
      }
    }
    console.log(`FillMeasures ${durComplete}`);
    console.log(`CreateTakte: ${performance.now() - t1}ms`);

    this.setTimeMeterToAllTracks();

    for (let i = 0; i < Song.tracks.length; i += 1) {
      this.setTracks(i);
    }
    this.setEffects(trackId);

    const t2 = performance.now();
    const voiceId = 0;
    // Set default marking
    tab.markedNoteObj = {
      trackId: 0, blockId: 0, beatId: 0, voiceId: 0, string: 0,
    };
    tab.drawTrack(trackId, voiceId, false, () => {
      svgDrawer.setNewClickedPos(0, 0, 0, 0, 0);
      svgDrawer.moveMarkerToPosition(0, 0, 0, 0, 0, 0);
    });

    const img = document.getElementById('trackSignImg') as HTMLImageElement;
    img.src = Helper.getIconSrc(Song.playBackInstrument[trackId].instrument);

    console.log(`drawTrack: ${performance.now() - t2}ms`);
    console.log(`Track Change: ${performance.now() - t0}ms`);
    // visualInstruments.createGuitar(Song.tracks[trackId].strings.length, 25);
    // draw suitable sequencer
    sequencer.drawBeat();
    sequencer.setIndicator(0, 0);
    modalHandler.closeAllModals();
  },

  changeTrack(trackId: number, voiceId: number, force: boolean, callback: (() => void) | null) {
    if (!force && Song.currentTrackId === trackId && voiceId === Song.currentVoiceId) {
      if (callback != null) {
        callback();
      }
      return;
    }
    Song.currentTrackId = trackId;
    Song.currentVoiceId = voiceId;

    overlayHandler.resetOverlays();

    const img = document.getElementById('trackSignImg') as HTMLImageElement;
    img.src = Helper.getIconSrc(Song.playBackInstrument[trackId].instrument);

    // visualInstruments.createGuitar(Song.tracks[trackId].numStrings, 25);
    this.setEffects(trackId);
    playBackLogic.trackChange = true;

    // new clicked pos, if the beat/string does not exist - TODO nearest pos
    tab.markedNoteObj.beatId = 0;
    tab.markedNoteObj.string = 0;
    tab.drawTrack(trackId, voiceId, true, callback);
  },

  saveAsGt(promptDialog: boolean) {
    const limiter = '%%%';
    let content = '';
    content += JSON.stringify(Song.songDescription);
    content += limiter;
    content += JSON.stringify(Song.measures);
    content += limiter;
    content += JSON.stringify(Song.measureMeta);
    content += limiter;
    content += JSON.stringify(Song.tracks);
    content += limiter;
    content += JSON.stringify(Song.playBackInstrument);
    content += limiter;
    content += JSON.stringify(audioEngine.noteToDrum);

    const compressed = LZString.compressToUint8Array(content);
    // TODO save open modals with size/position, write pan from busses
    const a = document.createElement('a');
    const file = new Blob([compressed], { type: 'octet/stream' });
    a.href = URL.createObjectURL(file);
    if (promptDialog) {
      a.download = 'saveAs.gt';
    } else {
      a.download = 'tab.gt';
    }
    a.click();
  },

  effectToAngle(val: number): number {
    // from 0-127 to 70-290 -180
    return 70 + (220 * val) / 127 - 180;
  },

  setEffects(trackIndex: number) {
    fastdom.mutate(() => {
      const reverbKnobDom = document.getElementById('reverbKnob');
      const chorusKnob = document.getElementById('chorusKnob');
      const phaserKnob = document.getElementById('phaserKnob');
      const panKnob = document.getElementById('panKnob');
      reverbKnobDom!.style.transform = `rotate(${this.effectToAngle(Song.playBackInstrument[trackIndex].reverb)}deg)`;
      chorusKnob!.style.transform = `rotate(${this.effectToAngle(Song.playBackInstrument[trackIndex].chorus)}deg)`;
      phaserKnob!.style.transform = `rotate(${this.effectToAngle(Song.playBackInstrument[trackIndex].phaser)}deg)`;
      panKnob!.style.transform = `rotate(${this.effectToAngle(Song.playBackInstrument[trackIndex].balance)}deg)`;
    });
  },

  setPlayBackInstrument(trackId: number) {
    let instrumentProps: PlayBackInstrument;
    let instrChannel = null;
    let channelIndex;
    if (Song.tracks[trackId].program != null) {
      instrChannel = Song.tracks[trackId].program;
      channelIndex = Song.tracks[trackId].primaryChannel;
      instrumentProps = {
        volume: 100,
        balance: 66,
        chorus: 0,
        reverb: 0,
        phaser: 0,
        tremolo: 0,
        instrument: '',
        mute: false,
        solo: false,
      };
    } else {
      const channel = Song.allChannels[Song.tracks[trackId].channel.index];
      instrChannel = channel.cInstrument;
      channelIndex = Song.tracks[trackId].channel.index;
      instrumentProps = {
        volume: channel.volume,
        balance: channel.balance,
        chorus: channel.chorus,
        reverb: channel.reverb,
        phaser: channel.phaser,
        tremolo: channel.tremolo,
        instrument: '',
        mute: false,
        solo: false,
      };
    }
    if (instrChannel != null) {
      if (channelIndex === 9) {
        instrumentProps.instrument = 'drums';
      } else {
        instrumentProps.instrument = numToInstr[instrChannel];
      }
    }
    Song.playBackInstrument[trackId] = instrumentProps;
    return instrumentProps;
  },

  setTracks(trackId: number) {
    this.setPlayBackInstrument(trackId);
    audioEngine.updateBusses(Song.playBackInstrument);
  },

  setTimeMeterToAllTracks() {
    let currentNumerator = 0;
    let currentDenominator = 0;
    for (let i = 0, n = Song.measureMeta.length; i < n; i += 1) {
      if (Song.measureMeta[i].denominator != null) {
        currentDenominator = Song.measureMeta[i].denominator;
      } else {
        Song.measureMeta[i].denominator = currentDenominator;
      }
      if (Song.measureMeta[i].numerator != null) {
        currentNumerator = Song.measureMeta[i].numerator;
      } else {
        Song.measureMeta[i].numerator = currentNumerator;
      }
    }
  },

  // goes from given blockId to next timeMeter in track
  checkAndAdaptTimeMeter(startBlockId: number) {
    const { numerator } = Song.measureMeta[startBlockId];
    const { denominator } = Song.measureMeta[startBlockId];

    // First check if setting this timeMeter is allowed on all tracks and voices
    for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
      for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
        for (let blockId = startBlockId; blockId < Song.measureMeta.length; blockId += 1) {
          if (blockId !== startBlockId && Song.measureMeta[blockId].timeMeterPresent) break;
          const blockObj = Song.measures[trackId][blockId][voiceId];
          const blockLength = blockObj.length;
          const numOf64ths = (64 / denominator) * numerator;
          let numOfBeats = 0;
          for (let i = 0; i < blockLength; i += 1) {
            const beat = Song.measures[trackId][startBlockId][voiceId][i];
            const beatLength = Duration.getDurationOfNote(beat, false);
            if (numOfBeats + beatLength > numOf64ths) {
              // check if deleting is allowed
              if (numOfBeats - Math.floor(numOfBeats) !== 0) {
                alert('Please remove the tuplet before changing the time meter!');
                return null;
              }
            }
            numOfBeats += beatLength;
          }
        }
      }
    }

    // Check has been succsessful, now set new measure
    const revertObj: {
      blockId: number,
      notes: { beatId: number, note: Note[] }[]
    }[][][] = [];
    let blockObj = null;
    for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
      revertObj[trackId] = [];
      for (let voiceId = 0; voiceId < Song.numVoices; voiceId += 1) {
        revertObj[trackId][voiceId] = [];
        for (let bId = startBlockId; bId < Song.measureMeta.length; bId += 1) {
          if (bId !== startBlockId && Song.measureMeta[bId].timeMeterPresent) break;
          console.log(`Hu ${bId}`);

          blockObj = Song.measures[trackId][bId][voiceId];
          let blockLength = blockObj.length;
          const numOf64ths = (64 / denominator) * numerator;
          let numOfBeats = 0;
          const revertNotes = [];
          for (let i = 0; i < blockLength; i += 1) {
            const beatLength = Duration.getDurationOfNote(
              Song.measures[trackId][bId][voiceId][i], false,
            );
            if (numOfBeats + beatLength > numOf64ths) {
              for (let j = i, l = blockLength; j < l; j += 1) {
                const clonedNote = JSON.parse(JSON.stringify(
                  Song.measures[trackId][bId][voiceId][j],
                ));
                revertNotes[j - i] = { beatId: j, note: clonedNote };
                if (Song.measures[trackId][bId][voiceId][i].notes != null) {
                  for (let k = 0; k < 6; k += 1) {
                    if (Song.measures[trackId][bId][voiceId][i].notes[k] != null) {
                      Tab.deleteNote(trackId, bId, voiceId, i, k, false);
                    }
                  }
                }
              }
              blockObj.splice(i, blockLength - i);
              break;
            }
            numOfBeats += beatLength;
          }
          revertObj[trackId][voiceId].push({
            blockId: bId,
            notes: revertNotes,
          });
          blockLength = blockObj.length;
          // repair measure by filling in notes
          let spaceToFill = numOf64ths - numOfBeats;
          for (let l = 0, n = spaceToFill; l < n; l += 1) {
            if (spaceToFill <= 0) break;
            // console.log("DIFF: "+spaceToFill);
            // fill with greatest 2potence and fill the rest with eighths
            const nearest2Potence = Helper.getGreatestNotelengthToFit(spaceToFill);
            spaceToFill -= nearest2Potence;
            Song.setBeat(trackId, bId, voiceId, blockLength + l, `${Duration.typeToString(nearest2Potence)}r`);
          }
        }
      }
    }
    // adapt marked pos
    if (blockObj != null && tab.markedNoteObj.beatId >= blockObj.length) {
      svgDrawer.setNewClickedPos(
        tab.markedNoteObj.trackId, tab.markedNoteObj.blockId,
        tab.markedNoteObj.voiceId, 0, tab.markedNoteObj.string,
      );
    }
    return revertObj;
  },

  placeNote(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, fretNumber: number,
  ) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    // no rest any more
    if (beat != null) {
      // eslint-disable-next-line prefer-destructuring
      beat.duration = beat.duration[0];
    }

    const note = beat.notes[string];
    let updatedFretNumber = fretNumber;
    if (note != null) {
      // allow high notes only on drums
      if ((note.fret === 1 || note.fret === 2) || Song.playBackInstrument[trackId].instrument === 'drums') {
        updatedFretNumber = note.fret + fretNumber;
      }
    }
    tab.drawNote(trackId, blockId, voiceId, beatId, string, updatedFretNumber, false);
    // Playback Note
    const volume = 0.5;
    const noteStart = audioEngine.getCurrentTime();
    const duration = 0.5;
    const instr = Song.playBackInstrument[trackId].instrument;
    /* var tuningDiff = getTuningDifference(trackId, string);
      var height = parseInt(fretNumber)
        + parseInt(Song.tracks[trackId].capo) + parseInt(tuningDiff);
      if(instr == "drums"){
          audioEngine.playDrums(trackId, voiceId, height, volume, noteStart, beat);
      }else if(instr == "guitar" || instr == "eguitar" || instr == "disteguitar" ||
      instr == "nylonGuitar" || instr == "bass" || instr == "overdriveguitar"){
          //audioEngine.playSound(trackId, voiceId, volume, string, height,
          // duration, noteStart, instr, beat, noteEffects, null);
          audioEngine.playSound(trackId, voiceId, volume, string, fretNumber, duration,
            noteStart, instr, beat, noteEffects, null);
      }else{
          audioEngine.playNoteInstrument(trackId, voiceId, height,
            volume, instr, noteStart, duration, beat, noteEffects);
      } */
    audioEngine.playSF2(
      trackId, voiceId, string, fretNumber, volume, noteStart,
      duration, beat, note, instr, updatedFretNumber,
    );
  },
};

export default AppManager;
