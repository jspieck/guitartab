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
// import { svgDrawer } from './svgDrawer';

console.log('File is called!!!!!!');

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
const startUp = function startUp(equalizer: typeof Equalizer, menu: typeof Menu) {
  document.fonts.load('10pt "musicFont"');
  document.fonts.load('10pt "notesFont"');
  Settings.darkMode = Settings.load('darkMode') === 'true';
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

  playBackLogic.initTimerWorker();
  Song.initEmptySong();

  // visualInstruments.createPiano(56); // 8 octaves with 7 white notes each
  audioEngine.createBusses(equalizer);

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

/* function createPDF() {
  document.getElementById('loadingWheel')!.style.display = 'block';
  const numPages = svgDrawer.getNumOfPages();
  const pages = [];
  for (let i = 0; i < numPages; i += 1) {
    const serializer = new XMLSerializer();
    const svg = svgDrawer.getSvgPage(Song.currentTrackId, Song.currentVoiceId, i);
    const str = serializer.serializeToString(svg);
    pages.push(str);
  }
  const w = new Worker('./js/pdfCreationWorker');
  // console.log(pages);
  w.postMessage({
    type: 'start',
    numPages,
    pages,
  });
  w.onmessage = (event) => {
    const blob = event.data;
    document.getElementById('loadingWheel')!.style.display = 'none';
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = 'pdfCreation';
    a.click();
    window.URL.revokeObjectURL(url);
  };
} */

/* function downloadXML() {
  // TODO
  var xmltext = buildXML(song);
  var pom = document.createElement('a');
  var filename = "guitarTab.xml";
  var pom = document.createElement('a');
  var bb = new Blob([xmltext], {type: 'text/plain'});
  pom.setAttribute('href', window.URL.createObjectURL(bb));
  pom.setAttribute('download', filename);
  pom.dataset.downloadurl = ['text/plain', pom.download, pom.href].join(':');
  pom.draggable = true;
  pom.classList.add('dragout');
  pom.click();
} */

// Area for functions if not electron is used
/* $(document).keydown(function(e){
  if( e.which === 89 && e.ctrlKey ){
     //Control + Y
     revertHandler.restoreState();
  }
  else if( e.which === 90 && e.ctrlKey ){
     //Control + Z
     revertHandler.revertState();
  }
}); */
