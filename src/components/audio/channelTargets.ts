import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue'
import Song from '../../stores/song'
import { audioGraph } from '../../services/audio/audioGraph'
import {
  applyEqBand,
  clampEqBand,
  createDefaultEqBands,
  eqBandsFlat,
  masterEqualizer,
  type EqBand,
} from '../../services/audio/masterEqualizer'
import {
  clampCompressorSettings,
  masterCompressor,
  matchingCompressorPreset,
  type CompressorSettings,
} from '../../services/audio/masterCompressor'
import { DEFAULT_TRACK_COMPRESSOR, trackCompressor, trackEq } from '../../services/audio/trackInserts'
import { setTrackCompressor, setTrackEq } from '../../services/editor/songSettingsCommands'

/**
 * What the Equalizer and Compressor panels edit: the master bus or one track's channel. The
 * panels are the same; only where the settings live and which analyser they read differ.
 */

export interface EqTarget {
  /** null = master */
  readonly trackId: number | null
  readonly bands: Ref<EqBand[]>
  setBand(index: number, patch: Partial<EqBand>): void
  resetBands(): void
  isFlat(): boolean
  /** filter nodes with the current settings, for drawing the response curves */
  responseNodes(): BiquadFilterNode[]
  /** the spectrum to draw under the curves, or null to use the master data the meters loop hands in */
  readSpectrum(): Uint8Array | null
  readonly sampleRate: number
}

export interface CompressorTarget {
  readonly trackId: number | null
  readonly settings: CompressorSettings
  readonly bypass: Ref<boolean> | ComputedRef<boolean>
  update(patch: Partial<CompressorSettings>): void
  setBypass(bypass: boolean): void
  reduction(): number
  matchingPreset(): string
  /** where the output meter reads (after the compressor) */
  outputAnalyser(): AnalyserNode | null
}

export const masterEqTarget: EqTarget = {
  trackId: null,
  bands: masterEqualizer.bands,
  setBand: (index, patch) => masterEqualizer.setBand(index, patch),
  resetBands: () => masterEqualizer.resetBands(),
  isFlat: () => masterEqualizer.isFlat(),
  responseNodes: () => masterEqualizer.equalizerNodes,
  readSpectrum: () => null,
  get sampleRate() {
    return masterEqualizer.sampleRate
  },
}

function sameBands(a: readonly EqBand[], b: readonly EqBand[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** A track's channel EQ. Bands equal to the defaults are not stored (`track.eq` absent). */
export function trackEqTarget(trackId: number): EqTarget {
  const bands = ref<EqBand[]>(trackEq(trackId) ?? createDefaultEqBands())
  // unconnected copies: the bus has no filters while the EQ is flat, the curves still need some
  const nodes = bands.value.map((band) => {
    const node = audioGraph.context.createBiquadFilter()
    applyEqBand(node, band)
    return node
  })
  let spectrum: Uint8Array | null = null
  const store = () => {
    const value = bands.value.map((band) => ({ ...band }))
    setTrackEq(trackId, sameBands(value, createDefaultEqBands()) ? null : value)
  }
  return {
    trackId,
    bands,
    setBand(index, patch) {
      const band = bands.value[index]
      if (band == null || Song.tracks[trackId] == null) return
      Object.assign(band, clampEqBand({ ...band, ...patch }))
      applyEqBand(nodes[index], band)
      store()
    },
    resetBands() {
      createDefaultEqBands().forEach((band, index) => {
        Object.assign(bands.value[index], band)
        applyEqBand(nodes[index], band)
      })
      store()
    },
    isFlat: () => eqBandsFlat(bands.value),
    responseNodes: () => nodes,
    readSpectrum() {
      const analyser = audioGraph.busses[trackId]?.meterAnalyser()
      if (analyser == null) return null
      if (spectrum?.length !== analyser.frequencyBinCount)
        spectrum = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(spectrum)
      return spectrum
    },
    sampleRate: audioGraph.context.sampleRate,
  }
}

export const masterCompressorTarget: CompressorTarget = {
  trackId: null,
  settings: masterCompressor.settings,
  bypass: masterCompressor.bypass,
  update: (patch) => masterCompressor.update(patch),
  setBypass: (bypass) => masterCompressor.setBypass(bypass),
  reduction: () => masterCompressor.reduction(),
  matchingPreset: () => masterCompressor.matchingPreset(),
  outputAnalyser: () => audioGraph.masterAnalyser,
}

/**
 * A track's channel compressor; bypassed = off (out of the bus). An unused compressor with
 * the default settings is not stored.
 */
export function trackCompressorTarget(trackId: number): CompressorTarget {
  const stored = trackCompressor(trackId)
  const { enabled: _enabled, ...defaults } = DEFAULT_TRACK_COMPRESSOR
  const settings = reactive<CompressorSettings>(clampCompressorSettings(stored ?? defaults))
  const enabled = ref(stored?.enabled === true)
  const store = () => {
    if (Song.tracks[trackId] == null) return
    const current = clampCompressorSettings(settings)
    const untouched =
      !enabled.value && JSON.stringify(current) === JSON.stringify(clampCompressorSettings(defaults))
    setTrackCompressor(trackId, untouched ? null : { ...current, enabled: enabled.value })
  }
  return {
    trackId,
    settings,
    bypass: computed(() => !enabled.value),
    update(patch) {
      Object.assign(settings, clampCompressorSettings({ ...settings, ...patch }))
      store()
    },
    setBypass(bypass) {
      enabled.value = !bypass
      store()
    },
    reduction: () => audioGraph.busses[trackId]?.compressorReduction() ?? 0,
    matchingPreset: () => matchingCompressorPreset(settings),
    outputAnalyser() {
      // bypassed, the compressor is out of the chain and its tap silent: show the channel instead
      const bus = audioGraph.busses[trackId]
      if (bus == null) return null
      return bus.compressorInChain ? bus.compressorAnalyser() : bus.meterAnalyser()
    },
  }
}

/** The name the panels show in their title: the track's name or "Master". */
export function targetName(trackId: number | null): string {
  if (trackId == null) return 'Master'
  return Song.tracks[trackId]?.name?.trim() || `Track ${trackId + 1}`
}
