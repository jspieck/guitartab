import Settings from './settingManager';
import playBackLogic from './playbackEngine';
import Song from './songData';
import { audioEngine } from './audioEngine';
import midiEngine from './midiReceiver';
import AppManager from './appManager';
import { gProReader } from './GProReader';
import { menuHandler } from './menuHandler';
import { modalManager } from './modals/modalManager';
import {
  hasCompletedFirstVisit, markFirstVisitComplete, seedDemoNotes, wantsSmallDemo,
} from '../../data/demoSong';
import { startFirstRunHint } from '../../stores/firstRunHintState';
import { markStartupStepDone } from '../../utils/startupReadiness';
import { showUserError } from '../../services/userNotifications';
// import { svgDrawer } from './svgDrawer';

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
  }, true);
  document.addEventListener('mouseup', () => {
    AppManager.clickEnding();
  });
  document.addEventListener('pointerdown', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  playBackLogic.initTimerWorker();
  Song.initEmptySong();

  // visualInstruments.createPiano(56); // 8 octaves with 7 white notes each
  audioEngine.createBusses();

  const firstVisit = !hasCompletedFirstVisit();
  if (firstVisit && wantsSmallDemo()) {
    seedDemoNotes();
  }
  if (firstVisit) {
    markFirstVisitComplete();
  }

  AppManager.createGuitarTab(0);
  if (firstVisit && !wantsSmallDemo()) {
    startFirstRunHint();
    // The multi-track demo lives in its own chunk, so it costs nothing after the first visit.
    void import('../../data/demoArrangement').then(({ buildDemoArrangement }) => {
      gProReader.loadBuiltSong(buildDemoArrangement());
    }).catch(() => {
      // e.g. offline on the first visit: keep the empty song instead of a silent blank page
      showUserError("Couldn't load the demo song. You can start with this empty one.");
    }).finally(() => {
      markStartupStepDone('editor');
    });
  } else {
    markStartupStepDone('editor');
  }
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
