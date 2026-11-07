import {
  setSoundFontDecoding,
  setSoundFontLoading,
  setSoundFontSettled,
} from '../../../stores/soundFontState'
import { markStartupStepDone } from '../../../utils/startupReadiness'
import { parseSoundFont } from './parser'
import { decodeCompressedSamples, hasCompressedSamples } from './sf3'
import { buildBanksFrom, synth } from './synth'

/** Where the app's SoundFont (GeneralUser GS) is served from (see public/audio/README.txt). */
export const SOUND_FONT_URL = './audio/GeneralUser-GS.sf2'

/** Banks `?soundfont=<name>` loads instead, to compare them by ear. */
const ALTERNATIVE_SOUND_FONTS: Record<string, string> = {
  musescore: './audio/MuseScore_General.sf3',
}

/** The SoundFont to load: the default, or the one `?soundfont=` names. */
export function soundFontUrl(search = globalThis.location?.search ?? ''): string {
  const name = new URLSearchParams(search).get('soundfont')
  return (name && ALTERNATIVE_SOUND_FONTS[name]) || SOUND_FONT_URL
}

// lazy, so the notification store stays out of the audio chunk's startup path
function showError(text: string): void {
  setSoundFontSettled('failed')
  void import('../../userNotifications').then(({ showUserError }) => showUserError(text))
}

/**
 * Parses SoundFont bytes into the synth's banks and marks `data-soundfont-ready`. An SF2
 * loads synchronously; an SF3 first decodes its samples (progress in `soundFontState`).
 */
export async function loadSoundFontBytes(input: Uint8Array): Promise<void> {
  const data = parseSoundFont(input)
  if (hasCompressedSamples(data)) {
    const failed = await decodeCompressedSamples(data, setSoundFontDecoding)
    if (failed.length)
      console.warn(`SoundFont: ${failed.length} samples could not be decoded and stay silent:`, failed)
  }
  synth.bankSet = buildBanksFrom(data)
  markStartupStepDone('soundfont')
  setSoundFontSettled('ready')
}

/** Fetches and loads the SoundFont in the background (progress in `soundFontState`); failures only show a banner. */
export function loadSoundFont(url = soundFontUrl()): void {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.responseType = 'arraybuffer'
  setSoundFontLoading(0, 0)
  xhr.addEventListener('progress', (event) => {
    setSoundFontLoading(event.loaded, event.lengthComputable ? event.total : 0)
  })
  xhr.addEventListener('load', () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      showError(`SoundFont missing (${xhr.status}). Place it under /audio/ — see DEPLOYMENT.md.`)
      return
    }
    const response = xhr.response as ArrayBuffer | null
    if (!response || response.byteLength === 0) {
      showError('SoundFont file was empty. Check /audio/ hosting for deploy.')
      return
    }
    loadSoundFontBytes(new Uint8Array(response))
      .then(() => {
        document.documentElement.dataset.soundfont = url
        // an A/B comparison has to be verifiable: which bank is playing
        if (url !== SOUND_FONT_URL)
          void import('../../userNotifications').then(({ showUserMessage }) =>
            showUserMessage(`SoundFont: ${decodeURIComponent(url.split('/').pop() ?? url)}`),
          )
      })
      .catch((error: unknown) => {
        console.error(error)
        showError('The SoundFont could not be read. Playback instruments may be silent.')
      })
  })
  xhr.addEventListener('error', () => {
    showError('Could not load SoundFont. Playback instruments may be silent.')
  })
  xhr.send()
}
