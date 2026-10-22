import playBackLogic from './playbackEngine';
import Song from './songData';
import { audioEngine } from './audioEngine';
import AppManager from './appManager';
import { gProReader } from './GProReader';
import {
  hasCompletedFirstVisit, markFirstVisitComplete, seedDemoNotes, wantsSmallDemo,
} from '../../data/demoSong';
import { startFirstRunHint } from '../../stores/firstRunHintState';
import { markStartupStepDone } from '../../utils/startupReadiness';
import { showUserError } from '../../services/userNotifications';
import { loadSongIntoEditor } from '../../services/editor/trackLoading';
// import { svgDrawer } from './svgDrawer';

const startUp = function startUp() {
  const unlockAudio = () => {
    void audioEngine.ensureContextRunning();
    document.removeEventListener('pointerdown', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };

  document.fonts.load('10pt "musicFont"');
  document.fonts.load('10pt "notesFont"');

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

  audioEngine.createBusses();

  const firstVisit = !hasCompletedFirstVisit();
  if (firstVisit && wantsSmallDemo()) {
    seedDemoNotes();
  }
  if (firstVisit) {
    markFirstVisitComplete();
  }

  loadSongIntoEditor(0);
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
  audioEngine.loadSF2();

};

export { startUp };
export default startUp;
