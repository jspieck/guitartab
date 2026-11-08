import Song from '../stores/song'
import {
  hasCompletedFirstVisit,
  markFirstVisitComplete,
  seedDemoNotes,
  wantsSmallDemo,
} from '../data/demoSong'
import { startFirstRunHint } from '../stores/firstRunHintState'
import { markStartupStepDone } from '../utils/startupReadiness'
import { setSoundFontLoading, setSoundFontSettled } from '../stores/soundFontState'
import { audioGraph } from './audio/audioGraph'
import { handleKeyDown } from './editor/keyboardDispatch'
import { loadSongIntoEditor } from './editor/trackLoading'
import { zoomOnWheel } from './editor/zoom'
import playback from './playback'
import { loadBuiltSong } from './songImport'
import { showUserError } from './userNotifications'
import { showWhatsNewAfterUpdate } from './whatsNew'

/**
 * Starts the editor once the app is mounted: document listeners (shortcuts, Ctrl + wheel
 * zoom, unlocking audio on the first gesture), the playback timer, the audio graph, the
 * first song (the demo on a first visit) and, in the background, the SoundFont.
 */
export function startUp(): void {
  // Browsers start audio suspended until a user gesture.
  const unlockAudio = () => {
    void audioGraph.ensureContextRunning()
    document.removeEventListener('pointerdown', unlockAudio)
    document.removeEventListener('keydown', unlockAudio)
  }

  void document.fonts.load('10pt "musicFont"')

  document.addEventListener('wheel', zoomOnWheel, { passive: false })
  document.addEventListener('keydown', handleKeyDown, true)
  document.addEventListener('pointerdown', unlockAudio)
  document.addEventListener('keydown', unlockAudio)

  playback.init()
  Song.initEmptySong()
  audioGraph.createBusses()

  const firstVisit = !hasCompletedFirstVisit()
  if (firstVisit && wantsSmallDemo()) seedDemoNotes()
  if (firstVisit) markFirstVisitComplete()

  loadSongIntoEditor(0)
  // Screen reader announcements of cursor moves; not needed for the first paint.
  void import('./a11y/cursorAnnouncer').then(({ startCursorAnnouncements }) => startCursorAnnouncements())
  if (firstVisit && !wantsSmallDemo()) {
    startFirstRunHint()
    // The multi-track demo lives in its own chunk, so it costs nothing after the first visit.
    void import('../data/demoArrangement')
      .then(({ buildDemoArrangement }) => loadBuiltSong(buildDemoArrangement()))
      .catch(() => {
        // e.g. offline on the first visit: keep the empty song instead of a silent blank page
        showUserError("Couldn't load the demo song. You can start with this empty one.")
      })
      .finally(() => markStartupStepDone('editor'))
  } else {
    markStartupStepDone('editor')
  }
  // After an update: the newest CHANGELOG entry, once (not on a first visit).
  showWhatsNewAfterUpdate(firstVisit)
  // Play waits for the instruments from now on; the reader is its own chunk (Big win 32)
  setSoundFontLoading(0, 0)
  void import('./audio/soundFont/loader')
    .then(({ loadSoundFont }) => loadSoundFont())
    .catch(() => {
      setSoundFontSettled('failed')
      showUserError('Could not load the instruments. Playback may be silent; reload to try again.')
    })
}
