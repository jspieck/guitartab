import fastdom from 'fastdom';
import Duration from './duration';
import midiEngine from './midiReceiver';
import { revertHandler } from './revertHandler';
import { svgDrawer } from './svgDrawer';
import { modalHandler } from './modalHandler';
import Settings from './settingManager';
import Song, { Note, Measure } from './songData';
import { tab, Tab } from './tab';
import playBackLogic from './playBackLogicNew';
import Helper from './helper';
import AppManager from './appManager';
import { audioEngine } from './audioEngine';
import { classicalNotation } from './vexflowClassical';
import { sequencer, Sequencer } from './sequencer';
import { overlayHandler } from './overlayHandler';

class MenuHandler {
  previousBar: number;

  effectGroups: string[][];

  secondStatusBar: string[];

  lastNoteLengthButton: string;

  lastMeasureSelectButton: string;

  imagePaths: string[][];

  initYPos: number;

  oldBpm: number;

  lastVoiceId: number;

  elementToProperty: {[a: string]: string};

  noteEffects: string[];

  noteTiedTo: { blockId: number, beatId: number } | null;

  noteToBeat: {[a: string]: string};

  tempoMoveTmp: (e: MouseEvent) => void;

  removeListenersTmp: () => void;

  constructor() {
    this.tempoMoveTmp = () => {};
    this.removeListenersTmp = () => {};
    this.previousBar = 1;
    this.effectGroups = [
      ['pullDown', 'slide', 'bend', 'trill', 'tremoloPicking', 'tremoloBar', 'dead'],
      ['stacatto', 'palmMute'],
      ['tap', 'slap', 'pop'],
      ['fadeIn'],
      ['grace'],
      ['vibrato'],
      ['artificial'],
      ['accentuated', 'heavyAccentuated', 'ghost'],
      ['stroke'],
      ['addChord'],
      ['addText'],
      ['addMarker'],
      ['repeatAlternative'],
      ['pppDynamic', 'ppDynamic', 'pDynamic', 'mpDynamic', 'mfDynamic', 'fDynamic', 'ffDynamic', 'fffDynamic'],
      ['openBar'],
      ['closeBar'],
      ['timeMeter'],
      ['bpmMeter'],
      ['letRing'],
    ];
    this.secondStatusBar = ['pullDown', 'ghost', 'stacatto', 'accentuated', 'heavyAccentuated', 'palmMute',
      'vibrato', 'tremoloBar', 'artificial', 'trill', 'bend', 'slide', 'tap', 'fadeIn', 'grace', 'slap', 'pop',
      'dead', 'tremoloPicking', 'stroke', 'letRing'];

    this.lastNoteLengthButton = '8thNote';
    this.lastMeasureSelectButton = '';
    this.imagePaths = [
      ['playMusicImg', './src/assets/images/playButton.svg', './src/assets/images/playButtonWhite.svg'],
      ['zoomInImg', './src/assets/images/zoomIn.svg', './src/assets/images/zoomInWhite.svg'],
      ['zoomOutImg', './src/assets/images/zoomOut.svg', './src/assets/images/zoomOutWhite.svg'],
      ['wholeNoteImg', './src/assets/images/notes/wholeNote.svg', './src/assets/images/notes/wholeNoteWhite.svg'],
      ['halfNoteImg', './src/assets/images/notes/halfNote.svg', './src/assets/images/notes/halfNoteWhite.svg'],
      ['quarterNoteImg', './src/assets/images/notes/quarterNote.svg', './src/assets/images/notes/quarterNoteWhite.svg'],
      ['8thNoteImg', './src/assets/images/notes/eighthNote.svg', './src/assets/images/notes/eighthNoteWhite.svg'],
      ['16thNoteImg', './src/assets/images/notes/16thNote.svg', './src/assets/images/notes/16thNoteWhite.svg'],
      ['32ndNoteImg', './src/assets/images/notes/32ndNote.svg', './src/assets/images/notes/32ndNoteWhite.svg'],
      ['64thNoteImg', './src/assets/images/notes/64thNote.svg', './src/assets/images/notes/64thNoteWhite.svg'],
      ['dottedImg', './src/assets/images/articulations/dotted.svg', './src/assets/images/articulations/dottedWhite.svg'],
      ['doubleDottedImg', './src/assets/images/articulations/doubleDotted.svg', './src/assets/images/articulations/doubleDottedWhite.svg'],
      ['tupletImg', './src/assets/images/articulations/tuplet.svg', './src/assets/images/articulations/tupletWhite.svg'],
      ['tiedImg', './src/assets/images/articulations/tied.svg', './src/assets/images/articulations/tiedWhite.svg'],
      ['infoImg', './src/assets/images/info.svg', './src/assets/images/infoWhite.svg'],
      ['downloadIDGP', './src/assets/images/saveOwn.svg', './src/assets/images/saveOwnWhite.svg'],
      ['classicalToggle', './src/assets/images/classicalToggle.svg', './src/assets/images/classicalToggleWhite.svg'],
      ['pullDownImg', './src/assets/images/articulations/hammerOn.svg', './src/assets/images/articulations/hammerOnWhite.svg'],
      ['slideImg', './src/assets/images/articulations/Slide.svg', './src/assets/images/articulations/SlideWhite.svg'],
      ['bendImg', './src/assets/images/articulations/bend.svg', './src/assets/images/articulations/bendWhite.svg'],
      ['trillImg', './src/assets/images/articulations/Triller.svg', './src/assets/images/articulations/TrillerWhite.svg'],
      ['tremoloPickingImg', './src/assets/images/articulations/tremoloPicking.svg', './src/assets/images/articulations/tremoloPickingWhite.svg'],
      ['tremoloBarImg', './src/assets/images/articulations/tremoloBar.svg', './src/assets/images/articulations/tremoloBarWhite.svg'],
      ['deadImg', './src/assets/images/articulations/dead.svg', './src/assets/images/articulations/deadWhite.svg'],
      ['stacattoImg', './src/assets/images/articulations/Stacatto.svg', './src/assets/images/articulations/StacattoWhite.svg'],
      ['palmMuteImg', './src/assets/images/articulations/PalmMute.svg', './src/assets/images/articulations/PalmMuteWhite.svg'],
      ['fadeInImg', './src/assets/images/articulations/fadeIn.svg', './src/assets/images/articulations/fadeInWhite.svg'],
      ['vibratoImg', './src/assets/images/articulations/vibrato.svg', './src/assets/images/articulations/vibratoWhite.svg'],
      ['graceImg', './src/assets/images/articulations/grace.svg', './src/assets/images/articulations/graceWhite.svg'],
      ['artificialImg', './src/assets/images/articulations/artificial.svg', './src/assets/images/articulations/artificialWhite.svg'],
      ['ghostNoteImg', './src/assets/images/articulations/brackets.svg', './src/assets/images/articulations/bracketsWhite.svg'],
      ['accentuatedImg', './src/assets/images/articulations/Accentuated.svg', './src/assets/images/articulations/AccentuatedWhite.svg'],
      ['heavyAccentuatedImg', './src/assets/images/articulations/heavyAccentuated.svg', './src/assets/images/articulations/heavyAccentuatedWhite.svg'],
      ['strokeImg', ' ./src/assets/images/articulations/stroke.svg', ' ./src/assets/images/articulations/strokeWhite.svg'],
      ['letRingImg', ' ./src/assets/images/articulations/letRing.svg', ' ./src/assets/images/articulations/letRingWhite.svg'],

      ['timeMeterImg', './src/assets/images/statusBar/denom.svg', './src/assets/images/statusBar/denomWhite.svg'],
      ['bpmMeterImg', './src/assets/images/statusBar/bpmMeter.svg', './src/assets/images/statusBar/bpmMeterWhite.svg'],
      ['addMeasureImg', ' ./src/assets/images/statusBar/addMeasure.svg', './src/assets/images/statusBar/addMeasureWhite.svg'],
      ['removeMeasureImg', ' ./src/assets/images/statusBar/removeMeasure.svg', './src/assets/images/statusBar/removeMeasureWhite.svg'],
      ['openBarImg', './src/assets/images/statusBar/openBar.svg', './src/assets/images/statusBar/openBarWhite.svg'],
      ['closeBarImg', './src/assets/images/statusBar/closeBar.svg', './src/assets/images/statusBar/closeBarWhite.svg'],
      ['repeatAlternativeImg', './src/assets/images/statusBar/repeatAlternative.svg', './src/assets/images/statusBar/repeatAlternativeWhite.svg'],

      ['addChordImg', './src/assets/images/statusBar/chord.svg', './src/assets/images/statusBar/chordWhite.svg'],
      ['addTextImg', './src/assets/images/statusBar/text.svg', './src/assets/images/statusBar/textWhite.svg'],
      ['addMarkerImg', './src/assets/images/statusBar/marker.svg', './src/assets/images/statusBar/markerWhite.svg'],
      ['pauseMusicImg', './src/assets/images/pause.svg', './src/assets/images/pauseWhite.svg'],
      ['oneMeasureBackImg', './src/assets/images/statusBar/backward.svg', './src/assets/images/statusBar/backwardWhite.svg'],
      ['oneMeasureForwardImg', './src/assets/images/statusBar/forward.svg', './src/assets/images/statusBar/forwardWhite.svg'],
      ['sequencerEditImg', './src/assets/images/cogWheel.svg', './src/assets/images/cogWheelWhite.svg'],
      ['sequencerAddInstrument', './src/assets/images/addInstrument.svg', './src/assets/images/addInstrumentWhite.svg'],
      ['sequencerToggle', './src/assets/images/sequencerToggle.svg', './src/assets/images/sequencerToggleWhite.svg'],
      ['fullscreenImg', './src/assets/images/fullscreen.svg', './src/assets/images/fullscreenWhite.svg'],
      ['chordSection', './src/assets/images/chordSection.svg', './src/assets/images/chordSectionWhite.svg'],
    ];
    this.initYPos = 0;
    this.oldBpm = 90;
    this.lastVoiceId = 0;

    this.elementToProperty = {
      bend: 'bendPresent',
      artificial: 'artificialPresent',
      tap: 'tap',
      slide: 'slide',
      fadeIn: 'fadeIn',
      grace: 'grace',
      pullDown: 'pullDown',
      stacatto: 'stacatto',
      accentuated: 'accentuated',
      trill: 'trillPresent',
      dead: 'dead',
      heavyAccentuated: 'heavyAccentuated',
      palmMute: 'palmMute',
      vibrato: 'vibrato',
      slap: 'slap',
      pop: 'pop',
      tremoloPicking: 'tremoloPicking',
      letRing: 'letRing',
      ghost: 'ghost',
    };
    this.noteEffects = ['tap', 'slide', 'fadeIn', 'grace', 'pullDown', 'stacatto', 'accentuated', 'trill', 'bend', 'artificial',
      'heavyAccentuated', 'palmMute', 'vibrato', 'slap', 'pop', 'dead', 'tremoloPicking', 'letRing', 'ghost'];
    this.noteTiedTo = null;
    this.noteToBeat = {
      w: 'wholeNote', h: 'halfNote', q: 'quarterNote', e: '8thNote', s: '16thNote', t: '32ndNote', z: '64thNote', o: '128thNote',
    };
  }

  static addClickEvent(id: string, func: () => void) {
    document.getElementById(id)?.addEventListener('click', func);
  }

  initMenuButtons() {
    MenuHandler.addClickEvent('pianoEyeToggle', () => {
      modalHandler.toggleModal('pianoModal', 'Piano');
    });
    MenuHandler.addClickEvent('guitarEyeToggle', () => {
      modalHandler.toggleModal('guitarModal', 'Guitar');
    });
    MenuHandler.addClickEvent('effectEye', () => {
      fastdom.mutate(() => {
        document.getElementById('effectBar')?.classList.toggle('shiftPiano');
      });
    });
    MenuHandler.addClickEvent('wholeNote', () => { this.noteLengthSelect('wholeNote', 'w'); });
    MenuHandler.addClickEvent('halfNote', () => { this.noteLengthSelect('halfNote', 'h'); });
    MenuHandler.addClickEvent('quarterNote', () => { this.noteLengthSelect('quarterNote', 'q'); });
    MenuHandler.addClickEvent('8thNote', () => { this.noteLengthSelect('8thNote', 'e'); });
    MenuHandler.addClickEvent('16thNote', () => { this.noteLengthSelect('16thNote', 's'); });
    MenuHandler.addClickEvent('32ndNote', () => { this.noteLengthSelect('32ndNote', 't'); });
    MenuHandler.addClickEvent('64thNote', () => { this.noteLengthSelect('64thNote', 'z'); });

    MenuHandler.addClickEvent('dotted', () => { this.noteLengthSpecialSelect('dotted'); });
    MenuHandler.addClickEvent('doubleDotted', () => { this.noteLengthSpecialSelect('doubleDotted'); });
    MenuHandler.addClickEvent('tuplet', () => { this.noteLengthSpecialSelect('tuplet'); });
    MenuHandler.addClickEvent('tied', () => { this.noteLengthSpecialSelect('tied'); });

    MenuHandler.addClickEvent('info', () => { modalHandler.openInfoModal(); });

    MenuHandler.addClickEvent('zoomIn', () => { tab.scaleCompleteTab(true); });
    MenuHandler.addClickEvent('zoomOut', () => { tab.scaleCompleteTab(false); });
    MenuHandler.addClickEvent('fullscreen', () => { svgDrawer.disablePageMode(); });

    for (const id of this.secondStatusBar) {
      MenuHandler.addClickEvent(id, () => { this.noteEffectSelect(id); });
    }

    const thirdStatusBar = [
      'pppDynamic', 'ppDynamic', 'pDynamic', 'mpDynamic', 'mfDynamic', 'fDynamic', 'ffDynamic', 'fffDynamic',
    ];
    for (const id of thirdStatusBar) {
      MenuHandler.addClickEvent(id, () => { this.dynamicSelect(id); });
    }

    // FOURTH STATUS BAR
    MenuHandler.addClickEvent('timeMeter', () => { this.notationSelect('timeMeter'); });
    MenuHandler.addClickEvent('bpmMeter', () => { this.notationSelect('bpmMeter'); });
    MenuHandler.addClickEvent('addMeasure', () => { tab.addBlock(false); });
    MenuHandler.addClickEvent('removeMeasure', () => { tab.removeBlock(false); });
    MenuHandler.addClickEvent('openBar', () => { this.measureSelect('openBar'); });
    MenuHandler.addClickEvent('closeBar', () => { this.notationSelect('closeBar'); });
    MenuHandler.addClickEvent('repeatAlternative', () => { this.notationSelect('repeatAlternative'); });

    // FIFTH STATUS BAR
    MenuHandler.addClickEvent('addText', () => { this.notationSelect('addText'); });
    MenuHandler.addClickEvent('addChord', () => { this.notationSelect('addChord'); });
    MenuHandler.addClickEvent('addMarker', () => { this.notationSelect('addMarker'); });

    MenuHandler.addClickEvent('play', () => { playBackLogic.playSongB(); });
    MenuHandler.addClickEvent('stopButton', () => { playBackLogic.stopSong(); });

    // menu
    for (let i = 1; i <= 5; i += 1) {
      MenuHandler.addClickEvent(`barButton${i}`, () => { this.selectBar(i); });
    }

    MenuHandler.addClickEvent('classicalToggleButton', () => {
      classicalNotation.toggleClassicalVisibility();
    });
    MenuHandler.addClickEvent('chordSection', () => {
      modalHandler.openChordManager(Song.currentTrackId);
    });

    // voices
    MenuHandler.addClickEvent('voice0', () => { this.selectVoice(0); });
    MenuHandler.addClickEvent('voice1', () => { this.selectVoice(1); });

    // jump buttons
    MenuHandler.addClickEvent('oneMeasureBack', () => { MenuHandler.playBackJump(true); });
    MenuHandler.addClickEvent('oneMeasureForward', () => { MenuHandler.playBackJump(false); });

    MenuHandler.addClickEvent('modeSwitcher', () => { this.toggleDarkMode(); });
    // Recording
    MenuHandler.addClickEvent('recordButton', () => { MenuHandler.recordButtonPressed(); });
    // Tempo Meter
    document.getElementById('tempoMeter')?.addEventListener('mousedown', (e) => { this.changeTempoFunc(e); });

    MenuHandler.addClickEvent('midiLabel', () => { modalHandler.toggleModal('midiModal', 'Midi'); });
    MenuHandler.addClickEvent('capoLabel', () => { modalHandler.openInstrumentSettings(Song.currentTrackId); });
    MenuHandler.addClickEvent('tuningFooter', () => { modalHandler.openInstrumentSettings(Song.currentTrackId); });
    MenuHandler.addClickEvent('autoScroll', () => { MenuHandler.toggleScrolling(); });
    MenuHandler.addClickEvent('drumInfoFooter', () => { modalHandler.toggleModal('drumInfoModal', 'Drum Info'); });

    MenuHandler.addClickEvent('drumMixerOpen', () => { modalHandler.toggleModal('mixerModal', 'Mixer'); });
    // set focus if clicked
    MenuHandler.addClickEvent('mainContent', () => { document.getElementById('mainContent')?.focus(); });
  }

  static toggleScrolling() {
    if (Settings.scrollingEnabled) {
      document.getElementById('autoScroll')!.textContent = 'AutoScroll: Disabled';
    } else {
      document.getElementById('autoScroll')!.textContent = 'AutoScroll: Enabled';
    }
    Settings.scrollingEnabled = !Settings.scrollingEnabled;
  }

  selectBar(id: number) {
    fastdom.mutate(() => {
      if (this.previousBar === id) return;
      document.getElementById(`statusBar${this.previousBar}`)?.classList.toggle('statusBarSelected');
      document.getElementById(`statusBar${id}`)?.classList.toggle('statusBarSelected');

      document.getElementById(`barButton${this.previousBar}`)?.classList.toggle('tabBarElemSelected');
      document.getElementById(`barButton${id}`)?.classList.toggle('tabBarElemSelected');

      this.previousBar = id;
    });
  }

  static playBackJump(isBackwards: boolean) {
    if (!Settings.songPlaying) { return; }
    if (isBackwards) {
      playBackLogic.moveOneBackward();
    } else {
      playBackLogic.moveOneForward();
    }
  }

  toggleDarkMode() {
    Settings.darkMode = !Settings.darkMode;
    Settings.save('darkMode', Settings.darkMode);
    this.applyStyleMode();
  }

  applyStyleMode() {
    sequencer.drawBeat();
    // audioEngine.equalizer.redraw();
    if (Settings.darkMode) {
      for (let i = 0; i < this.imagePaths.length; i += 1) {
        document.getElementById(this.imagePaths[i][0])?.setAttribute('src', this.imagePaths[i][2]);
      }
      document.getElementById('modeSwitcher')!.textContent = 'Dark Design';
      document.body.setAttribute('id', 'darkMode');
    } else {
      for (let i = 0; i < this.imagePaths.length; i += 1) {
        document.getElementById(this.imagePaths[i][0])?.setAttribute('src', this.imagePaths[i][1]);
      }
      document.getElementById('modeSwitcher')!.textContent = 'White Design';
      document.body.setAttribute('id', 'lightMode');
    }
    (document.getElementById('trackSignImg') as HTMLImageElement).src = Helper.getIconSrc(
      Song.playBackInstrument[Song.currentTrackId].instrument,
    );
  }

  removeEventListenersTempo() {
    document.body.classList.remove('disableMouseEffects');
    document.removeEventListener('mousemove', this.tempoMoveTmp);
    document.removeEventListener('mouseup', this.removeListenersTmp);
  }

  tempoMeterMouseMove(event: MouseEvent) {
    const tempoMeter = document.getElementById('tempoMeter');
    const mouseYnew = event.pageY;
    Song.bpm = this.oldBpm + this.initYPos - mouseYnew;
    Song.bpm = Math.max(Song.bpm, 10);
    Song.bpm = Math.min(Song.bpm, 180);
    tempoMeter!.textContent = Song.bpm.toString();
  }

  changeTempoFunc(e: MouseEvent) {
    this.initYPos = e.pageY;
    this.oldBpm = Song.bpm;
    // while mousedown if mousemoves then compare the coordinates and rotate the knob accordingly
    this.tempoMoveTmp = this.tempoMeterMouseMove.bind(this);
    this.removeListenersTmp = this.removeEventListenersTempo.bind(this);
    document.addEventListener('mousemove', this.tempoMoveTmp);
    document.body.classList.add('disableMouseEffects');
    document.addEventListener('mousemove', this.tempoMoveTmp);
    document.addEventListener('mouseup', this.removeListenersTmp);
  }

  static recordButtonPressed() {
    if (midiEngine.isRecording) {
      document.getElementById('recordButton')?.classList.remove('prepareRecording');
      midiEngine.stopRecording();
    } else {
      document.getElementById('recordButton')?.classList.add('prepareRecording');
      midiEngine.recordMidi();
    }
  }

  selectVoice(voiceId: number) {
    if (AppManager.duringTrackCreation) {
      return;
    }
    document.getElementById(`voice${this.lastVoiceId}`)?.classList.remove('voiceSelected');
    this.lastVoiceId = voiceId;
    document.getElementById(`voice${voiceId}`)?.classList.add('voiceSelected');
    AppManager.changeTrack(Song.currentTrackId, voiceId, false, null);
  }

  processDynamicSelect(
    arr: {
      notes: { trackId: number, blockId: number, voiceId: number, beatId: number,
        string: number }[],
      blocks: number[]
    },
    id: string,
    isRevert: boolean,
  ) {
    let dynamic = '';
    switch (id) {
      case 'pppDynamic': dynamic = 'ppp'; break;
      case 'ppDynamic': dynamic = 'pp'; break;
      case 'pDynamic': dynamic = 'p'; break;
      case 'mpDynamic': dynamic = 'mp'; break;
      case 'mfDynamic': dynamic = 'mf'; break;
      case 'fDynamic': dynamic = 'f'; break;
      case 'ffDynamic': dynamic = 'ff'; break;
      case 'fffDynamic': dynamic = 'fff'; break;
      default: break;
    }

    let isVariableSet = true;
    for (const {
      trackId, blockId, voiceId, beatId,
    } of arr.notes) {
      const beat = Song.measures[trackId][blockId][voiceId][beatId];
      if (!beat.dynamicPresent || beat.dynamic !== dynamic) {
        isVariableSet = false;
      }
    }
    for (const {
      trackId, blockId, voiceId, beatId, string,
    } of arr.notes) {
      const beat = Song.measures[trackId][blockId][voiceId][beatId];
      const note = beat.notes[string];
      beat.dynamic = dynamic;

      // var isVariableSet = false;
      for (let i = 0; i < this.effectGroups.length; i += 1) {
        if (this.effectGroups[i].includes(id)) {
          // isVariableSet = getEffectVariable(beat, note, id);
          this.deactivateEffects(beat, note, this.effectGroups[i]);

          if (isVariableSet == null || isVariableSet === false) {
            this.setEffectVariable(beat, note, id, true);
            document.getElementById(id)?.classList.toggle('pressed');
          } else {
            this.setEffectVariable(beat, note, id, false);
          }
          break;
        }
      }
      if (isRevert == null) {
        revertHandler.addDynamic(trackId, blockId, voiceId, beatId, string, id);
      }
    }
    const { trackId, voiceId } = arr.notes[0];
    for (const blockId of arr.blocks) {
      svgDrawer.renderOverBar(trackId, blockId, voiceId, false);
    }
  }

  dynamicSelect(id: string) {
    if (AppManager.duringTrackCreation) {
      return;
    }
    const arr = overlayHandler.getNotesInInterval(null);
    this.processDynamicSelect(arr, id, false);
  }

  toggleEffectSelect(id: string, beat: Measure) {
    let isVariableSet = false;
    for (let i = 0; i < this.effectGroups.length; i += 1) {
      if (this.effectGroups[i].includes(id)) {
        isVariableSet = this.getEffectVariable(beat, null, id);
        this.deactivateEffects(beat, null, this.effectGroups[i]);

        if (isVariableSet == null || isVariableSet === false) {
          this.setEffectVariable(beat, null, id, true);
          document.getElementById(id)?.classList.toggle('pressed');
        } else {
          this.setEffectVariable(beat, null, id, false);
        }
        break;
      }
    }
  }

  /*  BLOCK: #addMarker, #repeatAlternative
        BEAT: #stroke, #tremoloBar, #"+beat.dynamic+"Dynamic , !#addText, #addChord
    } */
  processNotationSelect(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    id: string, isRevert: boolean,
  ) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    if (id === 'addText' && isRevert == null && !beat.textPresent) {
      modalHandler.openTextModal(trackId, blockId, voiceId, beatId);
    } else if (id === 'addChord' && isRevert == null && !beat.chordPresent) {
      modalHandler.openChordModal(trackId, blockId, voiceId, beatId);
    } else if (id === 'addMarker' && isRevert == null && !Song.measureMeta[blockId].markerPresent) {
      modalHandler.openMarkerModal(trackId, blockId, voiceId);
    } else if (id === 'repeatAlternative' && isRevert == null && !Song.measureMeta[blockId].repeatAlternativePresent) {
      modalHandler.openRepeatAlternativeModal(trackId, blockId, voiceId);
    } else if (id === 'closeBar' && isRevert == null && !Song.measureMeta[blockId].repeatClosePresent) {
      modalHandler.openRepititionNumberModal(trackId, blockId, voiceId);
    } else if (id === 'timeMeter' && isRevert == null && (blockId === 0 || !Song.measureMeta[blockId].timeMeterPresent)) {
      modalHandler.openTimeMeterModal(trackId, blockId, voiceId);
    } else if (id === 'bpmMeter' && isRevert == null && !Song.measureMeta[blockId].bpmPresent) {
      modalHandler.openBpmModal(trackId, blockId, voiceId);
    } else {
      if (isRevert == null && id !== 'timeMeter' && id !== 'addMarker') {
        revertHandler.addNotationSelect(trackId, blockId, voiceId, beatId, id);
      }
      if (id === 'addMarker' && Song.measureMeta[blockId].markerPresent) {
        revertHandler.addMarker(
          trackId, blockId, Song.measureMeta[blockId].marker,
          Song.measureMeta[blockId].marker, true, false,
        );
        Sequencer.removeMarker(blockId);
      }
      // Extra for time meter
      if (id === 'timeMeter' && isRevert == null && blockId !== 0 && Song.measureMeta[blockId].timeMeterPresent) {
        // TODO search last time meter and adapt blocks
        const currentDenominator = Song.measureMeta[blockId].denominator;
        const currentNumerator = Song.measureMeta[blockId].numerator;
        let foundBlock = 0;
        for (let i = blockId - 1; i >= 0; i -= 1) {
          if (currentNumerator !== Song.measureMeta[i].numerator
            || currentDenominator !== Song.measureMeta[i].denominator) {
            foundBlock = i;
            break;
          }
        }
        const notesBefore = AppManager.checkAndAdaptTimeMeter(foundBlock);
        const newDenominator = Song.measureMeta[foundBlock].denominator;
        const newNumerator = Song.measureMeta[foundBlock].numerator;
        // Set until the end of track/ next timeMeter
        for (let bId = blockId; bId < Song.measureMeta.length; bId += 1) {
          if (Song.measureMeta[bId].timeMeterPresent) { break; }
          Song.measureMeta[bId].numerator = newNumerator;
          Song.measureMeta[bId].denominator = newDenominator;
        }
        if (notesBefore != null) {
          revertHandler.addTimeMeter(
            trackId, blockId, voiceId, currentNumerator, newNumerator, currentDenominator,
            newDenominator, true, false, notesBefore,
          );
        } else {
          console.error('Notes before are null');
        }
      }

      this.toggleEffectSelect(id, beat);
      svgDrawer.rerenderBlock(trackId, blockId, voiceId);
      // drawTrack(trackId, voiceId, true);
      // svgDrawer.renderOverBar(trackId, blockId, voiceId);
    }
  }

  notationSelect(id: string) {
    if (AppManager.duringTrackCreation) {
      return;
    }
    this.processNotationSelect(
      tab.markedNoteObj.trackId, tab.markedNoteObj.blockId, tab.markedNoteObj.voiceId,
      tab.markedNoteObj.beatId, id, false,
    );
  }

  processEffectSelect(
    arr: {
      notes: {trackId: number, blockId: number, voiceId: number, beatId: number,
        string: number, note: Note}[],
      blocks: number[],
      beats: {trackId: number, blockId: number, voiceId: number, beatId: number, beat: Measure}[]
    },
    id: string,
    isRevert: boolean,
  ) {
    // Variable is only set, if effect is active at every element in arr
    let isVariableSet: boolean = true;
    console.log(arr, id);
    console.log('Process Effect Select');
    for (const no of arr.notes) {
      const beat = Song.measures[no.trackId][no.blockId][no.voiceId][no.beatId];
      const note = beat.notes[no.string];
      isVariableSet = this.getEffectVariable(beat, note, id);
    }
    console.log('PE', id, isVariableSet, isRevert);
    if (id === 'bend' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalHandler.openBendModal(arr, isVariableSet);
    } else if (id === 'artificial' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalHandler.openArtificialModal(arr);
    } else if (id === 'tremoloBar' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalHandler.openTremoloBarModal(arr, isVariableSet);
    } else if (id === 'tremoloPicking' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalHandler.openTremoloPickingModal(arr, isVariableSet);
    } else if (id === 'grace' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalHandler.openGraceModal(arr);
    } else if (id === 'stroke' && (isVariableSet == null || isVariableSet === false) && isRevert === false) {
      modalHandler.openStrokeModal(arr);
    } else {
      const changes = this.handleEffectGroupCollision(arr.notes, id, isVariableSet);
      if (isRevert === false) {
        revertHandler.addNoteEffectSelect(arr, id, changes);
      }
      if (id === 'grace') {
        classicalNotation.computeVexFlowDataStructures(
          Song.currentTrackId, Song.currentVoiceId,
        );
      }
      for (const blockId of arr.blocks) {
        svgDrawer.rerenderBlock(Song.currentTrackId, blockId, Song.currentVoiceId);
      }
    }
  }

  handleEffectCollision(
    beat: Measure, note: Note | null, i: number, id: string, isVariableSet: boolean,
  ): {[s: string]: boolean} {
    const effectGroupValues: {[s: string]: boolean} = {};
    for (const effect of this.effectGroups[i]) {
      effectGroupValues[effect] = this.getEffectVariable(beat, note, effect);
    }
    // isVariableSet = getEffectVariable(beat, note, id);
    if (isVariableSet == null || isVariableSet === false) {
      this.deactivateEffects(beat, note, this.effectGroups[i]);
      this.setEffectVariable(beat, note, id, true);
      // TODO with loopInterval
      document.getElementById(id)?.classList.toggle('pressed');
    } else {
      this.setEffectVariable(beat, note, id, false);
    }
    return effectGroupValues;
  }

  handleEffectGroupCollisionBeat(
    beats: { trackId: number, blockId: number, voiceId: number, beatId: number }[],
    id: string,
    isVariableSet: boolean,
  ) {
    const changes: {[m: string]: {string: number, effects: {[s: string]: boolean}}[]} = {};
    for (const be of beats) {
      const beat = Song.measures[be.trackId][be.blockId][be.voiceId][be.beatId];
      const beatStr = `${be.trackId}_${be.blockId}_${be.voiceId}_${be.beatId}`;
      for (let i = 0; i < this.effectGroups.length; i += 1) {
        if (this.effectGroups[i].includes(id)) {
          const changedEffects = [];
          for (let string = 0; string < beat.notes.length; string += 1) {
            if (beat.notes[string] != null) {
              changedEffects.push({
                string,
                effects: this.handleEffectCollision(beat, beat.notes[string], i, id, isVariableSet),
              });
            }
          }
          changes[beatStr] = changedEffects;
          break;
        }
      }
    }
    return changes;
  }

  handleEffectGroupCollision(
    notes: { trackId: number, blockId: number, voiceId: number, beatId: number, string: number }[],
    id: string,
    isVariableSet: boolean,
  ): {[key: string]: {[s: string]: boolean}} {
    const changes: {[key: string]: {[s: string]: boolean}} = {};
    for (const no of notes) {
      const beat = Song.measures[no.trackId][no.blockId][no.voiceId][no.beatId];
      const note = beat.notes[no.string];
      const noStr = `${no.trackId}_${no.blockId}_${no.voiceId}_${no.beatId}_${no.string}`;
      for (let i = 0; i < this.effectGroups.length; i += 1) {
        if (this.effectGroups[i].includes(id)) {
          changes[noStr] = this.handleEffectCollision(beat, note, i, id, isVariableSet);
          break;
        }
      }
    }
    return changes;
  }

  noteEffectSelect(id: string): void {
    if (AppManager.duringTrackCreation) {
      return;
    }
    const arr = overlayHandler.getNotesInInterval(null);
    this.processEffectSelect(arr, id, false);
  }

  deactivateAllEffects() {
    for (let i = 0; i < this.effectGroups.length; i += 1) {
      for (let j = 0; j < this.effectGroups[i].length; j += 1) {
        document.getElementById(this.effectGroups[i][j])?.classList.remove('pressed');
      }
    }
  }

  deactivateEffects(beat: Measure, note: Note | null, effects: string[]) {
    for (let i = 0; i < effects.length; i += 1) {
      document.getElementById(effects[i])?.classList.remove('pressed');
      this.setEffectVariable(beat, note, effects[i], false);
    }
  }

  setEffectVariable(beatIn: Measure, noteIn: Note | null, name: string, value: boolean) {
    const beat = beatIn;
    const note = noteIn;
    if (note != null && this.noteEffects.includes(name)) {
      note[this.elementToProperty[name]] = value;
    } else {
      switch (name) {
        // BEAT EFFECTS
        case 'stroke':
          beat.effects.strokePresent = value;
          break;
        case 'tremoloBar':
          beat.effects.tremoloBarPresent = value;
          break;
        case 'addText':
          beat.textPresent = value;
          break;
        case 'addChord':
          beat.chordPresent = value;
          break;
        case 'addMarker':
          Song.measureMeta[tab.markedNoteObj.blockId].markerPresent = value;
          break;
        case 'repeatAlternative':
          Song.measureMeta[tab.markedNoteObj.blockId].repeatAlternativePresent = value;
          break;
        case 'closeBar':
          Song.measureMeta[tab.markedNoteObj.blockId].repeatClosePresent = value;
          break;
        case 'timeMeter':
          Song.measureMeta[tab.markedNoteObj.blockId].timeMeterPresent = value;
          break;
        case 'bpmMeter':
          Song.measureMeta[tab.markedNoteObj.blockId].bpmPresent = value;
          break;
        case 'pppDynamic':
        case 'ppDynamic':
        case 'pDynamic':
        case 'mpDynamic':
        case 'mfDynamic':
        case 'fDynamic':
        case 'ffDynamic':
        case 'fffDynamic':
          beat.dynamicPresent = value;
          break;
        default:
          break;
      }
    }
  }

  getEffectVariable(beat: Measure, note: Note | null, name: string): boolean {
    if (note != null && this.noteEffects.includes(name)) {
      return note[this.elementToProperty[name]];
    }
    switch (name) {
      // BEAT EFFECTS
      case 'tremoloBar':
        return beat.effects.tremoloBarPresent;
      case 'stroke':
        return beat.effects.strokePresent;
      case 'addText':
        return beat.textPresent;
      case 'addChord':
        return beat.chordPresent;
      case 'addMarker':
        return Song.measureMeta[tab.markedNoteObj.blockId].markerPresent;
      case 'repeatAlternative':
        return Song.measureMeta[tab.markedNoteObj.blockId].repeatAlternativePresent;
      case 'closeBar':
        return Song.measureMeta[tab.markedNoteObj.blockId].repeatClosePresent;
      case 'timeMeter':
        return Song.measureMeta[tab.markedNoteObj.blockId].timeMeterPresent;
      case 'bpmMeter':
        return Song.measureMeta[tab.markedNoteObj.blockId].bpmPresent;
      case 'pppDynamic':
      case 'ppDynamic':
      case 'pDynamic':
      case 'mpDynamic':
      case 'mfDynamic':
      case 'fDynamic':
      case 'ffDynamic':
      case 'fffDynamic':
        return beat.dynamicPresent;
      default:
        return false;
    }
  }

  static activateEffectsForBlock() {
    const { blockId } = tab.markedNoteObj;
    if (Song.measureMeta[blockId].markerPresent) {
      document.getElementById('addMarker')?.classList.add('pressed');
    }
    if (Song.measureMeta[blockId].repeatAlternativePresent) {
      document.getElementById('repeatAlternative')?.classList.add('pressed');
    }
    if (Song.measureMeta[blockId].repeatClosePresent) {
      document.getElementById('closeBar')?.classList.add('pressed');
    }
    if (Song.measureMeta[blockId].repeatOpen) {
      document.getElementById('openBar')?.classList.add('pressed');
    }
    if (Song.measureMeta[blockId].timeMeterPresent) {
      document.getElementById('timeMeter')?.classList.add('pressed');
    }
    if (Song.measureMeta[blockId].bpmPresent) {
      document.getElementById('bpmMeter')?.classList.add('pressed');
    }
  }

  static deactivateEffectsForBeat() {
    const beatEffects = ['stroke', 'tremoloBar', 'addText', 'addChord', 'pppDynamic', 'ppDynamic',
      'pDynamic', 'mpDynamic', 'mfDynamic', 'fDynamic', 'ffDynamic', 'fffDynamic'];
    for (let i = 0, n = beatEffects.length; i < n; i += 1) {
      document.getElementById(beatEffects[i])?.classList.remove('pressed');
    }
  }

  static activateEffectsForBeat(beat: Measure) {
    MenuHandler.deactivateEffectsForBeat();
    if (beat.effects.strokePresent) {
      document.getElementById('stroke')?.classList.add('pressed');
    }
    if (beat.effects.tremoloBarPresent) {
      document.getElementById('tremoloBar')?.classList.add('pressed');
    }
    if (beat.textPresent) {
      document.getElementById('addText')?.classList.add('pressed');
    }
    if (beat.chordPresent) {
      document.getElementById('addChord')?.classList.add('pressed');
    }
    if (beat.dynamicPresent) {
      document.getElementById(`${beat.dynamic}Dynamic`)?.classList.add('pressed');
    }
  }

  static activateEffectsForMarkedBeat() {
    const {
      trackId, blockId, voiceId, beatId,
    } = tab.markedNoteObj;
    MenuHandler.activateEffectsForBeat(
      Song.measures[trackId][blockId][voiceId][beatId],
    );
  }

  activateEffectsForNote(note: Note) {
    for (const noteEffect of this.noteEffects) {
      if (note[this.elementToProperty[noteEffect]]) {
        document.getElementById(noteEffect)?.classList.add('pressed');
      }
    }
  }

  enableNoteEffectButtons() {
    for (const noteEffect of this.secondStatusBar) {
      (document.getElementById(noteEffect) as HTMLButtonElement).disabled = false;
    }
  }

  disableNoteEffectButtons() {
    for (const noteEffect of this.secondStatusBar) {
      (document.getElementById(noteEffect) as HTMLButtonElement).disabled = true;
    }
  }

  activateEffectsForPos(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  ) {
    this.deactivateAllEffects();
    // console.log(trackId, blockId, voiceId, beatId);
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    const note = beat.notes[string];

    // NOTE EFFECTS
    if (note != null) {
      this.enableNoteEffectButtons();
      this.activateEffectsForNote(note);
    } else if (overlayHandler.isNoteSelected()) {
      this.enableNoteEffectButtons();
    } else {
      this.disableNoteEffectButtons();
    }
    MenuHandler.activateEffectsForBeat(beat);
    MenuHandler.activateEffectsForBlock();
  }

  activateEffectsForMarkedPos() {
    this.activateEffectsForPos(
      tab.markedNoteObj.trackId, tab.markedNoteObj.blockId, tab.markedNoteObj.voiceId,
      tab.markedNoteObj.beatId, tab.markedNoteObj.string,
    );
  }

  // TODO buffer infos in array for speedup
  static checkForNoteToTie(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  ) {
    let noteToTie = null;
    for (let i = blockId; i >= 0; i -= 1) {
      const startBeatId = (i === blockId)
        ? (beatId - 1)
        : Song.measures[trackId][i][voiceId].length - 1;
      for (let j = startBeatId; j >= 0; j -= 1) {
        const { notes } = Song.measures[trackId][i][voiceId][j];
        if (notes != null) {
          if (notes[string] != null) {
            noteToTie = { blockId: i, beatId: j };
            break;
          }
        }
      }
      if (noteToTie != null) {
        break;
      }
    }
    return noteToTie;
  }

  setNoteLengthForMark(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
  ) {
    // TODO where is activate effects called???
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    const duration = beat.duration[0];
    this.chooseNoteLength(duration);

    document.getElementById('doubleDotted')?.classList.remove('pressed');
    document.getElementById('dotted')?.classList.remove('pressed');
    document.getElementById('tied')?.classList.remove('pressed');

    if (beat.dotted) {
      document.getElementById('dotted')?.classList.add('pressed');
    }
    if (beat.doubleDotted) {
      document.getElementById('doubleDotted')?.classList.add('pressed');
    }
    // check if the note is tied
    const note = beat.notes[string];
    // TODO make this more performant
    const tiedDom = document.getElementById('tied') as HTMLButtonElement;
    if (note != null && note.tied) {
      this.noteTiedTo = note.tiedTo;
      tiedDom.disabled = false;
      tiedDom?.classList.add('pressed');
    } else {
      this.noteTiedTo = MenuHandler.checkForNoteToTie(trackId, blockId, voiceId, beatId, string);
      if (this.noteTiedTo == null) {
        tiedDom.disabled = true;
      } else {
        tiedDom.disabled = false;
      }
    }
    const tupletDom = document.getElementById('tuplet') as HTMLButtonElement;
    if (beat.tuplet != null) {
      tupletDom.classList.add('pressed');
    } else {
      tupletDom.classList.remove('pressed');
    }
    // no tuplets of 128ths
    if (duration === 'z' && beat.tuplet == null) {
      tupletDom.disabled = true;
    } else {
      tupletDom.disabled = false;
    }
    MenuHandler.showAvailableTupletSizes(Duration.getDurationOfType(duration));
    // check if setting a dot is possible
  }

  chooseNoteLength(duration: string) {
    if (this.lastNoteLengthButton === this.noteToBeat[duration]) {
      return;
    }
    fastdom.mutate(() => {
      document.getElementById(this.lastNoteLengthButton)?.classList.toggle('pressed');
      this.lastNoteLengthButton = this.noteToBeat[duration];
      AppManager.typeOfNote = duration;
      document.getElementById(this.noteToBeat[duration])?.classList.toggle('pressed');
    });
  }

  noteLengthSelect(id: string, noteLength: string) {
    if (AppManager.duringTrackCreation) {
      return;
    }
    if (
      tab.changeNoteDuration(
        tab.markedNoteObj.trackId, tab.markedNoteObj.blockId, tab.markedNoteObj.voiceId,
        tab.markedNoteObj.beatId, tab.markedNoteObj.string, noteLength, false,
      )
    ) {
      this.chooseNoteLength(noteLength);
    }
  }

  processSpecialSelect(
    trackId: number, blockId: number, voiceId: number, beatId: number, string: number,
    tupleSel: number, id: string, duringRestoration: boolean,
  ) {
    fastdom.mutate(() => {
      const beat = Song.measures[trackId][blockId][voiceId][beatId];
      if (beat == null) { return; }
      const previousDuration = Duration.getDurationOfNote(beat, true);
      if (id === 'dotted' || id === 'doubleDotted') {
        if (id === 'dotted') {
          if (beat.dotted) {
            beat.dotted = false;
          } else if (
            tab.isNotePlaceable(
              trackId, blockId, voiceId, beatId, string,
              previousDuration * 1.5, previousDuration,
            )
          ) {
            beat.dotted = true;
          } else {
            return;
          }
          document.getElementById('dotted')?.classList.toggle('pressed');
          if (beat.doubleDotted) {
            beat.doubleDotted = false;
            document.getElementById('doubleDotted')?.classList.toggle('pressed');
          }
        } else {
          if (beat.doubleDotted) {
            beat.doubleDotted = false;
          } else if (
            tab.isNotePlaceable(
              trackId, blockId, voiceId, beatId, string, previousDuration * 1.75, previousDuration,
            )
          ) {
            beat.doubleDotted = true;
          } else {
            return;
          }
          document.getElementById('doubleDotted')?.classList.toggle('pressed');
          if (beat.dotted) {
            beat.dotted = false;
            document.getElementById('dotted')?.classList.toggle('pressed');
          }
        }
      } else if (id === 'tuplet') {
        const tupletSet = tab.setTuplet(trackId, blockId, voiceId, beatId, tupleSel);
        if (tupletSet) {
          svgDrawer.setDurationsOfBlock(trackId, blockId, voiceId);
          tab.drawTrack(trackId, voiceId, true, null);
          if (duringRestoration === false) {
            revertHandler.addNoteLengthSpecialSelect(
              trackId, blockId, voiceId, beatId, string, tupleSel, id,
            );
          }
        }
        return;
      } else if (id === 'tied' && this.noteTiedTo != null) {
        this.processTiedButtonPress(trackId, blockId, voiceId, beatId, string, this.noteTiedTo);
        // document.getElementById("tied").classList.toggle("pressed");
        revertHandler.addTied(trackId, blockId, voiceId, beatId, string, this.noteTiedTo);
        return;
      } else {
        return;
      }

      if (duringRestoration === false) {
        revertHandler.addNoteLengthSpecialSelect(trackId, blockId, voiceId,
          beatId, string, tupleSel, id);
      }

      const newDuration = Duration.getDurationOfNote(beat, true);
      if (previousDuration !== newDuration) {
        const rescaleNecessary = tab.changeBeatDuration(trackId, blockId, voiceId, beatId,
          string, newDuration, previousDuration, beat.duration);
        svgDrawer.setDurationsOfBlock(trackId, blockId, voiceId);
        classicalNotation.updateVexFlowBlock(trackId, voiceId, blockId);

        if (rescaleNecessary) {
          tab.drawTrack(trackId, voiceId, true, null);
        }
      }
    });
  }

  processTiedButtonPress(
    trackId: number, blockId: number, voiceId: number, beatId: number,
    string: number, noteTiedTo: {blockId: number, beatId: number},
  ) {
    const beat = Song.measures[trackId][blockId][voiceId][beatId];
    // create note if not existent
    let shouldBeTied = false;
    if (beat.notes[string] == null || beat.notes[string]!.tied == null
      || beat.notes[string]!.tied === false) {
      shouldBeTied = true;
    }
    const tiedToNote = Song.measures[trackId][noteTiedTo.blockId][voiceId][
      noteTiedTo.beatId].notes[string];
    if (tiedToNote != null) {
      tiedToNote.tieBegin = shouldBeTied;
      // TODO check if null
      const { fret } = tiedToNote;
      this.setNotesTied(
        trackId, voiceId, noteTiedTo.blockId, blockId, noteTiedTo.beatId + 1,
        beatId, string, fret, shouldBeTied,
      );
    }

    const blocks = [];
    for (let bId = noteTiedTo.blockId; bId <= blockId; bId += 1) {
      blocks.push(bId);
    }
    svgDrawer.rerenderBlocks(trackId, blocks, voiceId);
  }

  setNotesTied(
    trackId: number, voiceId: number, blockIdBegin: number, blockIdEnd: number,
    beatIdStart: number, beatIdEnd: number, string: number, fret: number, shouldBeTied: boolean,
  ) {
    for (let blockId = blockIdBegin; blockId <= blockIdEnd; blockId += 1) {
      const firstBeatId = blockId === blockIdBegin ? beatIdStart : 0;
      const lastBeatId = blockId === blockIdEnd
        ? beatIdEnd
        : Song.measures[trackId][blockId][voiceId].length - 1;
      for (let beatId = firstBeatId; beatId <= lastBeatId; beatId += 1) {
        const beat = Song.measures[trackId][blockId][voiceId][beatId];
        const selectedNote = beat.notes[string];
        if (this.noteTiedTo == null) {
          break;
        }
        const noteTiedToCopy = { ...this.noteTiedTo };
        if (selectedNote == null) { // TODO shouldbetied should be true???
          beat.notes[string] = {
            ...Song.defaultNote(),
            ...{
              fret,
              tied: true,
              tiedTo: noteTiedToCopy,
            },
          };
          // eslint-disable-next-line prefer-destructuring
          beat.duration = beat.duration[0]; // remove rest
        } else {
          selectedNote.tied = shouldBeTied;
          selectedNote.tiedTo = noteTiedToCopy;
          if (shouldBeTied === false) {
            Tab.deleteNote(trackId, blockId, voiceId, beatId, string, false);
            // return beacuse deleteNote already recursively clears
            return;
          }
          selectedNote.fret = fret;
        }
      }
    }
  }

  static addTupletDropdownOption(num: number) {
    const tDrop = document.getElementById('tupletDropDown');
    const option = document.createElement('option');
    option.setAttribute('value', num.toString());
    option.textContent = num.toString();
    tDrop?.appendChild(option);
  }

  static showAvailableTupletSizes(noteDuration: number) {
    const tDrop = document.getElementById('tupletDropDown');
    Helper.removeAllChildren(tDrop);
    // 3 5 6 7 9 11 12 13
    if (noteDuration >= 2) {
      MenuHandler.addTupletDropdownOption(3);
    }
    if (noteDuration >= 4) {
      MenuHandler.addTupletDropdownOption(5);
      MenuHandler.addTupletDropdownOption(6);
      MenuHandler.addTupletDropdownOption(7);
    }
    if (noteDuration >= 8) {
      MenuHandler.addTupletDropdownOption(9);
      MenuHandler.addTupletDropdownOption(10);
      MenuHandler.addTupletDropdownOption(11);
      MenuHandler.addTupletDropdownOption(12);
      MenuHandler.addTupletDropdownOption(13);
    }
  }

  noteLengthSpecialSelect(id: string) {
    if (AppManager.duringTrackCreation) { return; }
    const tupleSel = parseInt(
      (document.getElementById('tupletDropDown') as HTMLInputElement).value, 10,
    );
    if (tab.markedNoteObj == null) {
      alert('Please set note first.');
      return;
    }
    const {
      trackId, blockId, voiceId, beatId, string,
    } = tab.markedNoteObj;
    this.processSpecialSelect(
      trackId, blockId, voiceId, beatId, string, tupleSel, id, false,
    );
  }

  processMeasureSelect(
    trackId: number, blockId: number, voiceId: number, id: string, isRevert: boolean,
  ) {
    fastdom.mutate(() => {
      if (this.lastMeasureSelectButton !== '') {
        document.getElementById(this.lastMeasureSelectButton)?.classList.toggle('pressed');
      }
      if (this.lastMeasureSelectButton !== id) {
        document.getElementById(id)?.classList.toggle('pressed');
      }
      Song.measureMeta[blockId].repeatOpen = !Song.measureMeta[blockId].repeatOpen;
      if (isRevert == null) {
        revertHandler.addMeasureSelect(trackId, blockId, voiceId, id);
      }
      svgDrawer.rerenderBlock(trackId, blockId, voiceId);
    });
  }

  measureSelect(id: string) {
    if (AppManager.duringTrackCreation) {
      return;
    }
    this.processMeasureSelect(
      tab.markedNoteObj.trackId, tab.markedNoteObj.blockId, tab.markedNoteObj.voiceId, id, false,
    );
  }
}

const menuHandler = new MenuHandler();
export { menuHandler, MenuHandler };
export default menuHandler;
