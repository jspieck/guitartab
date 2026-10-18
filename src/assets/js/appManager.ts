import tinycolor from 'tinycolor2';
import fastdom from 'fastdom';
import { tab, Tab } from './tab';
import { overlayHandler } from './overlayHandler';
import {
  Song, PlayBackInstrument, Note, VoiceSnapshot,
} from './songData';
import { modalManager } from './modals/modalManager';
import { typedEventBus } from '../../utils/typedEventBus';
import { notifySongDataChanged } from '../../services/appEvents';
import { visualInstruments } from './visualInstruments';
import midiEngine from './midiReceiver';
import playBackLogic from './playBackLogicNew';
import Helper from './helper';
import { numToInstr } from './instrumentData';
import { audioEngine } from './audioEngine';
import { sequencerHandler } from './sequencerHandler';
import Duration from './duration';
import Tuning from './tuning';
import { applyNoteLengthSelection } from '../../services/menuActionCommands';
import { useTabStore } from '../../stores/tabStore';
import { setTrackSignIcon } from '../../utils/editorUi';
import { serializeSongToGtBytes } from '../../utils/gtSerialization';
import { revertHandler } from './revertHandler';
import {
  combineFretDigit, isKeyboardControlTarget, matchShortcut, maxFretFor, wantsNativeSpace,
  type FretEntry, type ShortcutId,
} from '../../utils/keyboardShortcuts';
import { toggleShortcutsHelp } from '../../stores/shortcutsHelpState';

const AppManager = {
  notificationTimeOut: null as ReturnType<typeof setTimeout> | null,
  stillMouseDown: false,
  loopIntervalChanged: false,
  duringTrackCreation: false,
  
  get typeOfNote() {
    return useTabStore().typeOfNote;
  },
  set typeOfNote(value: string) {
    useTabStore().setTypeOfNote(value);
  },

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

  /** Banner message; `action` adds a button (e.g. "Undo") that runs once and closes the banner. */
  showNotification(
    text: string,
    kind: 'info' | 'error' = 'info',
    action?: { label: string, run: () => void },
  ) {
    const notificationLabel = document.getElementById('notificationLabel');
    if (notificationLabel) {
      notificationLabel.textContent = text;
    }
    if (this.notificationTimeOut != null) {
      clearTimeout(this.notificationTimeOut);
    }
    const notificationEmblem = document.getElementById('notificationEmblem');
    const actionButton = document.getElementById('notificationAction') as HTMLButtonElement | null;
    if (actionButton) {
      actionButton.hidden = action == null;
      actionButton.textContent = action?.label ?? '';
      actionButton.onclick = action == null ? null : () => {
        actionButton.onclick = null;
        if (notificationEmblem) notificationEmblem.style.display = 'none';
        action.run();
      };
    }
    if (notificationEmblem) {
      notificationEmblem.classList.toggle('notification-error', kind === 'error');
      notificationEmblem.style.opacity = '0';
      notificationEmblem.style.transition = 'opacity 0.5s';
      notificationEmblem.style.display = 'block';
      setTimeout(() => {
        notificationEmblem.style.opacity = '1';
      }, 0);
      this.notificationTimeOut = setTimeout(() => {
        notificationEmblem.style.opacity = '0';
        setTimeout(() => {
          notificationEmblem.style.display = 'none';
          notificationEmblem.classList.remove('notification-error');
        }, 500);
      }, kind === 'error' || action != null ? 8000 : 5000);
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

  /** Last fret typed, so a quick second digit on the same note makes 10 and up. */
  lastFretEntry: null as FretEntry | null,

  hasExplicitNoteSelection() {
    const {
      trackId, blockId, voiceId, beatId, string,
    } = tab.markedNoteObj;
    return tab.hasExplicitSelection
      && trackId >= 0 && blockId >= 0 && voiceId >= 0 && beatId >= 0 && string >= 0
      && Song.findBeat({ trackId, blockId, voiceId, beatId }) != null;
  },

  enterFretDigit(digit: number): boolean {
    if (!this.hasExplicitNoteSelection()) return false;
    const {
      trackId, blockId, voiceId, beatId, string,
    } = tab.markedNoteObj;
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
    } = tab.markedNoteObj;
    const loopI = overlayHandler.getLoopingInterval();
    if (loopI == null || loopI.trackId !== Song.currentTrackId) {
      if (Song.findBeat({ trackId, blockId, voiceId, beatId }) == null) return;
      Tab.deleteNote(trackId, blockId, voiceId, beatId, string, false);
      typedEventBus.emit('render.block', { trackId, blockId, voiceId });
      typedEventBus.emit('render.durations', { trackId, blockId, voiceId });
    } else {
      const blocks = [];
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
                Tab.deleteNote(trackId, blockIdIt, voiceId, beatIdIt, stringIt, false);
              }
            }
          }
        }
        blocks.push(blockIdIt);
        typedEventBus.emit('render.durations', { trackId, blockId: blockIdIt, voiceId });
      }
      typedEventBus.emit('render.blocks', { trackId, blockIds: blocks, voiceId });
    }
    notifySongDataChanged();
    typedEventBus.emit('menu.activateEffectsForPos', {
      trackId, blockId, voiceId, beatId, string,
    });
  },

  moveSelection(direction: 'left' | 'right' | 'up' | 'down') {
    if (tab.markedNoteObj == null) return;
    const { trackId, voiceId } = tab.markedNoteObj;
    let { blockId, beatId, string } = tab.markedNoteObj;
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
    if (tabTitleDom) tabTitleDom.textContent = Song.songDescription.title;
    
    const tabAuthorDom = document.getElementById('tabAuthor');
    if (tabAuthorDom) tabAuthorDom.textContent = Song.songDescription.author;

    const inputs = {
      'songTitleInput': Song.songDescription.title,
      'songSubtitleInput': Song.songDescription.subtitle,
      'songArtistInput': Song.songDescription.artist,
      'songAlbumInput': Song.songDescription.album,
      'songAuthorInput': Song.songDescription.author,
      'songMusicInput': Song.songDescription.music,
      'songCopyrightInput': Song.songDescription.copyright,
      'songWriterInput': Song.songDescription.writer,
      'songInstructionInput': Song.songDescription.instructions
    };

    Object.entries(inputs).forEach(([id, value]) => {
      const element = document.getElementById(id) as HTMLInputElement;
      if (element && value !== undefined) {
        element.value = value;
      }
    });

    if (Song.songDescription.comments) {
      const commentElement = document.getElementById('songCommentsInput') as HTMLInputElement;
      if (commentElement) {
        commentElement.value = Song.songDescription.comments.join('\n');
      }
    }
  },

  setCapo(newCapo: number) {
    const capoTitleDom = document.getElementById('capoTitle');
    if (capoTitleDom) {
      capoTitleDom.textContent = `Capo: ${newCapo}`;
    }
    visualInstruments.setCapo(newCapo);
  },

  setTrackInstrument(trackId: number) {
    if (trackId === Song.currentTrackId) {
      let tuningStrings = '';
      for (let j = 0; j < Song.tracks[trackId].strings.length; j += 1) {
        tuningStrings += Tuning.octave[Song.tracks[trackId].strings[j] % 12];
      }
      const tuningTitleDom = document.getElementById('tuningTitle');
      if (tuningTitleDom) {
        tuningTitleDom.textContent = `Tuning: ${tuningStrings}`;
      }
      const trackTitleDom = document.getElementById('trackTitle');
      if (trackTitleDom instanceof HTMLElement) {
        trackTitleDom.textContent = Song.tracks[trackId].name;

        const { red, green, blue } = Song.tracks[trackId].color;
        const colorString = `rgb(${red},${green},${blue})`;
        trackTitleDom.style.color = colorString;
        if (tinycolor(colorString).isLight()) {
          trackTitleDom.classList.add('isTooBright');
        } else {
          trackTitleDom.classList.remove('isTooBright');
        }
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
    // Note: The callback for drawTrack is called immediately since the actual 
    // SVG drawing code is commented out. Don't emit navigation events here
    // as the SVG elements don't exist yet.
    tab.drawTrack(trackId, voiceId, false, null);

    setTrackSignIcon(Helper.getIconSrc(Song.playBackInstrument[trackId].instrument));

    console.log(`drawTrack: ${performance.now() - t2}ms`);
    console.log(`Track Change: ${performance.now() - t0}ms`);
    // visualInstruments.createGuitar(Song.tracks[trackId].strings.length, 25);
    // draw suitable sequencer
    sequencerHandler.drawBeat();
    sequencerHandler.setIndicator(0, 0);
    modalManager.closeAllModals();
    
    // Notify that song data has changed to update reactive components
    console.log('Song loaded. Tracks:', Song.tracks.map(t => t.name));
    notifySongDataChanged();
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

    setTrackSignIcon(Helper.getIconSrc(Song.playBackInstrument[trackId].instrument));

    // visualInstruments.createGuitar(Song.tracks[trackId].numStrings, 25);
    this.setEffects(trackId);
    playBackLogic.trackChange = true;

    // new clicked pos, if the beat/string does not exist - TODO nearest pos
    tab.markedNoteObj.beatId = 0;
    tab.markedNoteObj.string = 0;
    tab.drawTrack(trackId, voiceId, true, callback);
    
    notifySongDataChanged();
  },

  saveAsGt(promptDialog: boolean) {
    const compressedBytes = serializeSongToGtBytes();
    const a = document.createElement('a');
    const file = new Blob([compressedBytes], { type: 'octet/stream' });
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
      if (reverbKnobDom instanceof HTMLElement) {
        reverbKnobDom.style.transform = `rotate(${this.effectToAngle(Song.playBackInstrument[trackIndex].reverb)}deg)`;
      }
      if (chorusKnob instanceof HTMLElement) {
        chorusKnob.style.transform = `rotate(${this.effectToAngle(Song.playBackInstrument[trackIndex].chorus)}deg)`;
      }
      if (phaserKnob instanceof HTMLElement) {
        phaserKnob.style.transform = `rotate(${this.effectToAngle(Song.playBackInstrument[trackIndex].phaser)}deg)`;
      }
      if (panKnob instanceof HTMLElement) {
        panKnob.style.transform = `rotate(${this.effectToAngle(Song.playBackInstrument[trackIndex].balance)}deg)`;
      }
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
    notifySongDataChanged();
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
            const beat = Song.getBeat({ trackId, blockId: startBlockId, voiceId, beatId: i });
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
    // revertObj[trackId][voiceId] = one snapshot per affected bar
    const revertObj: VoiceSnapshot[][][] = [];
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
          const beatCountBefore = blockLength;
          const numOf64ths = (64 / denominator) * numerator;
          let numOfBeats = 0;
          const revertBeats: VoiceSnapshot['beats'] = [];
          for (let i = 0; i < blockLength; i += 1) {
            const beatLength = Duration.getDurationOfNote(
              Song.getBeat({ trackId, blockId: bId, voiceId, beatId: i }), false,
            );
            if (numOfBeats + beatLength > numOf64ths) {
              for (let j = i, l = blockLength; j < l; j += 1) {
                const clonedBeat = JSON.parse(JSON.stringify(
                  Song.getBeat({ trackId, blockId: bId, voiceId, beatId: j }),
                ));
                revertBeats[j - i] = { beatId: j, beat: clonedBeat };
                if (Song.getBeat({ trackId, blockId: bId, voiceId, beatId: i }).notes != null) {
                  for (let k = 0; k < 6; k += 1) {
                    if (Song.getBeat({ trackId, blockId: bId, voiceId, beatId: i }).notes[k] != null) {
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
            beatCount: beatCountBefore,
            beats: revertBeats,
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
      typedEventBus.emit('navigation.setClickedPos', {
        trackId: tab.markedNoteObj.trackId, 
        blockId: tab.markedNoteObj.blockId,
        voiceId: tab.markedNoteObj.voiceId, 
        beatId: 0, 
        string: tab.markedNoteObj.string
      });
    }
    return revertObj;
  },

  placeNote(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, fretNumber: number,
  ) {
    const beat = Song.getBeat({ trackId, blockId, voiceId, beatId });
    // no rest any more
    // eslint-disable-next-line prefer-destructuring
    beat.duration = beat.duration[0];

    const note = beat.notes[string];
    tab.drawNote(trackId, blockId, voiceId, beatId, string, fretNumber, false);
    notifySongDataChanged();
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
  undo: () => { revertHandler.revertState(); return true; },
  redo: () => { revertHandler.restoreState(); return true; },
  copy: () => { overlayHandler.copyHandler(); return true; },
  paste: () => { overlayHandler.pasteHandler(); return true; },
  help: () => { toggleShortcutsHelp(); return true; },
};

export default AppManager;
