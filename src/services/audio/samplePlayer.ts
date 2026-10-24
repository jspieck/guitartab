import Song, { type Beat, type Note } from '../../stores/song'
import { makeBend, makeTrill, makeVibrato } from './audioModulation'
import { audioGraph } from './audioGraph'
import { FIRST_DRUM_NOTE, isDrumAudible, noteToDrum } from './drumKit'
import { synth, type SynthNote } from './soundFont/synth'

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
const VELOCITY = 100
const RELEASE = 0.015

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
  let instrumentId
  if (track.channel == null) {
    instrumentId = track.primaryChannel === DRUM_CHANNEL ? DRUM_CHANNEL : track.program
  } else {
    instrumentId =
      track.channel.index === DRUM_CHANNEL ? DRUM_CHANNEL : Song.allChannels[track.channel.index].cInstrument
  }
  let note = fret + track.capo
  if (instrumentId !== DRUM_CHANNEL) note += track.strings[string]
  return { instrumentId, note, channelIndex: track.channel?.index || 0 }
}

/** The SoundFont's volume envelope (attack, decay to sustain), released at the note's end. */
function scheduleEnvelope(
  context: AudioContext,
  res: SynthNote,
  volume: number,
  start: number,
  duration: number,
): GainNode {
  const envelope = context.createGain()
  envelope.gain.setValueAtTime(0, start)
  const attackVolume = volume * (VELOCITY / 127)
  envelope.gain.linearRampToValueAtTime(attackVolume, start + res.volAttack)
  const decayVolume = volume * (1 - res.volSustain)
  envelope.gain.linearRampToValueAtTime(decayVolume, start + res.volDecay)
  let currentVolume = decayVolume
  if (res.volDecay - res.volAttack !== 0) {
    currentVolume =
      attackVolume - (decayVolume - attackVolume) * Math.min(1, duration / (res.volDecay - res.volAttack))
  }
  envelope.gain.setValueAtTime(currentVolume, start + duration)
  envelope.gain.exponentialRampToValueAtTime(0.000001, start + duration + RELEASE)
  return envelope
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

  /** Builds (and caches) the sample buffer for a note without playing it. */
  preloadFret(trackId: number, string: number, fret: number): void {
    if (!synth.bankSet.length) return // SoundFont not loaded yet
    const { instrumentId, note, channelIndex } = sf2Target(trackId, string, fret)
    synth.noteOn(instrumentId, note, VELOCITY, channelIndex)
  }

  /**
   * Plays a fret on a string of a track at `start` (audio clock) for `duration` seconds.
   * `instr` is the track's playback instrument ('drums' routes to the drum buses);
   * `nextFret` is where a slide goes. Returns the note's envelope gain, or null when
   * nothing sounds (dead note, muted drum, SoundFont not loaded).
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
  ): GainNode | null {
    const { context } = audioGraph
    let duration = durationIn
    const { instrumentId, channelIndex, note } = sf2Target(trackId, string, fret)
    if (instrumentId === DRUM_CHANNEL && noteToDrum.get(note) != null && !isDrumAudible(note)) {
      return null
    }
    const res = synth.noteOn(instrumentId, note, VELOCITY, channelIndex)
    if (Song.tracks[trackId].letItRing || noteEffects?.letRing) duration += 0.5
    if (noteEffects?.dead && !noteEffects.slap) return null
    // The sample and envelope come from the SoundFont; without it (not loaded yet) skip the note.
    if (res == null) return null
    const source = context.createBufferSource()
    source.buffer = res.buffer
    source.playbackRate.value = res.playBackRate
    source.loop = res.loop
    source.loopStart = res.loopStart
    source.loopEnd = res.loopEnd

    const envelope = scheduleEnvelope(context, res, volumeOfBeat(volumeIn, beat), start, duration)
    source.start(start)
    source.stop(start + duration + RELEASE + 0.1)
    source.connect(envelope)
    const slideRatio = nextFret != null ? 2 ** ((nextFret - fret) / 12) : null
    const finalGain =
      noteEffects != null
        ? applyNoteEffect(noteEffects, source, envelope, slideRatio, start, duration)
        : envelope

    if (instr === 'drums') {
      const drumIndex = note - FIRST_DRUM_NOTE
      if (audioGraph.drumBusses[drumIndex] == null) return null
      finalGain.connect(audioGraph.drumBusses[drumIndex].pan)
      audioGraph.connectDrumBus(drumIndex, trackId)
    } else {
      finalGain.connect(audioGraph.busses[trackId].pan)
    }

    const playing: PlayingNote = { source, gain: finalGain.gain, trackId, voiceId }
    this.playing.add(playing)
    source.addEventListener('ended', this.forgetSource)
    return envelope
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
    return this.playFret(trackId, voiceId, 0, fret, volume, start, duration, beat, noteEffects, instr, null)
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
  }
}

export type { SamplePlayer }

export const samplePlayer = new SamplePlayer()
