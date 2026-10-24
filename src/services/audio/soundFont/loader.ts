import { markStartupStepDone } from '../../../utils/startupReadiness'
import { synth } from './synth'

/** Where the app's SoundFont is served from (see public/audio/README.txt). */
export const SOUND_FONT_URL = './audio/Roland SC-55Edited.sf2'

// lazy, so the notification store stays out of the audio chunk's startup path
function showError(text: string): void {
  void import('../../userNotifications').then(({ showUserError }) => showUserError(text))
}

/** Parses SoundFont bytes into the synth's banks and marks `data-soundfont-ready`. */
export function loadSoundFontBytes(input: Uint8Array): void {
  synth.init(input)
  markStartupStepDone('soundfont')
}

/** Fetches and loads the SoundFont in the background; failures only show a banner. */
export function loadSoundFont(url = SOUND_FONT_URL): void {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.responseType = 'arraybuffer'
  xhr.addEventListener('load', () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      showError(`SoundFont missing (${xhr.status}). Place the SF2 under /audio/ — see DEPLOYMENT.md.`)
      return
    }
    const response = xhr.response as ArrayBuffer | null
    if (!response || response.byteLength === 0) {
      showError('SoundFont file was empty. Check /audio/ hosting for deploy.')
      return
    }
    loadSoundFontBytes(new Uint8Array(response))
  })
  xhr.addEventListener('error', () => {
    showError('Could not load SoundFont. Playback instruments may be silent.')
  })
  xhr.send()
}
