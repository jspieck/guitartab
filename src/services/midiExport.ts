import type { Beat, MeasureMetaInfo, Note, Track } from '../types/song'
import Duration from '../utils/duration'
import { velocityOf } from '../utils/noteVelocity'
import { buildPlayOrder } from './playback/playOrder'

/**
 * Writes a song as a Standard MIDI File (type 1): a conductor track with the tempo map, time
 * signatures and markers, then one track per song track on its own channel (drums on channel
 * 10) with program, mixer settings, notes, bends as pitch bend and lyrics. Notes sound as the
 * app plays them: velocity from the beat's dynamic, ties joined, grace notes before the note,
 * strums spread over the strings, tremolo picking as repeated notes. Pure: song data in,
 * bytes out.
 */

export interface MidiExportSource {
  title: string
  tracks: Track[]
  /** The mixer per track (volume 0–127, where 100 is unity gain; balance, reverb, chorus 0–127). */
  mixer?: ({ volume: number; balance: number; reverb: number; chorus: number } | undefined)[]
  measureMeta: MeasureMetaInfo[]
  /** track → bar → voice → beat */
  measures: Beat[][][][]
}

export interface MidiExportOptions {
  /** true: repeats, voltas and D.C./D.S. played out (as the app plays); false: every bar once. */
  unrollRepeats: boolean
}

export const PPQ = 960
// The app counts a whole note as 64 ticks, so a quarter is 16 of them.
const MIDI_PER_APP_TICK = PPQ / 16
const DRUM_CHANNEL = 9
const MAX_VOICES = 2
/** Pitch bend range set on every channel (RPN 0), in semitones: bends go up to two tones and more. */
export const BEND_RANGE = 12
const BEND_CENTER = 8192
// Bend values: 50 per semitone (100 = a whole-tone "full" bend), positions 0–60 over the note.
const BEND_PER_SEMITONE = 50
const BEND_POSITION_END = 60
const BEND_STEPS_PER_SEGMENT = 8
/** a dead note is a short choke, at most a 32nd */
const DEAD_NOTE_TICKS = 2 * MIDI_PER_APP_TICK

interface TrackEvent {
  tick: number
  /** at the same tick: note offs first, then controllers and bends, then note ons */
  order: number
  seq: number
  bytes: number[]
}

interface SoundingNote {
  pitch: number
  velocity: number
  start: number
  end: number
}

/** One played bar: which bar, its first tick, and the repeat pass (for lyric verses). */
interface PlayedBarSpan {
  blockId: number
  start: number
  pass: number
}

// ---------------------------------------------------------------------------
// Bytes

function variableLength(value: number): number[] {
  let rest = Math.max(0, Math.round(value))
  const out = [rest & 0x7f]
  rest >>= 7
  while (rest > 0) {
    out.unshift((rest & 0x7f) | 0x80)
    rest >>= 7
  }
  return out
}

function textBytes(text: string): number[] {
  return [...new TextEncoder().encode(text)]
}

function metaEvent(type: number, data: number[]): number[] {
  return [0xff, type, ...variableLength(data.length), ...data]
}

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

function trackChunk(events: TrackEvent[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order || a.seq - b.seq)
  const body: number[] = []
  let last = 0
  for (const event of sorted) {
    const tick = Math.max(last, Math.round(event.tick))
    body.push(...variableLength(tick - last), ...event.bytes)
    last = tick
  }
  body.push(0, ...metaEvent(0x2f, []))
  return [...textBytes('MTrk'), ...u32(body.length), ...body]
}

class EventList {
  readonly events: TrackEvent[] = []

  add(tick: number, order: number, bytes: number[]): void {
    this.events.push({ tick, order, seq: this.events.length, bytes })
  }
}

const clamp7 = (value: number) => Math.min(127, Math.max(0, Math.round(value)))

// ---------------------------------------------------------------------------
// Bars, tempo, time signatures

function barTicks(meta: MeasureMetaInfo): number {
  return Duration.getDurationOfBar(meta) * MIDI_PER_APP_TICK
}

function playedBars(source: MidiExportSource, options: MidiExportOptions): PlayedBarSpan[] {
  const order = options.unrollRepeats
    ? buildPlayOrder(source.measureMeta).map(({ blockId, pass }) => ({ blockId, pass }))
    : source.measureMeta.map((_, blockId) => ({ blockId, pass: 1 }))
  let start = 0
  return order.map(({ blockId, pass }) => {
    const span = { blockId, start, pass }
    start += barTicks(source.measureMeta[blockId])
    return span
  })
}

function conductorTrack(source: MidiExportSource, bars: PlayedBarSpan[]): EventList {
  const list = new EventList()
  list.add(0, 0, metaEvent(0x03, textBytes(source.title || 'Song')))
  let bpm: number | null = null
  let meter = ''
  bars.forEach(({ blockId, start }, index) => {
    const meta = source.measureMeta[blockId]
    const barBpm = meta.bpm ?? (index === 0 ? 120 : null)
    if (barBpm != null && barBpm > 0 && barBpm !== bpm) {
      bpm = barBpm
      list.add(start, 1, metaEvent(0x51, u32(Math.round(60_000_000 / barBpm)).slice(1)))
    }
    const barMeter = `${meta.numerator}/${meta.denominator}`
    if (barMeter !== meter) {
      meter = barMeter
      const power = Math.max(0, Math.round(Math.log2(meta.denominator)))
      list.add(start, 1, metaEvent(0x58, [meta.numerator, power, 24, 8]))
    }
    if (meta.marker?.text) list.add(start, 1, metaEvent(0x06, textBytes(meta.marker.text)))
  })
  return list
}

// ---------------------------------------------------------------------------
// Notes

export function isDrumTrack(track: Track): boolean {
  return track.channel?.index === DRUM_CHANNEL || track.primaryChannel === DRUM_CHANNEL
}

/** Channels 1–16 in file order: drums on 10, the others on the rest (shared beyond 15 tracks). */
export function assignChannels(tracks: readonly Track[]): number[] {
  let next = 0
  return tracks.map((track) => {
    if (isDrumTrack(track)) return DRUM_CHANNEL
    const channel = next
    next = (next + 1) % 16
    if (next === DRUM_CHANNEL) next += 1
    return channel
  })
}

function pitchOf(track: Track, drums: boolean, string: number, fret: number): number | null {
  const pitch = drums ? fret : (track.strings[string] ?? Number.NaN) + fret + Math.max(0, track.capo)
  return Number.isFinite(pitch) && pitch >= 0 && pitch <= 127 ? pitch : null
}

function bendValue14(value: number): number {
  const semitones = value / BEND_PER_SEMITONE
  return Math.min(16383, Math.max(0, Math.round(BEND_CENTER + (semitones / BEND_RANGE) * 8191)))
}

function pitchBend(channel: number, value: number): number[] {
  return [0xe0 | channel, value & 0x7f, (value >> 7) & 0x7f]
}

/** Pitch bend events along a bend curve, from the note's start over its beat's length. */
function addBend(
  list: EventList,
  channel: number,
  note: Note,
  start: number,
  length: number,
  end: number,
): void {
  const points = note.bendObj ?? []
  if (!points.some((point) => point.bendValue !== 0)) return
  const at = (position: number) =>
    start + (length * Math.min(BEND_POSITION_END, position)) / BEND_POSITION_END
  list.add(start, 1, pitchBend(channel, bendValue14(points[0].bendValue)))
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1]
    const to = points[i]
    for (let step = 1; step <= BEND_STEPS_PER_SEGMENT; step += 1) {
      const t = step / BEND_STEPS_PER_SEGMENT
      const value = from.bendValue + (to.bendValue - from.bendValue) * t
      list.add(
        at(from.bendPosition + (to.bendPosition - from.bendPosition) * t),
        1,
        pitchBend(channel, bendValue14(value)),
      )
    }
  }
  // After the curve's last step at the same tick, before a following note's own bend.
  list.add(end, 1, pitchBend(channel, BEND_CENTER))
}

interface VoiceContext {
  track: Track
  drums: boolean
  channel: number
  list: EventList
  /** the note a tie on this string continues, per voice:string */
  open: Map<string, SoundingNote>
  notes: SoundingNote[]
}

/** Strum delay of a string, in MIDI ticks: the playback's spread (an eighth of the stroke value over the strings). */
function strumDelay(beat: Beat, string: number, stringCount: number): number {
  const stroke = beat.effects?.stroke
  if (stroke == null || !(stroke.strokeLength > 0)) return 0
  const order = stroke.strokeType === 'down' ? string : stringCount - 1 - string
  return (64 / stroke.strokeLength / 12) * order * MIDI_PER_APP_TICK
}

function playNote(
  context: VoiceContext,
  note: Note,
  pitch: number,
  beat: Beat,
  at: number,
  length: number,
  key: string,
): void {
  const velocity = velocityOf(beat, note)
  let start = at
  const grace = note.graceObj
  if (grace != null) {
    // As in playback: the grace note sounds first for its own length, then the note.
    const gracePitch = pitchOf(context.track, context.drums, note.string, grace.fret)
    const graceLength = Duration.getDurationOfType(grace.duration) * MIDI_PER_APP_TICK
    if (gracePitch != null && graceLength > 0 && graceLength < length) {
      context.notes.push({ pitch: gracePitch, velocity, start, end: start + graceLength })
      start += graceLength
    }
  }
  const end = at + length
  if (note.tremoloPicking && !context.drums) {
    const step = Duration.getDurationOfType(note.tremoloPickingLength) * MIDI_PER_APP_TICK
    if (step > 0 && step < end - start) {
      for (let t = start; t < end - 1e-6; t += step)
        context.notes.push({ pitch, velocity, start: t, end: Math.min(end, t + step) })
      context.open.delete(key)
      return
    }
  }
  const sounding = { pitch, velocity, start, end: note.dead ? Math.min(end, start + DEAD_NOTE_TICKS) : end }
  context.notes.push(sounding)
  context.open.set(key, sounding)
  addBend(context.list, context.channel, note, start, end - start, sounding.end)
}

function beatLyric(beat: Beat, pass: number): string {
  const lyrics = beat.lyrics ?? []
  return lyrics[pass - 1] || lyrics[0] || ''
}

function writeBeat(
  context: VoiceContext,
  beat: Beat,
  voice: number,
  at: number,
  length: number,
  pass: number,
): void {
  if (beat.duration.endsWith('r')) return
  const strings = beat.notes ?? []
  let sounded = false
  strings.forEach((note, string) => {
    if (note == null) return
    const key = `${voice}:${string}`
    const open = context.open.get(key)
    if (note.tied && open != null && !context.drums) {
      // A tie lengthens the note it continues instead of striking again.
      open.end = at + length
      return
    }
    const pitch = pitchOf(context.track, context.drums, string, note.fret)
    if (pitch == null) return
    const delay = strumDelay(beat, string, strings.length)
    playNote(context, note, pitch, beat, at + delay, length - delay, key)
    sounded = true
  })
  const syllable = voice === 0 && sounded ? beatLyric(beat, pass) : ''
  if (syllable) context.list.add(at, 1, metaEvent(0x05, textBytes(syllable)))
}

/** Track name, program, mixer controllers and (melodic tracks) the pitch bend range, at tick 0. */
function trackSetup(
  list: EventList,
  source: MidiExportSource,
  trackIndex: number,
  channel: number,
  drums: boolean,
): void {
  const track = source.tracks[trackIndex]
  list.add(0, 0, metaEvent(0x03, textBytes(track.name || `Track ${trackIndex + 1}`)))
  const mixer = source.mixer?.[trackIndex]
  if (!drums) list.add(0, 1, [0xc0 | channel, clamp7(track.program >= 0 ? track.program : 0)])
  const controller = (number: number, value: number) =>
    list.add(0, 1, [0xb0 | channel, number, clamp7(value)])
  controller(7, mixer?.volume ?? 100)
  controller(10, mixer?.balance ?? 64)
  if (mixer != null) {
    controller(91, mixer.reverb)
    controller(93, mixer.chorus)
  }
  if (drums) return
  // RPN 0 (pitch bend range), then RPN null so later data entry changes nothing.
  for (const [number, value] of [
    [101, 0],
    [100, 0],
    [6, BEND_RANGE],
    [38, 0],
    [101, 127],
    [100, 127],
  ])
    controller(number, value)
}

function noteTrack(
  source: MidiExportSource,
  trackIndex: number,
  channel: number,
  bars: PlayedBarSpan[],
): EventList {
  const track = source.tracks[trackIndex]
  const drums = isDrumTrack(track)
  const list = new EventList()
  trackSetup(list, source, trackIndex, channel, drums)

  const context: VoiceContext = { track, drums, channel, list, open: new Map(), notes: [] }
  const trackBars = source.measures[trackIndex] ?? []
  for (const { blockId, start, pass } of bars) {
    const block = trackBars[blockId] ?? []
    for (let voice = 0; voice < MAX_VOICES; voice += 1) {
      let at = start
      for (const beat of block[voice] ?? []) {
        if (beat == null) continue
        const length = Duration.getDurationOfNote(beat, false) * MIDI_PER_APP_TICK
        writeBeat(context, beat, voice, at, length, pass)
        at += length
      }
    }
  }
  for (const note of context.notes) {
    list.add(note.start, 2, [0x90 | channel, note.pitch, clamp7(Math.max(1, note.velocity))])
    list.add(note.end, 0, [0x80 | channel, note.pitch, 0])
  }
  return list
}

// ---------------------------------------------------------------------------

/** The song as Standard MIDI File bytes. */
export function buildMidiFile(source: MidiExportSource, options: MidiExportOptions): Uint8Array {
  const bars = playedBars(source, options)
  const channels = assignChannels(source.tracks)
  const tracks = [
    conductorTrack(source, bars),
    ...source.tracks.map((_, index) => noteTrack(source, index, channels[index], bars)),
  ]
  const header = [
    ...textBytes('MThd'),
    ...u32(6),
    0,
    1,
    (tracks.length >> 8) & 0xff,
    tracks.length & 0xff,
    (PPQ >> 8) & 0xff,
    PPQ & 0xff,
  ]
  return new Uint8Array([...header, ...tracks.flatMap((list) => trackChunk(list.events))])
}

/** File name for the download, from the song title. */
export function midiFileName(title: string): string {
  const base = title.replace(/[\\/:*?"<>|]+/g, '').trim()
  return `${base && base !== '[Title]' ? base : 'song'}.mid`
}
