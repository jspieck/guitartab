import {
  setSoundFontDecoding,
  setSoundFontLoading,
  setSoundFontSettled,
  soundFontState,
} from '../../../stores/soundFontState'
import { markStartupStepDone } from '../../../utils/startupReadiness'
import { buildBanksFrom } from './banks'
import { parseSoundFont } from './parser'
import { decodeCompressedSamples, hasCompressedSamples } from './sf3'
import { streamSoundFont, WholeFileError, type SoundFontManifest } from './streaming'
import { synth } from './synth'

/**
 * Loads the SoundFont (lazy `soundfont` chunk, with the parser, SF3 decoding and bank
 * building; startup only needs `synth.ts` to look notes up). With a manifest from the build
 * (`public/audio/manifest.json`, Big win 32) it streams the hashed SF3 preset by preset
 * (`streaming.ts`); otherwise, and for `?soundfont=`, it loads one file whole.
 */

/** The audio folder next to index.html (uploaded by hand, see public/audio/README.txt). */
export const AUDIO_FOLDER = './audio/'

/** The uncompressed GeneralUser GS: loaded whole without a manifest, and the SF3's fallback. */
export const SOUND_FONT_URL = `${AUDIO_FOLDER}GeneralUser-GS.sf2`

/** Banks `?soundfont=<name>` loads instead, to compare them by ear. */
const ALTERNATIVE_SOUND_FONTS: Record<string, string> = {
  musescore: `${AUDIO_FOLDER}MuseScore_General.sf3`,
  // the uncompressed original, against the streamed SF3
  sf2: SOUND_FONT_URL,
}

/** What the build read from `public/audio/manifest.json` (null without one). */
const BUILT_MANIFEST: SoundFontManifest | null =
  typeof __SOUND_FONT_MANIFEST__ === 'undefined' ? null : __SOUND_FONT_MANIFEST__

/** The SoundFont to load whole: the default, or the one `?soundfont=` names. */
export function soundFontUrl(search = globalThis.location?.search ?? ''): string {
  const name = new URLSearchParams(search).get('soundfont')
  return (name && ALTERNATIVE_SOUND_FONTS[name]) || SOUND_FONT_URL
}

// lazy, so the notification store stays out of this chunk's path
export function showSoundFontError(text: string): void {
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

/** Fetches one SoundFont file and loads it (progress in `soundFontState`); failures only show a banner. */
export function loadWholeSoundFont(url: string): void {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.responseType = 'arraybuffer'
  setSoundFontLoading(0, 0)
  xhr.addEventListener('progress', (event) => {
    setSoundFontLoading(event.loaded, event.lengthComputable ? event.total : 0)
  })
  xhr.addEventListener('load', () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      showSoundFontError(`SoundFont missing (${xhr.status}). Place it under /audio/ — see DEPLOYMENT.md.`)
      return
    }
    const response = xhr.response as ArrayBuffer | null
    if (!response || response.byteLength === 0) {
      showSoundFontError('SoundFont file was empty. Check /audio/ hosting for deploy.')
      return
    }
    loadSoundFontBytes(new Uint8Array(response))
      .then(() => {
        document.documentElement.dataset.soundfont = url
        // an A/B comparison has to be verifiable: which bank is playing
        if (url !== SOUND_FONT_URL || new URLSearchParams(location.search).has('soundfont'))
          void import('../../userNotifications').then(({ showUserMessage }) =>
            showUserMessage(`SoundFont: ${decodeURIComponent(url.split('/').pop() ?? url)}`),
          )
      })
      .catch((error: unknown) => {
        console.error(error)
        showSoundFontError('The SoundFont could not be read. Playback instruments may be silent.')
      })
  })
  xhr.addEventListener('error', () => {
    showSoundFontError('Could not load SoundFont. Playback instruments may be silent.')
  })
  xhr.send()
}

/**
 * Loads the SoundFont in the background: streamed when the build has a manifest and no
 * `?soundfont=` asks for another bank, else as one file. A streamed file that can't be read
 * (missing on the server, no Vorbis decoder) falls back to the whole SF2.
 */
export function loadSoundFont(search = globalThis.location?.search ?? ''): void {
  const manifest = BUILT_MANIFEST
  if (manifest && !new URLSearchParams(search).get('soundfont')) {
    void streamSoundFont(manifest, AUDIO_FOLDER).catch((error: unknown) => {
      soundFontState.streaming = false
      synth.onMissingPreset = null
      // a server without range requests sent the whole SF3: use it
      if (error instanceof WholeFileError)
        return loadSoundFontBytes(error.bytes).catch(() => loadWholeSoundFont(SOUND_FONT_URL))
      console.warn('Streaming the SoundFont failed; loading the SF2 instead.', error)
      loadWholeSoundFont(SOUND_FONT_URL)
    })
    return
  }
  loadWholeSoundFont(soundFontUrl(search))
}
