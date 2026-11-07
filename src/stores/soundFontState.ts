import { reactive } from 'vue'

/**
 * Loading the SoundFont (30–40 MB): its progress for the Play buttons, and a Play pressed
 * before it arrived. 'idle' means nothing loads it (unit tests): Play then plays at once.
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
})

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
