import Song, { type PlayBackInstrument } from '../../stores/song'
import { applyCompressor, compressorReduction, masterCompressor } from './masterCompressor'
import { applyEqBand, eqBandsFlat, masterEqualizer } from './masterEqualizer'
import { setEffectGain as applyEffectGain, type EffectGainType } from './audioModulation'
import { noteToDrum } from './drumKit'
import { Chorus, Freeverb } from './effects'
import { trackAmp } from './ampModel'
import { trackCompressor, trackEq } from './trackInserts'
import type { EqBand, TrackAmp, TrackCompressor } from '../../types/song'

/**
 * The Web Audio graph: one AudioContext, a bus per track and per drum piece (routed into the
 * playing drum track's bus), then master gain → equalizer → limiter → master analyser → speakers.
 *
 * A track bus is input → amp simulation → channel EQ → channel compressor → pan → volume → master
 * (dry); the three inserts are in the chain only while they change the sound (`reroute`), so
 * tracks without them cost nothing. The track's reverb and chorus are sends
 * from after the volume (the mixer knobs, like MIDI CC 91/93). Notes add their SoundFont
 * zone's own sends through `reverbIn`/`chorusIn`, which have their own pan and volume
 * kept equal to the dry path's (`setPan`/`setVolume`).
 */

type AmpModule = typeof import('./ampSimulator')
let ampModule: AmpModule | null = null
let ampModuleLoad: Promise<AmpModule> | null = null

/** The amp simulation is a lazy chunk; tracks that don't use it never load it. */
export function loadAmpModule(): Promise<AmpModule> {
  ampModuleLoad ??= import('./ampSimulator').then((module) => (ampModule = module))
  return ampModuleLoad
}

export class TrackBus {
  /** where notes and drum pieces enter: → amp (when on) → pan */
  readonly input: GainNode
  readonly pan: StereoPannerNode
  readonly volume: GainNode
  readonly analyser: AnalyserNode
  /** the track's send levels (0–1) */
  readonly reverbSend: GainNode
  readonly chorusSend: GainNode
  /** where notes send their zone's reverb and chorus share */
  readonly reverbIn: GainNode
  readonly chorusIn: GainNode
  readonly reverb: Freeverb
  readonly chorus: Chorus
  private readonly sendPans: StereoPannerNode[]
  private readonly sendVolumes: GainNode[]
  /** whether notes go through the amp (also while its chunk is still loading) */
  ampActive = false
  private amp: InstanceType<AmpModule['AmpSimulator']> | null = null
  private ampSettings: TrackAmp | null = null
  /** the channel EQ's filters (created when it is first switched on) */
  private eqFilters: BiquadFilterNode[] = []
  private eqOn = false
  private compressor: DynamicsCompressorNode | null = null
  private compressorOn = false
  /** the inserts the chain runs through now, e.g. "amp,eq" */
  private routing = ''
  private meter: AnalyserNode | null = null
  private compressorMeter: AnalyserNode | null = null
  private disposed = false
  private readonly context: BaseAudioContext

  constructor(
    context: BaseAudioContext,
    output: AudioNode,
    settings: { volume: number; pan: number; reverb: number; chorus: number },
  ) {
    this.context = context
    this.input = context.createGain()
    this.pan = context.createStereoPanner()
    this.input.connect(this.pan)
    this.volume = context.createGain()
    this.pan.connect(this.volume).connect(output)
    this.analyser = context.createAnalyser()
    this.analyser.smoothingTimeConstant = 0.9
    this.analyser.fftSize = 32
    this.volume.connect(this.analyser)

    this.reverb = new Freeverb(context, { dampening: 3000, roomSize: 0.7, wetGain: 1 })
    this.chorus = new Chorus(context, { wetGain: 1 })
    this.reverb.output.connect(output)
    this.chorus.output.connect(output)
    this.reverbSend = context.createGain()
    this.reverbSend.gain.value = settings.reverb
    this.chorusSend = context.createGain()
    this.chorusSend.gain.value = settings.chorus
    this.volume.connect(this.reverbSend).connect(this.reverb.input)
    this.volume.connect(this.chorusSend).connect(this.chorus.input)

    this.reverbIn = context.createGain()
    this.chorusIn = context.createGain()
    this.sendPans = [context.createStereoPanner(), context.createStereoPanner()]
    this.sendVolumes = [context.createGain(), context.createGain()]
    this.reverbIn.connect(this.sendPans[0]).connect(this.sendVolumes[0]).connect(this.reverb.input)
    this.chorusIn.connect(this.sendPans[1]).connect(this.sendVolumes[1]).connect(this.chorus.input)
    this.setVolume(settings.volume)
    this.setPan(settings.pan)
  }

  /** Track volume 0–1 (`smooth`: glide over ~10 ms, for faders). */
  setVolume(value: number, smooth = false): void {
    for (const gain of [this.volume, ...this.sendVolumes]) {
      if (smooth) gain.gain.setTargetAtTime(value, gain.context.currentTime, 0.01)
      else gain.gain.value = value
    }
  }

  /** Pan -1 … 1. */
  setPan(value: number): void {
    for (const pan of [this.pan, ...this.sendPans]) pan.pan.value = value
  }

  /** Turns the amp on or off and sets drive, tone and cabinet; live, while notes sound. */
  setAmp(settings: TrackAmp): void {
    this.ampSettings = settings
    this.ampActive = settings.enabled
    if (settings.enabled && ampModule == null) {
      void loadAmpModule().then(() => {
        if (!this.disposed && this.ampSettings) this.setAmp(this.ampSettings)
      })
      return
    }
    if (settings.enabled && this.amp == null && ampModule != null) {
      this.amp = new ampModule.AmpSimulator(this.context)
    }
    this.amp?.set(settings)
    this.reroute()
  }

  /** The channel EQ (null or flat: out of the chain). Live, while notes sound. */
  setEq(bands: readonly EqBand[] | null): void {
    this.eqOn = bands != null && !eqBandsFlat(bands)
    if (bands != null && (this.eqOn || this.eqFilters.length > 0)) {
      if (this.eqFilters.length === 0) {
        this.eqFilters = bands.map(() => this.context.createBiquadFilter())
        for (let i = 1; i < this.eqFilters.length; i += 1) this.eqFilters[i - 1].connect(this.eqFilters[i])
      }
      bands.forEach((band, index) => applyEqBand(this.eqFilters[index], band))
    }
    this.reroute()
  }

  /** The channel compressor (null or not enabled: out of the chain). */
  setCompressor(settings: TrackCompressor | null): void {
    this.compressorOn = settings?.enabled === true
    if (settings != null && this.compressorOn) {
      this.compressor ??= this.context.createDynamicsCompressor()
      applyCompressor(this.compressor, settings, false)
    }
    this.reroute()
  }

  /** Whether the EQ / compressor are in the chain (tests, the mixer). */
  get eqInChain(): boolean {
    return this.routing.includes('eq')
  }

  get compressorInChain(): boolean {
    return this.routing.includes('comp')
  }

  /** The compressor's gain reduction now, in dB (0 or negative). */
  compressorReduction(): number {
    return this.compressorInChain ? compressorReduction(this.compressor) : 0
  }

  /**
   * A level/spectrum tap after the volume, made on first use (the mixer's meters, the
   * channel EQ's spectrum). The sequencer's `analyser` is too short for peaks.
   */
  meterAnalyser(): AnalyserNode {
    if (this.meter == null) {
      this.meter = this.context.createAnalyser()
      this.meter.fftSize = 4096
      this.meter.smoothingTimeConstant = 0.8
      this.volume.connect(this.meter)
    }
    return this.meter
  }

  /** A tap right after the compressor (the Compressor panel's output meter), made on first use. */
  compressorAnalyser(): AnalyserNode | null {
    if (this.compressor == null) return null
    if (this.compressorMeter == null) {
      this.compressorMeter = this.context.createAnalyser()
      this.compressorMeter.fftSize = 2048
      this.compressor.connect(this.compressorMeter)
    }
    return this.compressorMeter
  }

  /**
   * Connects input → the inserts that are on → pan. Only reconnects when the set changes:
   * knob moves don't touch the wiring.
   */
  private reroute(): void {
    const stages: { name: string; input: AudioNode; output: AudioNode }[] = []
    if (this.ampActive && this.amp != null)
      stages.push({ name: 'amp', input: this.amp.input, output: this.amp.output })
    if (this.eqOn && this.eqFilters.length > 0) {
      stages.push({ name: 'eq', input: this.eqFilters[0], output: this.eqFilters[this.eqFilters.length - 1] })
    }
    if (this.compressorOn && this.compressor != null) {
      stages.push({ name: 'comp', input: this.compressor, output: this.compressor })
    }
    const routing = stages.map((stage) => stage.name).join(',')
    if (routing === this.routing) return
    this.input.disconnect()
    this.amp?.output.disconnect()
    this.eqFilters[this.eqFilters.length - 1]?.disconnect()
    this.compressor?.disconnect()
    if (this.compressor != null && this.compressorMeter != null) this.compressor.connect(this.compressorMeter)
    let previous: AudioNode = this.input
    for (const stage of stages) {
      previous.connect(stage.input)
      previous = stage.output
    }
    previous.connect(this.pan)
    this.routing = routing
  }

  dispose(): void {
    this.disposed = true
    this.amp?.dispose()
    for (const node of [
      this.input,
      this.pan,
      this.volume,
      this.analyser,
      ...this.eqFilters,
      ...(this.compressor ? [this.compressor] : []),
      ...(this.meter ? [this.meter] : []),
      ...(this.compressorMeter ? [this.compressorMeter] : []),
      this.reverbIn,
      this.chorusIn,
      ...this.sendPans,
      ...this.sendVolumes,
    ]) {
      node.disconnect()
    }
    // also stops the chorus LFOs, which otherwise keep running for every rebuild
    this.chorus.dispose()
    this.reverb.dispose()
  }
}

export interface DrumBus {
  volume: GainNode
  pan: StereoPannerNode
  analyser: AnalyserNode
}

function showError(text: string): void {
  void import('../userNotifications').then(({ showUserError }) => showUserError(text))
}

export class AudioGraph<Context extends BaseAudioContext = AudioContext> {
  // The context is passed in, so an OfflineAudioContext can render a song (audio export) and
  // tests can hand in a fake one; the app's graph uses a live AudioContext.
  readonly context: Context

  masterGain: GainNode

  readonly masterAnalyser: AnalyserNode

  constructor(context: Context) {
    this.context = context
    this.masterGain = context.createGain()
    this.masterAnalyser = context.createAnalyser()
  }

  limiter: DynamicsCompressorNode | null = null

  readonly busses: TrackBus[] = []

  readonly drumBusses: DrumBus[] = []

  getCurrentTime(): number {
    return this.context.currentTime
  }

  /** Resumes a suspended context (browsers start it suspended until a user gesture). */
  async ensureContextRunning(): Promise<void> {
    if (this.context.state === 'closed') {
      showError('Audio context is closed. Reload the page to restore playback.')
      return
    }
    if (this.context.state !== 'running') {
      try {
        await (this.context as BaseAudioContext as AudioContext).resume()
      } catch (error) {
        console.error('AudioContext resume failed', error)
        showError('Could not start audio. Click play again after interacting with the page.')
        return
      }
    }
    for (const bus of this.busses) bus?.chorus?.ensureStarted()
  }

  /**
   * The master chain and one bus per drum piece; once at startup. With `copyOf` (an audio
   * render) the graph takes over that graph's settings as they are now (master volume, EQ,
   * limiter, drum pieces) and leaves the panels bound to the live graph.
   */
  createBusses(copyOf?: AudioGraph<BaseAudioContext>): void {
    const limiter = this.context.createDynamicsCompressor()
    limiter.threshold.value = -1.0 // leave some headroom
    limiter.knee.value = 0.0
    limiter.ratio.value = 20.0
    limiter.attack.value = 0.005
    limiter.release.value = 0.05
    this.masterGain = this.context.createGain()
    this.masterGain.gain.value = copyOf?.masterGain.gain.value ?? 1.0
    if (copyOf) {
      masterCompressor.applyTo(limiter)
      let previous: AudioNode = this.masterGain
      for (const filter of masterEqualizer.createFilters(this.context)) previous = previous.connect(filter)
      previous.connect(limiter)
    } else {
      // user settings from the Compressor panel (defaults match the values above)
      masterCompressor.attach(limiter)
      masterEqualizer.setAudioContext(this.context as BaseAudioContext as AudioContext)
      masterEqualizer.insertBetween(this.masterGain, limiter)
    }
    // the analyser passes audio through; connecting the limiter to the destination
    // directly as well would double the output (+6 dB, clipping past the limiter)
    limiter.connect(this.masterAnalyser)
    this.masterAnalyser.connect(this.context.destination)
    this.masterAnalyser.smoothingTimeConstant = 0.9
    this.masterAnalyser.fftSize = 4096
    this.limiter = limiter

    let i = 0
    for (const drumInfo of noteToDrum.values()) {
      const volume = this.context.createGain()
      // (the Drum Mixer sets the live buses' gain and pan directly)
      volume.gain.value = copyOf?.drumBusses[i]?.volume.gain.value ?? drumInfo[2]
      // routed into the playing track's bus on demand (connectDrumBus)
      const pan = this.context.createStereoPanner()
      pan.pan.value = copyOf?.drumBusses[i]?.pan.pan.value ?? 0
      pan.connect(volume)
      const analyser = this.context.createAnalyser()
      volume.connect(analyser)
      // long enough to hold a whole animation frame, so the Drum Mixer's peak meters don't miss hits
      analyser.fftSize = 2048
      this.drumBusses[i] = { volume, pan, analyser }
      i += 1
    }
  }

  /**
   * One bus per track as the live graph has them now (volume, pan, sends, amp), for an audio
   * render. Wait for `loadAmpModule()` first when a track uses the amp.
   */
  copyBussesOf(live: AudioGraph<BaseAudioContext>): void {
    this.updateBusses(Song.playBackInstrument)
    this.busses.forEach((bus, trackId) => {
      const source = live.busses[trackId]
      if (source != null) {
        bus.setVolume(source.volume.gain.value)
        bus.setPan(source.pan.pan.value)
        bus.reverbSend.gain.value = source.reverbSend.gain.value
        bus.chorusSend.gain.value = source.chorusSend.gain.value
      }
      bus.chorus.ensureStarted()
    })
  }

  /** One bus per track, built again whenever the tracks change. */
  updateBusses(channels: PlayBackInstrument[]): void {
    // first disconnect everything: the old chains stay connected to the master
    // otherwise, and drum busses wired into them would sound twice
    for (const bus of this.busses) bus.dispose()
    this.busses.length = 0
    for (let i = 0; i < channels.length; i += 1) {
      this.busses[i] = new TrackBus(this.context, this.masterGain, {
        volume: Song.playBackInstrument[i].volume / 100.0,
        pan: -1 + (channels[i].balance / 127) * 2,
        reverb: channels[i].reverb / 127,
        chorus: channels[i].chorus / 127,
      })
      if (Song.tracks[i]) {
        this.busses[i].setAmp(trackAmp(i))
        this.applyTrackInserts(i)
      }
    }
  }

  /** After a track's amp settings or program changed. */
  applyTrackAmp(trackId: number): void {
    if (Song.tracks[trackId]) this.busses[trackId]?.setAmp(trackAmp(trackId))
  }

  /** After a track's channel EQ or compressor changed (mixer, undo of a track edit, a loaded song). */
  applyTrackInserts(trackId: number): void {
    const bus = this.busses[trackId]
    if (bus == null || Song.tracks[trackId] == null) return
    bus.setEq(trackEq(trackId))
    bus.setCompressor(trackCompressor(trackId))
  }

  /** Drum piece bus → the track bus that plays it (connect() is idempotent). */
  connectDrumBus(drumIndex: number, trackId: number): void {
    const drumBus = this.drumBusses[drumIndex]
    const trackBus = this.busses[trackId]
    if (drumBus == null || trackBus == null) return
    drumBus.volume.connect(trackBus.input)
  }

  setMasterGain(value: number): void {
    this.masterGain.gain.value = value
  }

  /** Mixer knobs (0–127): reverb, chorus or pan of a track bus. */
  setEffectGain(trackIndex: number, value: number, type: EffectGainType): void {
    applyEffectGain(this.busses[trackIndex], value, type)
  }
}

export const audioGraph = new AudioGraph(new AudioContext())
