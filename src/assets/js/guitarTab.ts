// import { ipcRenderer } from "electron";
import Settings from './settingManager';
import playBackLogic from './playBackLogicNew';
import Song from './songData';
import { audioEngine } from './audioEngine';
import midiEngine from './midiReceiver';
import AppManager from './appManager';
import { revertHandler } from './revertHandler';
import { gp5Writer } from './GP5Writ';
import { gProReader } from './GProReader';
import Equalizer from '../../components/Equalizer.vue';
import Menu from '../../components/Menu.vue';
import { menuHandler } from './menuHandler';
import { modalManager } from './modals/modalManager';
import { EqualizerModalHandler } from './modals/equalizerModalHandler';
// import { svgDrawer } from './svgDrawer';

declare global {
  interface Window {
    api: {
      response: (
        channel: string,
        func: (() => void) | ((store: [string, Uint8Array]) => void)
      ) => void,
    },
  }
}

const inBrowser = true;
if (!inBrowser) {
  // Hint: to extend these commands, add the event name
  // to the whitelist in preload.js
  // renderer process
  window.api.response('store-data', (store: [string, Uint8Array]) => {
    console.log('Store Data', store);
    gProReader.processFile(store[0], store[1]);
  });
  window.api.response('exportGP5', () => {
    gp5Writer.writeSong(true);
  });
  window.api.response('saveFile', () => {
    AppManager.saveAsGt(false);
  });
  window.api.response('saveFileAs', () => {
    AppManager.saveAsGt(true);
  });
  window.api.response('revert', () => {
    revertHandler.revertState();
  });
  window.api.response('restore', () => {
    revertHandler.restoreState();
  });
  window.api.response('newFile', () => {
    console.log('New FILE');
    Song.chordsMap = [];
    AppManager.resetVariables();

    Song.initEmptySong();
    AppManager.createGuitarTab(0);
    menuHandler.applyStyleMode();
    // TODO AppManager.createAllInstruments();
    menuHandler.activateEffectsForPos(0, 0, 0, 0, 0);
  });
  window.api.response('saved', () => {
    AppManager.showNotification('Saved!');
  });
}

// let waveSurfer;
// let wml;
const startUp = function startUp() {
  const unlockAudio = () => {
    void audioEngine.ensureContextRunning();
    document.removeEventListener('pointerdown', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };

  document.fonts.load('10pt "musicFont"');
  document.fonts.load('10pt "notesFont"');
  // audioEngine.initSound();
  midiEngine.init();
  // document.getElementById('files').addEventListener('change', handleFileSelect, false);
  // menuHandler.initMenuButtons();

  document.addEventListener('mousewheel', (e: Event) => {
    AppManager.scrollTabEvent(e as WheelEvent);
  });
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    AppManager.keyDownEvent(e);
  });
  document.addEventListener('mouseup', () => {
    AppManager.clickEnding();
  });
  document.addEventListener('pointerdown', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  playBackLogic.initTimerWorker();
  Song.initEmptySong();

  // visualInstruments.createPiano(56); // 8 octaves with 7 white notes each
  audioEngine.createBusses();

  AppManager.createGuitarTab(0);
  /* test: draw audio audioWaveForm
    waveSurfer = WaveSurfer.create({
        container: '#audioWaveForm',
        waveColor: 'rgba(109, 156, 207, 0.8)',
        progressColor: 'purple',
        height: '30',
        normalize: true
    });
    waveSurfer.load('./audio/strings/tremoloStringsC4.ogg'); */
  menuHandler.applyStyleMode();

  audioEngine.loadSF2();

  /* var url = './GeneralMidi/32MbGMStereo.sf2';
    wml = new SoundFont.WebMidiLink();
    wml.setLoadCallback(function(arraybuffer) {
        // ロード完了時の処理
    });
    wml.setup(url); */
};

// window.setInstrumentColor = setInstrumentColor;
export { startUp };
export default startUp;
