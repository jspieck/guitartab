import { reactive, watch } from 'vue'

/**
 * Loading the SoundFont: its progress for the Play buttons, and a Play pressed before it
 * arrived. 'idle' means nothing loads it (unit tests): Play then plays at once. Streamed
 * (Big win 32: the presets a song uses first, by range requests), 'ready' means the song's
 * presets were in once; `loadedPresets` says which presets can sound since.
 */
export type SoundFontStatus = 'idle' | 'loading' | 'ready' | 'failed'

export const soundFontState = reactive({
  status: 'idle' as SoundFontStatus,
  /** an SF3 downloads, then decodes its samples (progress counts samples then) */
  stage: 'download' as 'download' | 'decode',
  loadedBytes: 0,
  /** 0 while the size is unknown */
  totalBytes: 0,
  /** Play was pressed while loading: playback starts when the instruments are there */
  playWhenReady: false,
  /** the SoundFont arrives preset by preset (else it loads as one file) */
  streaming: false,
  /** streamed presets whose samples are all in, by `presetKey` */
  loadedPresets: {} as Record<string, true>,
})

/** "bank:preset" of a SoundFont preset; program 9 (drums) is bank 128, preset 0. */
export function presetKey(program: number, bank = 0): string {
  return program === 9 ? '128:0' : `${bank}:${program}`
}

/** True while a preset's samples are still on their way (a track shows "Loading sound"). */
export function isPresetLoading(key: string): boolean {
  if (soundFontState.status === 'loading') return true
  return soundFontState.streaming && soundFontState.status === 'ready' && !soundFontState.loadedPresets[key]
}

/** Resolves when none of `keys` is loading any more (at once without streaming). */
export function whenPresetsLoaded(keys: string[]): Promise<void> {
  const settled = () =>
    soundFontState.status === 'failed' || soundFontState.status === 'idle' || !keys.some(isPresetLoading)
  if (settled()) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = watch(settled, (done) => {
      if (!done) return
      stop()
      resolve()
    })
  })
}

export function markPresetLoaded(key: string): void {
  soundFontState.loadedPresets[key] = true
}

/** 0…1, or null while the size is unknown. */
export function soundFontProgress(): number | null {
  if (soundFontState.totalBytes <= 0) return null
  return Math.min(1, soundFontState.loadedBytes / soundFontState.totalBytes)
}

/** "Loading instruments… 45 %" (or without the number) while loading, else null. */
export function soundFontLoadingLabel(): string | null {
  if (soundFontState.status !== 'loading') return null
  const progress = soundFontProgress()
  const amount = progress == null ? '' : ` ${Math.round(progress * 100)} %`
  if (soundFontState.playWhenReady) return `Starts when the instruments are loaded…${amount}`
  return soundFontState.stage === 'decode'
    ? `Preparing instruments…${amount}`
    : `Loading instruments…${amount}`
}

const listeners: (() => void)[] = []

/** Runs `listener` every time a load ends (ready or failed). */
export function onSoundFontSettled(listener: () => void): void {
  listeners.push(listener)
}

export function setSoundFontLoading(loadedBytes: number, totalBytes: number): void {
  soundFontState.status = 'loading'
  soundFontState.stage = 'download'
  soundFontState.loadedBytes = loadedBytes
  soundFontState.totalBytes = totalBytes
}

/** SF3 samples decoded so far (the progress ring restarts for this stage). */
export function setSoundFontDecoding(decoded: number, total: number): void {
  soundFontState.status = 'loading'
  soundFontState.stage = 'decode'
  soundFontState.loadedBytes = decoded
  soundFontState.totalBytes = total
}

export function setSoundFontSettled(status: 'ready' | 'failed'): void {
  soundFontState.status = status
  listeners.forEach((listener) => listener())
}
