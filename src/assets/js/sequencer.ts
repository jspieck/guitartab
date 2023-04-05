import fastdom from 'fastdom';
import jQuery from 'jquery';
import 'jquery-ui-dist/jquery-ui';
import Settings from './settingManager';
import { audioEngine } from './audioEngine';
import Song from './songData';
import { overlayHandler } from './overlayHandler';
import knobFactory from './knob';
import Helper from './helper';
import playBackLogic from './playBackLogicNew';
import AppManager from './appManager';
import { svgDrawer, SvgDrawer } from './svgDrawer';
import { modalHandler } from './modalHandler';

class Sequencer {
  colorPalette: string[];

  SEQUENCER_BLOCK_WIDTH: number;

  lastActiveInstrument: HTMLElement | null;

  editModeActive: boolean;

  sequencerMouseDownClientX: number;

  sequencerClickDown: boolean;

  sequencerIntervalSet: boolean;

  indicatorCellHeader: HTMLElement | null;

  indicatorCell: HTMLElement | null;

  indicatorLine: HTMLElement | null;

  indicatorPosition: { trackId: number, blockId: number};

  volumeCanvasContexts: (CanvasRenderingContext2D | null)[];

  sequencerScrollTop: number;

  sequencerScrollLeft: number;

  constructor() {
    this.colorPalette = ['#F8B195', '#F67280', '#C06C84', '#6C5B7B', '#355C7D',
      '#99B898', '#FECEAB', '#FF847C', '#E84A5F', '#2A363B'];
    // var colorPalette = ["#b9aef9", "#75f4d9", "#acf598", "#fdb78d",
    //   "#ae7cee", "#3fdcd0", "#8ade5b", "#fd9483"];
    this.SEQUENCER_BLOCK_WIDTH = 30;
    this.lastActiveInstrument = null;
    this.editModeActive = false;
    this.sequencerMouseDownClientX = 0;
    this.sequencerClickDown = false;
    this.sequencerIntervalSet = false;
    this.indicatorCellHeader = null;
    this.indicatorCell = null;
    this.indicatorLine = null;
    this.indicatorPosition = { trackId: 0, blockId: 0 };
    this.volumeCanvasContexts = [];
    this.sequencerScrollTop = 0;
    this.sequencerScrollLeft = 0;
  }

  markActiveInstrument(index: number) {
    if (this.lastActiveInstrument != null) {
      this.lastActiveInstrument.classList.remove('activeInstrument');
    }
    const instrumentRow = document.getElementById(`instrumentLabel${index}`)?.parentNode as HTMLElement;
    instrumentRow?.classList.add('activeInstrument');
    this.lastActiveInstrument = instrumentRow;
  }

  toggleSequencerEditMode() {
    if (!this.editModeActive) {
      jQuery('.volumeFader').hide();
      jQuery('#sequencerBar .soloBtn').hide();
      jQuery('#sequencerBar .muteBtn').hide();

      jQuery('#sequencerChoInstrument').show();
      jQuery('#sequencerRevInstrument').show();
      jQuery('#sequencerPanInstrument').show();
      jQuery('#sequencerBar .chorusContainer').show();
      jQuery('#sequencerBar .reverbContainer').show();
      jQuery('#sequencerBar .panContainer').show();
      jQuery('.instrumentListDelete').show();
      jQuery('.instrumentChange').show();

      document.getElementById('sequencerEdit')!.style.background = 'rgba(103, 103, 103, 0.22)';

      // jQuery(".instrumentLabel").attr("contenteditable", "true");
      // jQuery('#bodyDiv').sortable();
    } else {
      jQuery('.volumeFader').show();
      jQuery('#sequencerBar .soloBtn').show();
      jQuery('#sequencerBar .muteBtn').show();

      jQuery('#sequencerChoInstrument').hide();
      jQuery('#sequencerRevInstrument').hide();
      jQuery('#sequencerPanInstrument').hide();
      jQuery('#sequencerBar .chorusContainer').hide();
      jQuery('#sequencerBar .reverbContainer').hide();
      jQuery('#sequencerBar .panContainer').hide();
      jQuery('.instrumentListDelete').hide();
      jQuery('.instrumentChange').hide();

      document.getElementById('sequencerEdit')!.style.background = 'transparent';

      // jQuery(".instrumentLabel").attr("contenteditable", "false");

      // jQuery('#bodyDiv').sortable('disable');
      // jQuery('#bodyDiv').disableSelection('disabled');
    }
    this.editModeActive = !this.editModeActive;
  }

  static drawEqualizerButton() {
    const eqButton = document.createElement('div');
    eqButton.setAttribute('class', 'muteBtn');
    const eqButtonCircle = document.createElement('div');
    eqButtonCircle.setAttribute('class', 'muteBtnCircle');
    eqButtonCircle.textContent = 'EQ';
    eqButton.appendChild(eqButtonCircle);
    eqButton.addEventListener('click', () => {
      modalHandler.toggleModal('equalizerModal', 'EQ');
    });
    return eqButton;
  }

  static drawCompButton() {
    const compButton = document.createElement('div');
    compButton.setAttribute('class', 'soloBtn');
    const compButtonCircle = document.createElement('div');
    compButtonCircle.setAttribute('class', 'muteBtnCircle');
    compButtonCircle.textContent = 'C';
    compButton.appendChild(compButtonCircle);
    compButton.addEventListener('click', () => {
      modalHandler.toggleModal('compressorModal', 'Compressor');
    });
    return compButton;
  }

  static soloButtonClickEvent(e: Event, k: number) {
    let circleBtn = e.target as HTMLElement;
    if (circleBtn.classList.contains('soloBtn')) {
      circleBtn = circleBtn.firstChild as HTMLElement;
    }
    if (!Song.playBackInstrument[k].solo) {
      circleBtn.classList.add('muted');
    } else {
      circleBtn.classList.remove('muted');
    }
    Song.playBackInstrument[k].solo = !Song.playBackInstrument[k].solo;
  }

  static muteButtonClickEvent(e: Event, k: number) {
    let circleBtn = e.target as HTMLElement | null;
    if (circleBtn != null) {
      if (circleBtn.classList.contains('muteBtn')) {
        circleBtn = circleBtn.firstChild as HTMLElement | null;
      }
      if (circleBtn != null) {
        if (!Song.playBackInstrument[k].mute) {
          circleBtn.classList.add('muted');
        } else {
          circleBtn.classList.remove('muted');
        }
      }
    }
    Song.playBackInstrument[k].mute = !Song.playBackInstrument[k].mute;
  }

  static createMuteButton(trackId: number) {
    const muteButton = document.createElement('div');
    muteButton.setAttribute('class', 'muteBtn');
    const muteButtonCircle = document.createElement('div');
    muteButtonCircle.setAttribute('class', 'muteBtnCircle');
    muteButtonCircle.textContent = 'M';
    if (Song.playBackInstrument[trackId].mute) {
      muteButtonCircle.classList.add('muted');
    }
    muteButton.appendChild(muteButtonCircle);
    muteButton.addEventListener('click', (e) => {
      Sequencer.muteButtonClickEvent(e, trackId);
    });
    return muteButton;
  }

  static createSoloButton(trackId: number) {
    const soloButton = document.createElement('div');
    const soloButtonCircle = document.createElement('div');
    soloButtonCircle.setAttribute('class', 'muteBtnCircle');
    soloButtonCircle.textContent = 'S';
    if (Song.playBackInstrument[trackId].solo) {
      soloButtonCircle.classList.add('muted');
      // soloButtonCircle.style.background = "rgba(255, 255, 255, 0.8)";
    }
    soloButton.appendChild(soloButtonCircle);
    soloButton.setAttribute('class', 'soloBtn');
    soloButton.addEventListener('click', (e) => {
      Sequencer.soloButtonClickEvent(e, trackId);
    });
    return soloButton;
  }

  static panKnobRotate(angle: number, dataId: string) {
    const trackId = parseInt(dataId, 10);
    console.log(trackId);
    const circumference = knobFactory.getCircumference();
    document.getElementById(`outerRingpanKnob${trackId}`)?.setAttribute('stroke-dashoffset',
      (circumference - (circumference * (angle - 180)) / 360).toString());
    // scale value to the range of 0 to 127
    const scaled = (angle / 360) * 127;
    Song.playBackInstrument[trackId].balance = scaled;
    audioEngine.setEffectGain(trackId, scaled, 'pan');
  }

  static createChangeButton(trackId: number) {
    const changeButton = document.createElement('img');
    changeButton.setAttribute('id', `instrumentChange_${trackId}`);
    changeButton.setAttribute('class', 'instrumentChange');
    if (Settings.darkMode) {
      changeButton.src = './images/changeWhite.svg';
    } else {
      changeButton.src = './images/change.svg';
    }
    changeButton.addEventListener('click', () => {
      AppManager.numberOfTrackToAdd = trackId;
      modalHandler.openInstrumentSettings(trackId);
    });
    return changeButton;
  }

  static createTrashButton(trackId: number) {
    const trashButton = document.createElement('img');
    trashButton.setAttribute('id', `instrumentListDelete_${trackId}`);
    trashButton.setAttribute('class', 'instrumentListDelete');
    if (Settings.darkMode) {
      trashButton.src = './images/trashCanWhite.svg';
    } else {
      trashButton.src = './images/trashCan.svg';
    }
    trashButton.addEventListener('click', () => {
      if (Song.measures.length > 1) {
        modalHandler.openDeleteTrack(trackId);
      } else {
        alert('At least one track must be available!');
      }
    });
    return trashButton;
  }

  getBackgroundColor(id: number) {
    return this.colorPalette[id % this.colorPalette.length];
  }

  static createMasterSlider(container: HTMLElement) {
    const options: JQueryUI.SliderOptions = {
      min: 0,
      max: 127,
      value: Settings.masterVolume * 127,
      range: 'min',
      slide(event: JQueryEventObject, ui: JQueryUI.SliderUIParams) {
        if (ui.value != null) {
          audioEngine.setMasterGain(ui.value / 127);
        }
      },
    };
    jQuery(container).slider(options);
  }

  static createTrackSlider(container: HTMLElement, k: number) {
    const options: JQueryUI.SliderOptions = {
      min: 0,
      max: 127,
      value: Song.playBackInstrument[k].volume,
      range: 'min',
      slide(event: JQueryEventObject, ui: JQueryUI.SliderUIParams) {
        if (ui.value != null) {
          Song.playBackInstrument[k].volume = ui.value;
          audioEngine.busses[k].volume.gain.value = ui.value / 100.0;
        }
      },
    };
    jQuery(container).slider(options);
  }

  getVolumeCanvasContext(i: number) {
    return this.volumeCanvasContexts[i];
  }

  createVolumeFader(i: number) {
    const volumeFader = document.createElement('div');
    volumeFader.setAttribute('class', 'volumeFader');
    const volumeControl = document.createElement('canvas');
    if (i === 0) {
      volumeFader.setAttribute('id', 'masterVolume');
      volumeControl.setAttribute('id', 'masterVolumeCanvas');
    } else {
      volumeControl.setAttribute('id', `volumeControl${i - 1}`);
    }
    volumeControl.setAttribute('class', 'volumeControl');
    volumeControl.width = 90;
    volumeControl.height = 30;
    volumeFader.appendChild(volumeControl);
    this.volumeCanvasContexts[i] = volumeControl.getContext('2d');

    const player = document.createElement('div');
    player.setAttribute('id', 'player');
    const volumeDiv = document.createElement('div');
    volumeDiv.setAttribute('class', 'volume');
    player.appendChild(volumeDiv);
    volumeFader.appendChild(player);

    if (i === 0) {
      Sequencer.createMasterSlider(volumeDiv);
    } else {
      Sequencer.createTrackSlider(volumeDiv, i - 1);
    }
    return volumeFader;
  }

  drawMasterRowMenu() {
    const labelDiv = document.createElement('div');
    labelDiv.setAttribute('class', 'labelDiv disable-select');
    const img = document.createElement('img');
    img.setAttribute('id', 'labelImgMaster');
    img.setAttribute('class', 'labelImg');
    if (Settings.darkMode) {
      img.src = './images/instrumentIcons/myMasterDesignWhite.svg';
    } else {
      img.src = './images/instrumentIcons/myMasterDesign.svg';
    }
    labelDiv.appendChild(img);
    const sLabel = document.createElement('div');
    sLabel.setAttribute('id', 'instrumentLabelMaster');
    sLabel.setAttribute('class', 'label instrumentLabel');
    labelDiv.appendChild(sLabel);
    sLabel.textContent = 'Master';
    labelDiv.appendChild(Sequencer.drawEqualizerButton());
    labelDiv.appendChild(Sequencer.drawCompButton());
    labelDiv.appendChild(this.createVolumeFader(0));
    return labelDiv;
  }

  static createTrackImg(trackId: number) {
    const img = document.createElement('img');
    img.setAttribute('id', `labelImg${trackId}`);
    img.setAttribute('class', 'labelImg');
    img.src = Helper.getIconSrc(Song.playBackInstrument[trackId].instrument);
    if (Settings.sequencerTrackColor && Song.tracks[trackId] != null) {
      const { red, green, blue } = Song.tracks[trackId].color;
      img.style.borderLeft = `3px solid rgb(${red}, ${green}, ${blue})`;
    }
    img.addEventListener('click', () => {
      AppManager.numberOfTrackToAdd = trackId;
      modalHandler.openAddTrack();
    });
    return img;
  }

  createTrackLabel(trackId: number) {
    const sLabel = document.createElement('div');
    sLabel.setAttribute('id', `instrumentLabel${trackId}`);
    sLabel.setAttribute('class', 'label instrumentLabel');
    sLabel.textContent = Song.tracks[trackId].name;
    sLabel.addEventListener('click', () => {
      if (Song.currentTrackId !== trackId) {
        document.getElementById('loadingWheel')!.style.display = 'block';
        setTimeout(() => {
          // playBackLogic.clearQueueAndSetNewBlock(blockId);
          this.markActiveInstrument(trackId);
          const blockId = playBackLogic.getCurrentBlock();
          this.setIndicator(trackId, blockId);
          if (Song.currentTrackId !== trackId) {
            AppManager.changeTrack(trackId, 0, false, () => {
              svgDrawer.setNewClickedPos(trackId, blockId, Song.currentVoiceId, 0, 1);
              svgDrawer.scrollToSvgBlock(trackId, Song.currentVoiceId, blockId);
              document.getElementById('loadingWheel')!.style.display = 'none';
            });
          }
        }, 0);
      }
    }, false);
    sLabel.addEventListener('keyup', () => {
      if (sLabel.textContent != null) {
        Song.tracks[trackId].name = sLabel.textContent;
      }
    }, false);
    return sLabel;
  }

  static createPanKnob(trackId: number) {
    const panRange = {
      start: Song.playBackInstrument[trackId].balance,
      min: 0,
      max: 127,
    };
    const panContainer = document.createElement('div');
    panContainer.setAttribute('class', 'panContainer');
    const panKnob = knobFactory.createKnob(`panKnob${trackId}`, trackId, Sequencer.panKnobRotate, panRange, true);
    panKnob.setAttribute('class', 'panKnob');
    panContainer.appendChild(panKnob);
    return panContainer;
  }

  static reverbKnobRotate(angle: number, dataId: string) {
    const trackId = parseInt(dataId, 10);
    const circumference = knobFactory.getCircumference();
    document.getElementById(`outerRingreverbKnob${trackId}`)?.setAttribute(
      'stroke-dashoffset',
      (circumference - (circumference * angle) / 360).toString(),
    );
    const scaled = (angle / 360) * 127; // scale value from 0 to 127
    Song.playBackInstrument[trackId].reverb = scaled;
    audioEngine.setEffectGain(trackId, scaled, 'reverb');
  }

  static chorusKnobRotate(angle: number, dataId: string) {
    const trackId = parseInt(dataId, 10);
    const circumference = knobFactory.getCircumference();
    document.getElementById(`outerRingchorusKnob${trackId}`)?.setAttribute(
      'stroke-dashoffset',
      (circumference - (circumference * angle) / 360).toString(),
    );
    const scaled = (angle / 360) * 127; // scale value from 0 to 127
    Song.playBackInstrument[trackId].chorus = scaled;
    audioEngine.setEffectGain(trackId, scaled, 'chorus');
  }

  static createReverbKnob(trackId: number) {
    const reverbRange = { start: Song.playBackInstrument[trackId].reverb, min: 0, max: 127 };
    const reverbContainer = document.createElement('div');
    reverbContainer.setAttribute('class', 'reverbContainer');
    const reverbKnob = knobFactory.createKnob(
      `reverbKnob${trackId}`, trackId, Sequencer.reverbKnobRotate, reverbRange, false,
    );
    reverbKnob.setAttribute('class', 'reverbKnob');
    reverbContainer.appendChild(reverbKnob);
    return reverbContainer;
  }

  static createChorusKnob(trackId: number) {
    const chorusRange = { start: Song.playBackInstrument[trackId].chorus, min: 0, max: 127 };
    const chorusContainer = document.createElement('div');
    chorusContainer.setAttribute('class', 'chorusContainer');
    const chorusKnob = knobFactory.createKnob(
      `chorusKnob${trackId}`, trackId, Sequencer.chorusKnobRotate, chorusRange, false,
    );
    chorusKnob.setAttribute('class', 'chorusKnob');
    chorusContainer.appendChild(chorusKnob);
    return chorusContainer;
  }

  drawTrackRowMenu(trackId: number) {
    const labelDiv = document.createElement('div');
    labelDiv.setAttribute('class', 'labelDiv disable-select');
    labelDiv.appendChild(Sequencer.createTrackImg(trackId));
    labelDiv.appendChild(this.createTrackLabel(trackId));
    labelDiv.appendChild(Sequencer.createMuteButton(trackId));
    labelDiv.appendChild(Sequencer.createSoloButton(trackId));
    labelDiv.appendChild(this.createVolumeFader(trackId + 1));
    labelDiv.appendChild(Sequencer.createChorusKnob(trackId));
    labelDiv.appendChild(Sequencer.createReverbKnob(trackId));
    labelDiv.appendChild(Sequencer.createPanKnob(trackId));
    labelDiv.appendChild(Sequencer.createChangeButton(trackId));
    labelDiv.appendChild(Sequencer.createTrashButton(trackId));
    return labelDiv;
  }

  createSequencerEdit() {
    const sequencerEdit = document.createElement('div');
    sequencerEdit.setAttribute('id', 'sequencerEdit');
    sequencerEdit.addEventListener('click', () => {
      this.toggleSequencerEditMode();
    }, false);
    const editImg = document.createElement('img');
    editImg.setAttribute('id', 'sequencerEditImg');
    editImg.src = './images/cogWheel.svg';
    sequencerEdit.appendChild(editImg);
    return sequencerEdit;
  }

  drawBeat() {
    const sequencerSideBar = document.getElementById('sequencerSideBar');
    Helper.removeAllChildren(sequencerSideBar);

    const headerDiv = document.createElement('div');
    headerDiv.setAttribute('class', 'labelDiv headerDiv');

    const headerImg = document.createElement('img');
    headerImg.setAttribute('id', 'sequencerToggle');
    headerImg.setAttribute('class', 'labelImg sequencerHeaderImg');
    headerImg.src = './images/sequencerToggle.svg';
    headerDiv.appendChild(headerImg);

    headerImg.addEventListener('click', () => {
      fastdom.mutate(() => {
        document.getElementById('sequencerWrapper')?.classList.toggle('minimized');
      });
    }, false);

    const headerLabel = document.createElement('div');
    headerLabel.setAttribute('class', 'label unselectable');
    headerLabel.textContent = 'Sequencer';
    headerDiv.appendChild(headerLabel);

    headerDiv.appendChild(this.createSequencerEdit());

    const sequencerAddInstrument = document.createElement('img');
    sequencerAddInstrument.setAttribute('id', 'sequencerAddInstrument');
    sequencerAddInstrument.setAttribute('data-tooltip', 'Add Instrument');
    sequencerAddInstrument.src = './images/addInstrument.svg';
    sequencerAddInstrument.addEventListener('click', () => {
      AppManager.numberOfTrackToAdd = -1;
      modalHandler.openAddTrack();
    }, false);
    headerDiv.appendChild(sequencerAddInstrument);

    const sequencerPanDiv = document.createElement('div');
    sequencerPanDiv.setAttribute('id', 'sequencerPanInstrument');
    sequencerPanDiv.textContent = 'Pan';
    headerDiv.appendChild(sequencerPanDiv);

    const sequencerRevDiv = document.createElement('div');
    sequencerRevDiv.setAttribute('id', 'sequencerRevInstrument');
    sequencerRevDiv.textContent = 'Rev';
    headerDiv.appendChild(sequencerRevDiv);

    const sequencerChoDiv = document.createElement('div');
    sequencerChoDiv.setAttribute('id', 'sequencerChoInstrument');
    sequencerChoDiv.textContent = 'Cho';
    headerDiv.appendChild(sequencerChoDiv);

    sequencerSideBar?.appendChild(headerDiv);

    const bodyDiv = document.createElement('div');
    bodyDiv.setAttribute('id', 'sequencerMenuBody');
    bodyDiv.appendChild(this.drawMasterRowMenu());
    for (let i = 0, len = Song.tracks.length; i < len; i += 1) {
      bodyDiv.appendChild(this.drawTrackRowMenu(i));
    }
    // one beat for testing the waveform
    // var labelDiv = drawOneBeat(1);
    // bodyDiv.appendChild(labelDiv);

    sequencerSideBar?.appendChild(bodyDiv);

    this.redrawSequencerMain();

    // synchronous scrolling
    document.getElementById('sequencerMainBody')?.addEventListener('scroll', () => {
      fastdom.measure(() => {
        const sequencerScrollTop = jQuery('#sequencerMainBody').scrollTop();
        const sequencerScrollLeft = jQuery('#sequencerMainBody').scrollLeft();
        if (sequencerScrollTop != null && sequencerScrollLeft != null) {
          this.sequencerScrollTop = sequencerScrollTop;
          this.sequencerScrollLeft = sequencerScrollLeft;
        }
      });
      fastdom.mutate(() => {
        jQuery('#sequencerMenuBody').scrollTop(this.sequencerScrollTop);
        jQuery('#sequencerMainHeader').scrollLeft(this.sequencerScrollLeft);
      });
    });
    this.markActiveInstrument(Song.currentTrackId);
  }

  drawSequencerBlockNumbers() {
    const blockNumberLine = document.createElement('div');
    blockNumberLine.setAttribute('class', 'sequencerOneBlock');
    for (let i = 0, numBlocks = Song.measures[0].length; i < numBlocks; i += 1) {
      const beatNumber = document.createElement('span');
      beatNumber.setAttribute('class', 'beat beatNumber');
      beatNumber.setAttribute('symbol', i.toString());
      blockNumberLine.appendChild(beatNumber);
    }
    blockNumberLine.addEventListener('click', (e) => {
      this.sequencerClick(e, Song.currentTrackId, Song.currentVoiceId);
    }, false);
    blockNumberLine.addEventListener('mousedown', (e) => {
      this.sequencerMouseDown(e);
    });
    blockNumberLine.addEventListener('mouseup', () => {
      this.sequencerMouseUp();
    });
    blockNumberLine.addEventListener('mousemove', (e) => {
      this.sequencerMouseMove(e);
    });
    return blockNumberLine;
  }

  sequencerClick(e: MouseEvent, trackId: number, voiceId: number) {
    if (this.sequencerIntervalSet) {
      this.sequencerIntervalSet = false;
      return;
    }
    fastdom.mutate(() => {
      const target = e.target as HTMLElement | null;
      if (target != null) {
        const { left } = target.getBoundingClientRect();
        const blockId = Math.floor((target.scrollLeft + e.clientX - left) / 30);
        playBackLogic.clearQueueAndSetNewBlock(blockId);
        this.setIndicator(trackId, blockId);
        if (Song.currentTrackId !== trackId) {
          setTimeout(() => {
            document.getElementById('loadingWheel')!.style.display = 'block';
            this.markActiveInstrument(trackId);
            AppManager.changeTrack(trackId, 0, false, () => {
              playBackLogic.jumpToPosition(blockId, 0, 0);
              // beat and string to 0 and 1 for some value
              svgDrawer.setNewClickedPos(trackId, blockId, voiceId, 0, 1);
              svgDrawer.scrollToSvgBlock(trackId, voiceId, blockId);
              document.getElementById('loadingWheel')!.style.display = 'none';
            });
          });
        } else {
          svgDrawer.scrollToSvgBlock(trackId, voiceId, blockId);
          svgDrawer.setNewClickedPos(trackId, blockId, voiceId, 0, 1);
          playBackLogic.jumpToPosition(blockId, 0, 0);
        }
      }
      overlayHandler.clearAllOverlays();
    });
  }

  drawSequencerMasterRow() {
    const trackLine = document.createElement('div');
    trackLine.setAttribute('id', 'masterRow');
    trackLine.setAttribute('class', 'sequencerOneBlock');
    for (let i = 0, numBlocks = Song.measures[0].length; i < numBlocks; i += 1) {
      // one master bar
      const beatLabel = document.createElement('div');
      beatLabel.setAttribute('id', `sequenceMaster_${i}`);
      beatLabel.setAttribute('class', 'beat masterBeat');
      if (Song.measureMeta[i].marker != null) {
        const beatText = document.createElement('div');
        beatText.textContent = Song.measureMeta[i].marker.text;
        beatText.setAttribute('class', 'beatText');
        beatLabel.appendChild(beatText);
      }
      trackLine.appendChild(beatLabel);
    }
    trackLine.addEventListener('click', (e) => {
      this.sequencerClick(e, Song.currentTrackId, Song.currentVoiceId);
    }, false);
    trackLine.addEventListener('mousedown', (e) => {
      this.sequencerMouseDown(e);
    });
    trackLine.addEventListener('mouseup', () => {
      this.sequencerMouseUp();
    });
    trackLine.addEventListener('mousemove', (e) => {
      this.sequencerMouseMove(e);
    });
    return trackLine;
  }

  drawSequencerTrackRow(trackId: number) {
    const trackLine = document.createElement('div');
    trackLine.setAttribute('class', 'sequencerOneBlock');
    for (let i = 0, numBlocks = Song.measures[0].length; i < numBlocks; i += 1) {
      const beatLabel = document.createElement('span');
      beatLabel.setAttribute('id', `sequence_${trackId}_${i}`);
      beatLabel.setAttribute('class', 'beat');
      trackLine.appendChild(beatLabel);
      if (!Song.isBeatEmpty(trackId, i)) {
        beatLabel.style.background = this.colorPalette[trackId % this.colorPalette.length];
      }
    }
    trackLine.addEventListener('click', (e) => {
      this.sequencerClick(e, trackId, Song.currentVoiceId);
    }, false);
    trackLine.addEventListener('mousedown', (e) => {
      this.sequencerMouseDown(e);
    });
    trackLine.addEventListener('mouseup', () => {
      this.sequencerMouseUp();
    });
    trackLine.addEventListener('mousemove', (e) => {
      this.sequencerMouseMove(e);
    });
    return trackLine;
  }

  sequencerMouseMove(e: MouseEvent) {
    const target: HTMLElement | null = e.target as HTMLElement;
    if (target != null
      && this.sequencerClickDown
      && Math.abs(this.sequencerMouseDownClientX - e.clientX) > 10) {
      const { left } = target.getBoundingClientRect();
      const startX = Math.min(this.sequencerMouseDownClientX, e.clientX);
      const endX = Math.max(this.sequencerMouseDownClientX, e.clientX);
      const blockIntervalStart = Math.floor((target.scrollLeft + startX - left) / 30);
      const blockIntervalEnd = Math.floor((target.scrollLeft + endX - left) / 30);
      const trackId = Song.currentTrackId;
      const voiceId = Song.currentVoiceId;
      overlayHandler.initOverlay(trackId, blockIntervalStart, voiceId, 0);
      svgDrawer.setNewClickedPos(trackId, blockIntervalStart, voiceId, 0, 0);

      const lastBeatId = Song.measures[trackId][blockIntervalEnd][voiceId].length - 1;
      overlayHandler.selectionMove(e, trackId, blockIntervalEnd, voiceId, lastBeatId);

      const sequencerMainBody = document.getElementById('sequencerMainBody');
      const sequencerMainHeader = document.getElementById('sequencerMainHeader');
      const intervalMarkerBody = document.getElementById('intervalMarkerBody');
      const intervalMarkerHeader = document.getElementById('intervalMarkerHeader');
      if (intervalMarkerBody != null) {
        sequencerMainBody?.removeChild(intervalMarkerBody);
      }
      if (intervalMarkerHeader != null) {
        sequencerMainHeader?.removeChild(intervalMarkerHeader);
      }
      const bodyMarker = Sequencer.createIntervalMarker(blockIntervalStart, blockIntervalEnd,
        Song.tracks.length * 30 + 30);
      bodyMarker.setAttribute('id', 'intervalMarkerBody');
      const headerMarker = Sequencer.createIntervalMarker(blockIntervalStart, blockIntervalEnd, 30);
      headerMarker.setAttribute('id', 'intervalMarkerHeader');
      sequencerMainBody?.appendChild(bodyMarker);
      sequencerMainHeader?.appendChild(headerMarker);
      this.sequencerIntervalSet = true;
    }
  }

  sequencerMouseUp() {
    this.sequencerClickDown = false;
    this.sequencerMouseDownClientX = 0;
    if (this.sequencerIntervalSet) {
      overlayHandler.setLoopingInterval();
    }
  }

  sequencerMouseDown(e: MouseEvent) {
    this.sequencerClickDown = true;
    this.sequencerMouseDownClientX = e.clientX;
  }

  static removeOverlay() {
    const intervalMarkerBody = document.getElementById('intervalMarkerBody');
    if (intervalMarkerBody != null) {
      intervalMarkerBody.parentNode?.removeChild(intervalMarkerBody);
    }
    const intervalMarkerHeader = document.getElementById('intervalMarkerHeader');
    if (intervalMarkerHeader != null) {
      intervalMarkerHeader.parentNode?.removeChild(intervalMarkerHeader);
    }
  }

  static createIntervalMarker(blockStart: number, blockEnd: number, height: number) {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    marker.style.left = `${blockStart * 30}px`;
    marker.style.width = `${30 * (blockEnd - blockStart + 1)}px`;
    marker.style.top = '0px';
    marker.style.height = `${height}px`;
    const rect = SvgDrawer.createRect(0, 0, 30 * (blockEnd - blockStart + 1), height, '#adadad', '1', 'rgba(62, 173, 255, 0.19)');
    marker.appendChild(rect);
    return marker;
  }

  redrawSequencerMain() {
    const mainBar = document.getElementById('sequencerMain');
    Helper.removeAllChildren(mainBar);
    const sequencerMainHeader = document.createElement('div');
    sequencerMainHeader.setAttribute('id', 'sequencerMainHeader');
    sequencerMainHeader.appendChild(this.drawSequencerBlockNumbers());
    this.indicatorCellHeader = document.createElement('span');
    this.indicatorCellHeader.setAttribute('id', 'indicatorCellHeader');
    sequencerMainHeader.appendChild(this.indicatorCellHeader);
    const sequencerMainBody = document.createElement('div');
    sequencerMainBody.setAttribute('id', 'sequencerMainBody');
    this.indicatorLine = document.createElement('span');
    this.indicatorLine.setAttribute('id', 'indicator');
    this.indicatorCell = document.createElement('span');
    this.indicatorCell.setAttribute('id', 'indicatorCell');
    sequencerMainBody.appendChild(this.drawSequencerMasterRow());
    for (let trackId = 0; trackId < Song.tracks.length; trackId += 1) {
      sequencerMainBody.appendChild(this.drawSequencerTrackRow(trackId));
    }
    sequencerMainBody.appendChild(this.indicatorLine);
    sequencerMainBody.appendChild(this.indicatorCell);
    mainBar!.appendChild(sequencerMainHeader);
    mainBar!.appendChild(sequencerMainBody);
  }

  setIndicator(trackId: number, blockId: number) {
    if (this.indicatorLine != null
      && this.indicatorCell != null
      && this.indicatorCellHeader != null) {
      this.indicatorLine.style.height = `${(Song.measures.length + 1) * 30}px`;
      if (trackId !== this.indicatorPosition.trackId
        || blockId !== this.indicatorPosition.blockId) {
        this.indicatorLine.style.left = `${blockId * 30}px`;
        this.indicatorCell.style.left = `${blockId * 30}px`;
        this.indicatorCellHeader.style.left = `${blockId * 30}px`;
        this.indicatorCell.style.top = `${(trackId + 1) * 30}px`;
        this.indicatorPosition = { trackId, blockId };
        fastdom.mutate(() => {
          document.getElementById('sequencerMainBody')!.scrollLeft = (blockId * this.SEQUENCER_BLOCK_WIDTH);
        });
      }
    }
  }

  static setMarker(blockId: number) {
    const seqMaster = document.getElementById(`sequenceMaster_${blockId}`);
    Helper.removeAllChildren(seqMaster);
    if (Song.measureMeta[blockId].marker != null) {
      const beatText = document.createElement('div');
      beatText.textContent = Song.measureMeta[blockId].marker.text;
      beatText.setAttribute('class', 'beatText');
      seqMaster?.appendChild(beatText);
    }
  }

  static removeMarker(blockId: number) {
    Helper.removeAllChildren(document.getElementById(`sequenceMaster_${blockId}`));
  }
}

const sequencer = new Sequencer();
export { Sequencer, sequencer };
export default Sequencer;
