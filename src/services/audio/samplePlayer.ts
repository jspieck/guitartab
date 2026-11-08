import Song, { type Beat, type Note } from '../../stores/song'
import { makeBend, makeTrill, makeVibrato } from './audioModulation'
import { sampleProgram, trackAmp, soundingProgram } from './ampModel'
import { audioGraph, type AudioGraph } from './audioGraph'
import { FIRST_DRUM_NOTE, isDrumAudible, noteToDrum } from './drumKit'
import {
  createNoteFilter,
  needsTremolo,
  scheduleModulation,
  scheduleVolumeEnvelope,
} from './soundFont/envelope'
import { synth, type SynthNote } from './soundFont/synth'
import { DEFAULT_VELOCITY, velocityOf } from '../../utils/noteVelocity'
import { presetKey } from '../../stores/soundFontState'

// The velocity table lives in utils (MIDI export uses it too); callers still find it here.
export { velocityOf }

/**
 * Plays notes from the SoundFont: picks the program and key for a fret, shapes the
 * SoundFont's envelope and the note's effects (trill, bend, slide, vibrato) and routes it
 * into the track's bus (drums: the drum piece's bus). Keeps the sounding notes so a voice
 * or everything can be stopped.
 */

interface PlayingNote {
  source: AudioBufferSourceNode
  gain: AudioParam
  trackId: number
  voiceId: number
  /** when it starts (audio clock): notes not started yet can be taken back (`cancelFrom`) */
  start: number
  /** the note it cuts off when it starts, so taking it back can undo that */
  choke: { key: string; previous: GainNode | null } | null
}

const DRUM_CHANNEL = 9
/** how fast a note is cut off by the next one on its string (or in its exclusive class) */
const CHOKE = 0.012

const DYNAMIC_VOLUME: Record<string, number> = {
  ppp: 0.2,
  pp: 0.4,
  p: 0.6,
  mp: 0.8,
  mf: 0.9,
  f: 1.0,
  ff: 1.2,
  fff: 1.4,
}

/** Volume of a note on a beat: a little random variation, then the beat's dynamic. */
export function volumeOfBeat(startVolume: number, beat: Beat): number {
  const loudnessProtection = 0.2
  const extra = 0.075 - Math.random() * 0.15
  const trimmedValue = Math.max(0.01, startVolume + extra) * loudnessProtection
  if (beat.dynamic != null) return DYNAMIC_VOLUME[beat.dynamic] * trimmedValue
  return trimmedValue
}

/** SoundFont program, MIDI key and channel for a fret on a track (program 9 = drums). */
export function sf2Target(trackId: number, string: number, fret: number) {
  const track = Song.tracks[trackId]
  const program = soundingProgram(trackId)
  // with the amp on, distorted guitars play the clean samples and the amp distorts them
  const instrumentId = program === DRUM_CHANNEL ? program : sampleProgram(program, trackAmp(trackId))
  let note = fret + track.capo
  if (instrumentId !== DRUM_CHANNEL) note += track.strings[string]
  return { instrumentId, note, channelIndex: track.channel?.index || 0 }
}

/** The SoundFont preset a track sounds with ("bank:preset", `presetKey`). */
export function trackPresetKey(trackId: number): string {
  return presetKey(sf2Target(trackId, 0, 0).instrumentId)
}

/**
 * One voice (SoundFont zone) of a note: the sample through its filter (if any), volume
 * envelope and LFO tremolo (if any), with its pitch envelope and LFOs, started and stopped.
 */
function startVoice(
  context: BaseAudioContext,
  res: SynthNote,
  peak: number,
  start: number,
  duration: number,
) {
  const source = context.createBufferSource()
  source.buffer = res.buffer
  source.playbackRate.value = res.playBackRate
  source.loop = res.loop
  source.loopStart = res.loopStart
  source.loopEnd = res.loopEnd
  const envelope = context.createGain()
  const end = scheduleVolumeEnvelope(envelope.gain, res, peak, start, duration) + 0.05
  source.start(start)
  source.stop(end)
  const filter = createNoteFilter(context, res, start)
  source.connect(filter ?? envelope)
  filter?.connect(envelope)
  const tremolo = needsTremolo(res) ? context.createGain() : null
  if (tremolo) envelope.connect(tremolo)
  scheduleModulation(context, res, { source, filter, tremolo }, start, end)
  return { source, envelope, out: tremolo ?? envelope }
}

/** A voice's place in the stereo field (a stereo sample's halves are two voices panned apart). */
function panVoice(context: BaseAudioContext, voiceOut: GainNode, pan: number, output: AudioNode): void {
  if (pan === 0) {
    voiceOut.connect(output)
    return
  }
  const panner = context.createStereoPanner()
  panner.pan.value = pan
  voiceOut.connect(panner).connect(output)
}

/** A fixed gain from `from` into `to`. */
function connectScaled(context: BaseAudioContext, from: AudioNode, gain: number, to: AudioNode): void {
  const scale = context.createGain()
  scale.gain.value = gain
  from.connect(scale).connect(to)
}

/** A ghost note is muted by the fretting hand: at most this long, then it fades out quickly. */
const GHOST_LENGTH = 0.12
const GHOST_FADE = 0.04
/** Its level after the pick's attack: the attack stays clear, the body is soft. */
const GHOST_BODY = 0.55

/**
 * The envelope that makes a ghost note a short percussive tick instead of a quiet note that
 * rings on and disappears under the others. All its voices pass it.
 */
function ghostShape(context: BaseAudioContext, output: AudioNode, start: number, duration: number): GainNode {
  const shape = context.createGain()
  const end = start + Math.min(duration, GHOST_LENGTH)
  shape.gain.setValueAtTime(1, start)
  shape.gain.setTargetAtTime(GHOST_BODY, start + 0.01, 0.025)
  shape.gain.setValueAtTime(GHOST_BODY, end)
  shape.gain.linearRampToValueAtTime(0, end + GHOST_FADE)
  shape.connect(output)
  return shape
}

/** A dead note is the pick hitting a string the fretting hand only touches: a short, dull thud. */
const DEAD_LENGTH = 0.04
const DEAD_FADE = 0.03
const DEAD_BODY = 0.35
/** the lowpass that takes the pitch out of the sample, leaving the attack's noise */
const DEAD_CUTOFF = 1000

/** The envelope and lowpass that turn a note's sample into a dead note. All its voices pass it. */
function deadShape(context: BaseAudioContext, output: AudioNode, start: number): GainNode {
  const shape = context.createGain()
  const end = start + DEAD_LENGTH
  shape.gain.setValueAtTime(1, start)
  shape.gain.setTargetAtTime(DEAD_BODY, start + 0.005, 0.01)
  shape.gain.setValueAtTime(DEAD_BODY, end)
  shape.gain.linearRampToValueAtTime(0, end + DEAD_FADE)
  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = DEAD_CUTOFF
  shape.connect(lowpass).connect(output)
  return shape
}

/** The pick's click on the muted string, on top of the thud: band-passed noise, a few ms long. */
const DEAD_CLICK_LENGTH = 0.03
/** its level against the note's volume (which carries the beat's dynamic) */
const DEAD_CLICK_LEVEL = 1.6
/** the click's band sits a few harmonics above the string's pitch: duller on a bass, brighter on a high string */
const DEAD_CLICK_HARMONIC = 4
const DEAD_CLICK_BAND = { min: 300, max: 3200 }

/** One short burst of white noise per context (fixed seed, so renders are repeatable). */
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

function noiseBuffer(context: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(context)
  if (buffer == null) {
    const length = Math.ceil(context.sampleRate * DEAD_CLICK_LENGTH * 2)
    buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    let seed = 0x2545f491
    for (let i = 0; i < length; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      data[i] = seed / 0x80000000 - 1
    }
    noiseBuffers.set(context, buffer)
  }
  return buffer
}

/** Centre of a dead note's click band for a MIDI key. */
export function deadClickFrequency(key: number): number {
  const fundamental = 440 * 2 ** ((key - 69) / 12)
  return Math.min(DEAD_CLICK_BAND.max, Math.max(DEAD_CLICK_BAND.min, fundamental * DEAD_CLICK_HARMONIC))
}

/**
 * The click of a dead note: noise through a band-pass at the string's register, a 1 ms
 * attack and a fast decay. Without it a dead note was only the muffled sample, which got
 * lost under the other notes.
 */
function deadClick(
  context: BaseAudioContext,
  output: AudioNode,
  key: number,
  volume: number,
  start: number,
): AudioBufferSourceNode {
  const source = context.createBufferSource()
  source.buffer = noiseBuffer(context)
  const band = context.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = deadClickFrequency(key)
  band.Q.value = 1.2
  const envelope = context.createGain()
  const peak = Math.max(0.0002, volume * DEAD_CLICK_LEVEL)
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(peak, start + 0.001)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + DEAD_CLICK_LENGTH)
  source.connect(band).connect(envelope).connect(output)
  source.start(start)
  source.stop(start + DEAD_CLICK_LENGTH + 0.01)
  return source
}

/** Drums have no fretting hand to mute them: their ghost notes are only softer. */
function isMutedGhost(noteEffects: Note | null, instrumentId: number): boolean {
  return noteEffects?.ghost === true && instrumentId !== DRUM_CHANNEL
}

/** Slapped dead notes keep their pitch (a slap on a muted string still rings); drums can't be muted. */
function isDeadNote(noteEffects: Note | null, instrumentId: number): boolean {
  return noteEffects?.dead === true && !noteEffects.slap && instrumentId !== DRUM_CHANNEL
}

/** How long a note sounds before its release: let ring adds half a second, ghost and dead notes are cut short. */
function soundingLength(
  trackId: number,
  noteEffects: Note | null,
  duration: number,
  ghost: boolean,
  dead: boolean,
): number {
  if (dead) return DEAD_LENGTH + DEAD_FADE
  if (ghost) return Math.min(duration, GHOST_LENGTH) + GHOST_FADE
  return Song.tracks[trackId].letItRing || noteEffects?.letRing ? duration + 0.5 : duration
}

/** What a note cuts off when it starts: its string, or for drums its exclusive class (null: nothing). */
function chokeKeyOf(
  trackId: number,
  drums: boolean,
  exclusiveClass: number,
  string: number,
  onString: boolean,
): string | null {
  if (drums) return exclusiveClass ? `${trackId}:x${exclusiveClass}` : null
  return onString ? `${trackId}:${string}` : null
}

/**
 * One effect per note (trill, bend, slide, vibrato, in that order), so they don't fight over
 * the same parameter. Returns the gain the note leaves through (the trill adds one).
 */
function applyNoteEffect(
  context: BaseAudioContext,
  bpm: number | undefined,
  noteEffects: Note,
  source: AudioBufferSourceNode,
  envelope: GainNode,
  slideRatio: number | null,
  start: number,
  duration: number,
): GainNode {
  if (noteEffects.trill != null) {
    const trillGain = context.createGain()
    trillGain.gain.setValueAtTime(0, start)
    envelope.connect(trillGain)
    makeTrill(trillGain, duration, start, bpm)
    return trillGain
  }
  if (noteEffects.bendObj != null) {
    makeBend(noteEffects.bendObj, source, duration, start, source.playbackRate.value)
  } else if (noteEffects.slide && slideRatio != null) {
    source.playbackRate.setValueAtTime(source.playbackRate.value, start + duration * 0.8)
    source.playbackRate.exponentialRampToValueAtTime(source.playbackRate.value * slideRatio, start + duration)
  } else if (noteEffects.vibrato) {
    makeVibrato(source, duration, start, bpm)
  }
  return envelope
}

class SamplePlayer {
  readonly playing = new Set<PlayingNote>()
  /** the last note's choke gain per string (`track:string`) or drum exclusive class (`track:xN`) */
  private readonly lastByChokeKey = new Map<string, GainNode>()

  /**
   * Tempo for trills and vibrato (quarters per minute, practice speed included); null: the
   * song's tempo now. An audio render sets it per beat, since it doesn't move `Song.bpm`.
   */
  effectBpm: number | null = null

  /**
   * Start of the beat whose notes are being scheduled (set by `notePlayback`): a strummed or
   * grace note starts after its beat, but is taken back with it (`cancelFrom`).
   */
  beatStart: number | null = null

  /** The graph notes play into: the app's, or an offline one for an audio render. */
  constructor(readonly graph: AudioGraph<BaseAudioContext>) {}

  /**
   * Where a note starting at `start` goes: a choke gain into its track's bus (drums: the
   * piece's bus; null when that has none), plus its zone's reverb and chorus sends. A new
   * note on a string stops the one still ringing there, and likewise within a drum
   * exclusive class (open/closed hi-hat).
   */
  private outputFor(
    trackId: number,
    note: number,
    instr: string,
    chokeKey: string | null,
    start: number,
    sends: { reverbSend: number; chorusSend: number },
  ): { choke: GainNode; previous: GainNode | null } | null {
    const { graph } = this
    const drumIndex = note - FIRST_DRUM_NOTE
    const drumBus = instr === 'drums' ? graph.drumBusses[drumIndex] : null
    const trackBus = graph.busses[trackId]
    if (instr === 'drums' && drumBus == null) return null
    const { context } = graph
    const choke = context.createGain()
    let previous: GainNode | null = null
    if (chokeKey != null) {
      previous = this.lastByChokeKey.get(chokeKey) ?? null
      previous?.gain.setValueAtTime(1, start)
      previous?.gain.linearRampToValueAtTime(0, start + CHOKE)
      this.lastByChokeKey.set(chokeKey, choke)
    }
    if (drumBus) {
      choke.connect(drumBus.pan)
      graph.connectDrumBus(drumIndex, trackId)
    } else {
      choke.connect(trackBus.input)
    }
    // The zone's own sends would carry the clean signal around the amp; through the amp only
    // the mixer's reverb and chorus (after the bus volume) apply.
    if (trackBus && !trackBus.ampActive) {
      // a drum's sends skip its piece's bus, so they take its level along
      const level = drumBus ? drumBus.volume.gain.value : 1
      if (sends.reverbSend) connectScaled(context, choke, sends.reverbSend * level, trackBus.reverbIn)
      if (sends.chorusSend) connectScaled(context, choke, sends.chorusSend * level, trackBus.chorusIn)
    }
    return { choke, previous }
  }

  /** Builds (and caches) the sample buffer for a note without playing it. */
  preloadFret(trackId: number, string: number, fret: number): void {
    if (!synth.bankSet.length) return // SoundFont not loaded yet
    const { instrumentId, note, channelIndex } = sf2Target(trackId, string, fret)
    synth.noteOn(instrumentId, note, DEFAULT_VELOCITY, channelIndex)
  }

  /**
   * Plays a fret on a string of a track at `start` (audio clock) for `duration` seconds.
   * `instr` is the track's playback instrument ('drums' routes to the drum buses);
   * `nextFret` is where a slide goes; `onString` false for pitches that sit on no real string
   * (they don't cut off each other). Returns the note's output gain (all its voices pass
   * it), or null when nothing sounds (muted drum, SoundFont not loaded).
   */
  playFret(
    trackId: number,
    voiceId: number,
    string: number,
    fret: number,
    volumeIn: number,
    start: number,
    durationIn: number,
    beat: Beat,
    noteEffects: Note | null,
    instr: string,
    nextFret: number | null,
    onString = true,
  ): GainNode | null {
    const { context } = this.graph
    const { instrumentId, channelIndex, note } = sf2Target(trackId, string, fret)
    const ghost = isMutedGhost(noteEffects, instrumentId)
    const dead = isDeadNote(noteEffects, instrumentId)
    const duration = soundingLength(trackId, noteEffects, durationIn, ghost, dead)
    if (instrumentId === DRUM_CHANNEL && noteToDrum.get(note) != null && !isDrumAudible(note)) {
      return null
    }
    const voices = synth.noteOn(instrumentId, note, velocityOf(beat, noteEffects), channelIndex)
    // The sample and envelope come from the SoundFont; without it (not loaded yet) skip the note.
    if (voices == null) return null
    const [first] = voices
    const chokeKey = chokeKeyOf(
      trackId,
      instrumentId === DRUM_CHANNEL,
      first.exclusiveClass,
      string,
      onString,
    )
    // a stereo pair or stacked layers share their sends: the first zone's
    const routed = this.outputFor(trackId, note, instr, chokeKey, start, first)
    if (routed == null) return null
    const output = routed.choke
    const choke = chokeKey != null ? { key: chokeKey, previous: routed.previous } : null
    const volume = volumeOfBeat(volumeIn, beat)
    const slideRatio = nextFret != null ? 2 ** ((nextFret - fret) / 12) : null
    const into = dead
      ? deadShape(context, output, start)
      : ghost
        ? ghostShape(context, output, start, durationIn)
        : output
    const bpm = this.effectBpm ?? undefined
    const keep = (source: AudioBufferSourceNode) => {
      this.playing.add({ source, gain: output.gain, trackId, voiceId, start: this.beatStart ?? start, choke })
      source.addEventListener('ended', this.forgetSource)
    }
    if (dead) keep(deadClick(context, output, note, volume, start))
    for (const voice of voices) {
      const { source, out } = startVoice(context, voice, volume * voice.gain, start, duration)
      const voiceOut =
        noteEffects != null
          ? applyNoteEffect(context, bpm, noteEffects, source, out, slideRatio, start, duration)
          : out
      panVoice(context, voiceOut, voice.pan, into)
      keep(source)
    }
    return output
  }

  /**
   * Plays a MIDI pitch on a track (a live MIDI key, a recorded note that fits no string):
   * the fret that gives that pitch on the lowest string, past the capo; drums take the
   * pitch as the drum note.
   */
  playPitch(
    trackId: number,
    voiceId: number,
    pitch: number,
    volume: number,
    start: number,
    duration: number,
    beat: Beat,
    noteEffects: Note | null,
  ): GainNode | null {
    const track = Song.tracks[trackId]
    const instr = Song.playBackInstrument[trackId].instrument
    const { instrumentId } = sf2Target(trackId, 0, 0)
    const fret = instrumentId === DRUM_CHANNEL ? pitch - track.capo : pitch - track.strings[0] - track.capo
    return this.playFret(
      trackId,
      voiceId,
      0,
      fret,
      volume,
      start,
      duration,
      beat,
      noteEffects,
      instr,
      null,
      false,
    )
  }

  private readonly forgetSource = (event: Event): void => {
    const target = event.target as AudioBufferSourceNode
    target.disconnect()
    target.removeEventListener('ended', this.forgetSource)
    for (const playing of this.playing) {
      if (playing.source === target) this.playing.delete(playing)
    }
  }

  /**
   * Takes back every note that starts at `time` or later (scheduled ahead, not sounding yet)
   * and undoes their cutting off of the notes before them, so the scheduler can schedule
   * those beats again (at a new speed).
   */
  cancelFrom(time: number): void {
    const cancelled = [...this.playing].filter((item) => item.start >= time)
    // latest first, so each string ends up pointing at the last note that still plays
    cancelled.sort((a, b) => b.start - a.start)
    for (const item of cancelled) {
      item.source.disconnect()
      this.playing.delete(item)
      if (item.choke == null) continue
      const { key, previous } = item.choke
      previous?.gain.cancelScheduledValues(item.start)
      if (previous != null) this.lastByChokeKey.set(key, previous)
      else this.lastByChokeKey.delete(key)
    }
  }

  /** Fades out (1 ms) the notes of one voice of a track. */
  stopVoice(trackId: number, voiceId: number): void {
    const { currentTime } = this.graph.context
    for (const item of this.playing) {
      if (item.trackId === trackId && item.voiceId === voiceId) {
        item.gain.cancelScheduledValues(currentTime)
        item.gain.setValueAtTime(item.gain.value, currentTime)
        item.gain.exponentialRampToValueAtTime(0.000001, currentTime + 0.001)
        this.playing.delete(item)
      }
    }
  }

  stopAll(): void {
    const { currentTime } = this.graph.context
    for (const item of this.playing) {
      item.gain.cancelScheduledValues(currentTime)
      item.gain.setValueAtTime(item.gain.value, currentTime)
      item.gain.exponentialRampToValueAtTime(0.000001, currentTime + 0.001)
    }
    this.playing.clear()
    this.lastByChokeKey.clear()
  }
}

export { SamplePlayer }

export const samplePlayer = new SamplePlayer(audioGraph)
