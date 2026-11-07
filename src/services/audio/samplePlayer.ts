import Song, { type Beat, type Note } from '../../stores/song'
import { makeBend, makeTrill, makeVibrato } from './audioModulation'
import { sampleProgram, trackAmp, soundingProgram } from './ampModel'
import { audioGraph } from './audioGraph'
import { FIRST_DRUM_NOTE, isDrumAudible, noteToDrum } from './drumKit'
import {
  createNoteFilter,
  needsTremolo,
  scheduleModulation,
  scheduleVolumeEnvelope,
} from './soundFont/envelope'
import { synth, type SynthNote } from './soundFont/synth'
import { DEFAULT_VELOCITY, velocityOf } from '../../utils/noteVelocity'

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

/**
 * One voice (SoundFont zone) of a note: the sample through its filter (if any), volume
 * envelope and LFO tremolo (if any), with its pitch envelope and LFOs, started and stopped.
 */
function startVoice(context: AudioContext, res: SynthNote, peak: number, start: number, duration: number) {
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
function panVoice(context: AudioContext, voiceOut: GainNode, pan: number, output: AudioNode): void {
  if (pan === 0) {
    voiceOut.connect(output)
    return
  }
  const panner = context.createStereoPanner()
  panner.pan.value = pan
  voiceOut.connect(panner).connect(output)
}

/** A fixed gain from `from` into `to`. */
function connectScaled(context: AudioContext, from: AudioNode, gain: number, to: AudioNode): void {
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
function ghostShape(context: AudioContext, output: AudioNode, start: number, duration: number): GainNode {
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
function deadShape(context: AudioContext, output: AudioNode, start: number): GainNode {
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
  noteEffects: Note,
  source: AudioBufferSourceNode,
  envelope: GainNode,
  slideRatio: number | null,
  start: number,
  duration: number,
): GainNode {
  if (noteEffects.trill != null) {
    const trillGain = audioGraph.context.createGain()
    trillGain.gain.setValueAtTime(0, start)
    envelope.connect(trillGain)
    makeTrill(trillGain, duration, start)
    return trillGain
  }
  if (noteEffects.bendObj != null) {
    makeBend(noteEffects.bendObj, source, duration, start, source.playbackRate.value)
  } else if (noteEffects.slide && slideRatio != null) {
    source.playbackRate.setValueAtTime(source.playbackRate.value, start + duration * 0.8)
    source.playbackRate.exponentialRampToValueAtTime(source.playbackRate.value * slideRatio, start + duration)
  } else if (noteEffects.vibrato) {
    makeVibrato(source, duration, start)
  }
  return envelope
}

class SamplePlayer {
  readonly playing = new Set<PlayingNote>()
  /** the last note's choke gain per string (`track:string`) or drum exclusive class (`track:xN`) */
  private readonly lastByChokeKey = new Map<string, GainNode>()

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
  ): GainNode | null {
    const drumIndex = note - FIRST_DRUM_NOTE
    const drumBus = instr === 'drums' ? audioGraph.drumBusses[drumIndex] : null
    const trackBus = audioGraph.busses[trackId]
    if (instr === 'drums' && drumBus == null) return null
    const { context } = audioGraph
    const choke = context.createGain()
    if (chokeKey != null) {
      const previous = this.lastByChokeKey.get(chokeKey)
      previous?.gain.setValueAtTime(1, start)
      previous?.gain.linearRampToValueAtTime(0, start + CHOKE)
      this.lastByChokeKey.set(chokeKey, choke)
    }
    if (drumBus) {
      choke.connect(drumBus.pan)
      audioGraph.connectDrumBus(drumIndex, trackId)
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
    return choke
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
    const { context } = audioGraph
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
    const output = this.outputFor(trackId, note, instr, chokeKey, start, first)
    if (output == null) return null
    const volume = volumeOfBeat(volumeIn, beat)
    const slideRatio = nextFret != null ? 2 ** ((nextFret - fret) / 12) : null
    const into = dead
      ? deadShape(context, output, start)
      : ghost
        ? ghostShape(context, output, start, durationIn)
        : output
    for (const voice of voices) {
      const { source, out } = startVoice(context, voice, volume * voice.gain, start, duration)
      const voiceOut =
        noteEffects != null ? applyNoteEffect(noteEffects, source, out, slideRatio, start, duration) : out
      panVoice(context, voiceOut, voice.pan, into)
      this.playing.add({ source, gain: output.gain, trackId, voiceId })
      source.addEventListener('ended', this.forgetSource)
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

  /** Fades out (1 ms) the notes of one voice of a track. */
  stopVoice(trackId: number, voiceId: number): void {
    const { currentTime } = audioGraph.context
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
    const { currentTime } = audioGraph.context
    for (const item of this.playing) {
      item.gain.cancelScheduledValues(currentTime)
      item.gain.setValueAtTime(item.gain.value, currentTime)
      item.gain.exponentialRampToValueAtTime(0.000001, currentTime + 0.001)
    }
    this.playing.clear()
    this.lastByChokeKey.clear()
  }
}

export type { SamplePlayer }

export const samplePlayer = new SamplePlayer()
