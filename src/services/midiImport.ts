import Song, { type Beat, type MeasureMetaInfo, type Note, type Track } from '../stores/song'
import { IMPORT_LIMITS, ImportError } from './importErrors'
import type { NoteLengthCode } from '../types/tab'
import type { MidiFileData } from './import/midiFile'

export type { MidiFileData }

export interface ImportedSong {
  title: string
  bpm: number
  measureMeta: MeasureMetaInfo[]
  tracks: Track[]
  /** MIDI program per channel index used by `tracks[].channel.index`. */
  programs: Map<number, number>
  measures: Beat[][][][]
}

type MidiEvent = MidiFileData['tracks'][number]['events'][number]
interface MidiNote {
  start: number
  end: number
  pitch: number
  velocity: number
}
interface NoteGroup {
  name: string
  channel: number
  notes: MidiNote[]
}
interface Bar {
  start: number
  length: number
  meta: MeasureMetaInfo
}
interface Timeline {
  tempos: { tick: number; bpm: number }[]
  meters: { tick: number; numerator: number; denominator: number }[]
  groups: Map<string, NoteGroup>
  programs: Map<number, number>
}

const DRUM_CHANNEL = 9
const GUITAR_TUNING = [40, 45, 50, 55, 59, 64]
const BASS_TUNING = [28, 33, 38, 43]
const MAX_FRET = 24
// Note values in 16ths, longest first; dotted values included.
const NOTE_VALUES: { sixteenths: number; duration: NoteLengthCode; dotted: boolean }[] = [
  { sixteenths: 16, duration: 'w', dotted: false },
  { sixteenths: 12, duration: 'h', dotted: true },
  { sixteenths: 8, duration: 'h', dotted: false },
  { sixteenths: 6, duration: 'q', dotted: true },
  { sixteenths: 4, duration: 'q', dotted: false },
  { sixteenths: 3, duration: 'e', dotted: true },
  { sixteenths: 2, duration: 'e', dotted: false },
  { sixteenths: 1, duration: 's', dotted: false },
]

function largestValue(sixteenths: number) {
  return NOTE_VALUES.find((value) => value.sixteenths <= sixteenths) ?? NOTE_VALUES[NOTE_VALUES.length - 1]
}

function makeBeat(
  value: { duration: NoteLengthCode; dotted: boolean },
  notes: (Note | null)[] | null,
  stringCount: number,
): Beat {
  const beat = Song.defaultMeasure()
  beat.duration = notes == null ? `${value.duration}r` : value.duration
  beat.dotted = value.dotted
  beat.notes = notes ?? new Array(stringCount).fill(null)
  return beat
}

/** Places pitches on strings: each gets its own string, at the lowest fret that fits. */
export function placeOnStrings(pitches: number[], tuning: number[]): (number | null)[] {
  const frets: (number | null)[] = new Array(tuning.length).fill(null)
  const lowest = tuning[0]
  const highest = tuning[tuning.length - 1] + MAX_FRET
  for (const raw of [...pitches].sort((a, b) => b - a)) {
    let pitch = raw
    while (pitch < lowest) pitch += 12
    while (pitch > highest) pitch -= 12
    let best = -1
    for (let string = 0; string < tuning.length; string += 1) {
      const fret = pitch - tuning[string]
      if (frets[string] != null || fret < 0 || fret > MAX_FRET) continue
      if (best === -1 || fret < pitch - tuning[best]) best = string
    }
    if (best !== -1) frets[best] = pitch - tuning[best]
  }
  return frets
}

function readMetaEvent(event: MidiEvent, tick: number, timeline: Timeline): void {
  if (event.metaType === 0x51 && event.metaData.length >= 3) {
    const microseconds = (event.metaData[0] << 16) | (event.metaData[1] << 8) | event.metaData[2]
    if (microseconds > 0) timeline.tempos.push({ tick, bpm: Math.round(60_000_000 / microseconds) })
  } else if (event.metaType === 0x58 && event.metaData.length >= 2) {
    const numerator = event.metaData[0]
    const denominator = 2 ** event.metaData[1]
    if (numerator > 0 && numerator <= 32 && denominator <= 32)
      timeline.meters.push({ tick, numerator, denominator })
  }
}

function readChannelEvent(
  event: MidiEvent,
  tick: number,
  trackName: string,
  key: string,
  timeline: Timeline,
): void {
  const channel = event.midiChannel
  if (event.midiEventType === 0x0c && !timeline.programs.has(channel))
    timeline.programs.set(channel, event.parameter1)
  const velocity = event.parameter2 ?? 0
  if (event.midiEventType === 0x09 && velocity > 0) {
    if (!timeline.groups.has(key)) timeline.groups.set(key, { name: trackName, channel, notes: [] })
    timeline.groups
      .get(key)!
      .notes.push({ start: tick, end: Number.POSITIVE_INFINITY, pitch: event.parameter1, velocity })
  } else if (event.midiEventType === 0x08 || event.midiEventType === 0x09) {
    // Note off (or note on with velocity 0) ends the earliest still-sounding note of that pitch.
    const open = timeline.groups
      .get(key)
      ?.notes.find((note) => note.pitch === event.parameter1 && !Number.isFinite(note.end))
    if (open) open.end = tick
  }
}

function readTimeline(midi: MidiFileData): Timeline {
  const timeline: Timeline = { tempos: [], meters: [], groups: new Map(), programs: new Map() }
  midi.tracks.forEach((track, trackIndex) => {
    let tick = 0
    for (const event of track.events) {
      tick += event.delta
      if (event.type === 'meta') readMetaEvent(event, tick, timeline)
      else if (event.type === 'MIDI')
        readChannelEvent(event, tick, track.trackName, `${trackIndex}:${event.midiChannel}`, timeline)
    }
  })
  timeline.tempos.sort((a, b) => a.tick - b.tick)
  timeline.meters.sort((a, b) => a.tick - b.tick)
  return timeline
}

/** Bars up to the last onset, honouring time-signature changes at bar starts; positions in 16ths. */
function buildBars(timeline: Timeline, lastOnset: number, toSixteenths: (tick: number) => number): Bar[] {
  const bars: Bar[] = []
  let position = 0
  let meter = { numerator: 4, denominator: 4 }
  while (position <= lastOnset) {
    if (bars.length >= IMPORT_LIMITS.measures) {
      throw new ImportError(`The song is longer than ${IMPORT_LIMITS.measures} bars.`, 'mid')
    }
    const change = [...timeline.meters]
      .reverse()
      .find((candidate) => toSixteenths(candidate.tick) <= position)
    const changed =
      change != null && (change.numerator !== meter.numerator || change.denominator !== meter.denominator)
    if (change) meter = { numerator: change.numerator, denominator: change.denominator }
    const meta = Song.defaultMeasureMeta()
    meta.numerator = meter.numerator
    meta.denominator = meter.denominator
    meta.keySignature = 0
    meta.timeMeterPresent = bars.length === 0 || changed
    const length = Math.max(1, Math.round((meter.numerator * 16) / meter.denominator))
    bars.push({ start: position, length, meta })
    position += length
  }
  bars[0].meta.bpm = timeline.tempos.find((tempo) => tempo.tick === 0)?.bpm ?? timeline.tempos[0]?.bpm ?? 120
  for (const tempo of timeline.tempos) {
    const at = toSixteenths(tempo.tick)
    const bar = bars.findIndex(
      (candidate) => at >= candidate.start && at < candidate.start + candidate.length,
    )
    if (bar > 0) bars[bar].meta.bpm = tempo.bpm
  }
  return bars
}

function chooseTuning(group: NoteGroup): number[] {
  if (group.channel === DRUM_CHANNEL) return new Array(6).fill(0)
  const pitches = group.notes.map((note) => note.pitch)
  return Math.min(...pitches) < GUITAR_TUNING[0] && Math.max(...pitches) < 67 ? BASS_TUNING : GUITAR_TUNING
}

function buildTrack(group: NoteGroup, index: number, tuning: number[], programs: Map<number, number>): Track {
  return {
    ...Song.defaultTrack(),
    name: group.name.trim() || (group.channel === DRUM_CHANNEL ? 'Drums' : `Track ${index + 1}`),
    strings: [...tuning],
    numStrings: tuning.length,
    volume: 127,
    balance: 63,
    color: { red: 220, green: 60, blue: 60 },
    channel: { index: group.channel, effectChannel: group.channel },
    program: programs.get(group.channel) ?? 0,
    primaryChannel: group.channel,
  }
}

/** Groups a track's notes by quantized onset, with the longest sounding length at each. */
function collectOnsets(group: NoteGroup, toSixteenths: (tick: number) => number) {
  const onsets = new Map<number, number[]>()
  const lengths = new Map<number, number>()
  for (const note of group.notes) {
    const at = toSixteenths(note.start)
    onsets.set(at, [...(onsets.get(at) ?? []), note.pitch])
    const length = Number.isFinite(note.end)
      ? Math.max(1, toSixteenths(note.end) - at)
      : Number.POSITIVE_INFINITY
    lengths.set(at, Math.max(lengths.get(at) ?? 0, length))
  }
  return { onsets, lengths }
}

/** One voice of one bar: notes at their onsets, gaps and short notes' tails as rests. */
function buildBarBeats(
  bar: Bar,
  { onsets, lengths }: ReturnType<typeof collectOnsets>,
  tuning: number[],
  isDrums: boolean,
): Beat[] {
  const starts = [...onsets.keys()]
    .filter((at) => at >= bar.start && at < bar.start + bar.length)
    .sort((a, b) => a - b)
  const beats: Beat[] = []
  const fillRests = (sixteenths: number) => {
    for (let left = sixteenths; left > 0;) {
      const value = largestValue(left)
      beats.push(makeBeat(value, null, tuning.length))
      left -= value.sixteenths
    }
  }
  let cursor = bar.start
  starts.forEach((at, i) => {
    fillRests(at - cursor)
    const end = starts[i + 1] ?? bar.start + bar.length
    // Short notes followed by silence keep their length; the gap becomes rests.
    const value = largestValue(Math.min(end - at, lengths.get(at) ?? Number.POSITIVE_INFINITY))
    const frets = isDrums
      ? [...new Set(onsets.get(at)!)].slice(0, tuning.length)
      : placeOnStrings(onsets.get(at)!, tuning)
    const notes: (Note | null)[] = new Array(tuning.length).fill(null)
    frets.forEach((fret, string) => {
      if (fret != null) notes[string] = { ...Song.defaultNote(), fret, string, velocity: 96 }
    })
    beats.push(makeBeat(value, notes, tuning.length))
    fillRests(end - at - value.sixteenths)
    cursor = end
  })
  fillRests(bar.start + bar.length - cursor)
  return beats
}

/** Converts a decoded MIDI file into song data (one track per MIDI track and channel). */
export function buildSongFromMidi(midi: MidiFileData, fileName: string): ImportedSong {
  if (!(midi.ticksPerBeat > 0) || midi.ticksPerBeat >= 0x8000) {
    throw new ImportError('MIDI files with SMPTE timing are not supported.', 'mid')
  }
  const timeline = readTimeline(midi)
  const playable = [...timeline.groups.values()].filter((group) => group.notes.length > 0)
  if (playable.length === 0) {
    throw new ImportError('The MIDI file contains no notes.', 'mid')
  }
  if (playable.length > IMPORT_LIMITS.tracks) {
    throw new ImportError(`Too many tracks (${playable.length}).`, 'mid')
  }

  const sixteenth = midi.ticksPerBeat / 4
  const toSixteenths = (tick: number) => Math.round(tick / sixteenth)
  const lastOnset = Math.max(
    ...playable.flatMap((group) => group.notes.map((note) => toSixteenths(note.start))),
  )
  const bars = buildBars(timeline, lastOnset, toSixteenths)

  const tracks = playable.map((group, index) =>
    buildTrack(group, index, chooseTuning(group), timeline.programs),
  )
  const measures = playable.map((group, index) => {
    const tuning = tracks[index].strings
    const onsets = collectOnsets(group, toSixteenths)
    return bars.map((bar) => {
      const secondVoice = makeBeat({ duration: 'w', dotted: false }, null, tuning.length)
      secondVoice.empty = true // filled with rests on load
      return [buildBarBeats(bar, onsets, tuning, group.channel === DRUM_CHANNEL), [secondVoice]]
    })
  })

  return {
    title: fileName.replace(/\.[^.]+$/, '').replace(/^.*[\\/]/, ''),
    bpm: bars[0].meta.bpm ?? 120,
    measureMeta: bars.map((bar) => bar.meta),
    tracks,
    programs: timeline.programs,
    measures,
  }
}

/** Replaces the current song with an imported one. */
export function applyImportedSong(song: ImportedSong): void {
  Song.songDescription = { ...Song.songDescription, title: song.title, subtitle: '', artist: '', album: '' }
  Song.measureMeta = song.measureMeta
  Song.numMeasures = song.measureMeta.length
  Song.tracks = song.tracks
  Song.chordsMap = song.tracks.map(() => new Map())
  for (const track of song.tracks) {
    // A channel without a program change plays the General MIDI default (program 0).
    const channel = Song.allChannels[track.channel.index]
    if (channel) channel.cInstrument = song.programs.get(track.channel.index) ?? 0
  }
  Song.measures = song.measures
  Song.setTempo(song.bpm)
}
