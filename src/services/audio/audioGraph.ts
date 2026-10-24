import Song, { type PlayBackInstrument } from '../../stores/song'
import { modalManager } from '../dialogs/modalManager'
import type { CompressorModalHandler } from '../dialogs/compressorModalHandler'
import type { EqualizerModalHandler } from '../dialogs/equalizerModalHandler'
import { setEffectGain as applyEffectGain, type EffectGainType } from './audioModulation'
import { noteToDrum } from './drumKit'
import { Chorus, Freeverb } from './effects'

/**
 * The Web Audio graph: one AudioContext, a bus per track (pan → volume → chorus → reverb →
 * master) and per drum piece (routed into the playing drum track's bus), then
 * master gain → equalizer → limiter → master analyser → speakers.
 */

export interface TrackBus {
  volume: GainNode
  pan: StereoPannerNode
  analyser: AnalyserNode
  /** the reverb (named for the convolution reverb it replaced) */
  convolver: Freeverb
  chorus: Chorus
}

export interface DrumBus {
  volume: GainNode
  pan: StereoPannerNode
  analyser: AnalyserNode
}

function showError(text: string): void {
  void import('../userNotifications').then(({ showUserError }) => showUserError(text))
}

class AudioGraph {
  readonly context = new AudioContext()

  masterGain: GainNode = this.context.createGain()

  readonly masterAnalyser: AnalyserNode = this.context.createAnalyser()

  limiter: DynamicsCompressorNode | null = null

  equalizerHandler: EqualizerModalHandler | null = null

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
        await this.context.resume()
      } catch (error) {
        console.error('AudioContext resume failed', error)
        showError('Could not start audio. Click play again after interacting with the page.')
        return
      }
    }
    for (const bus of this.busses) bus?.chorus?.ensureStarted()
  }

  /** The master chain and one bus per drum piece; once at startup. */
  createBusses(): void {
    const limiter = this.context.createDynamicsCompressor()
    limiter.threshold.value = -1.0 // leave some headroom
    limiter.knee.value = 0.0
    limiter.ratio.value = 20.0
    limiter.attack.value = 0.005
    limiter.release.value = 0.05
    // user settings from the Compressor panel (defaults match the values above)
    modalManager.getHandler<CompressorModalHandler>('compressorModal').attach(limiter)
    this.masterGain = this.context.createGain()
    this.masterGain.gain.value = 1.0
    this.equalizerHandler = modalManager.getHandler('equalizerModal') as EqualizerModalHandler
    this.equalizerHandler.setAudioContext(this.context)
    this.equalizerHandler.insertBetween(this.masterGain, limiter)
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
      volume.gain.value = drumInfo[2]
      // routed into the playing track's bus on demand (connectDrumBus)
      const pan = this.context.createStereoPanner()
      pan.pan.value = 0
      pan.connect(volume)
      const analyser = this.context.createAnalyser()
      volume.connect(analyser)
      // long enough to hold a whole animation frame, so the Drum Mixer's peak meters don't miss hits
      analyser.fftSize = 2048
      this.drumBusses[i] = { volume, pan, analyser }
      i += 1
    }
  }

  /** One bus per track, built again whenever the tracks change. */
  updateBusses(channels: PlayBackInstrument[]): void {
    // first disconnect everything: the old chains stay connected to the master
    // otherwise, and drum busses wired into them would sound twice
    for (const bus of this.busses) {
      bus.pan.disconnect()
      bus.volume.disconnect()
      bus.analyser.disconnect()
      // also stops the chorus LFOs, which otherwise keep running for every rebuild
      bus.chorus.dispose()
      bus.convolver.dispose()
    }
    this.busses.length = 0
    for (let i = 0; i < channels.length; i += 1) {
      const volume = this.context.createGain()
      volume.gain.value = Song.playBackInstrument[i].volume / 100.0
      const pan = this.context.createStereoPanner()
      pan.pan.value = -1 + (channels[i].balance / 127) * 2
      pan.connect(volume)

      const chorus = new Chorus(this.context, { wetGain: channels[i].chorus / 127 })
      volume.connect(chorus.input)
      const reverb = new Freeverb(this.context, {
        dampening: 3000,
        roomSize: 0.7,
        wetGain: channels[i].reverb / 127,
      })
      chorus.output.connect(reverb.input)
      reverb.output.connect(this.masterGain)

      const analyser = this.context.createAnalyser()
      analyser.smoothingTimeConstant = 0.9
      volume.connect(analyser)
      this.busses[i] = { volume, pan, chorus, convolver: reverb, analyser }
      analyser.fftSize = 32
    }
  }

  /** Drum piece bus → the track bus that plays it (connect() is idempotent). */
  connectDrumBus(drumIndex: number, trackId: number): void {
    const drumBus = this.drumBusses[drumIndex]
    const trackBus = this.busses[trackId]
    if (drumBus == null || trackBus == null) return
    drumBus.volume.connect(trackBus.pan)
  }

  setMasterGain(value: number): void {
    this.masterGain.gain.value = value
  }

  /** Mixer knobs (0–127): reverb, chorus or pan of a track bus. */
  setEffectGain(trackIndex: number, value: number, type: EffectGainType): void {
    applyEffectGain(this.busses[trackIndex], value, type)
  }
}

export type { AudioGraph }

export const audioGraph = new AudioGraph()
