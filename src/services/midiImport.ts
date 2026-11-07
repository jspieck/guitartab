import Song, { type Beat, type MeasureMetaInfo, type Note, type Track } from '../stores/song'
import { IMPORT_LIMITS, ImportError } from './importErrors'
import { warnImport } from './importWarnings'
import type { NoteLengthCode } from '../types/tab'
import type { MidiFileData } from './import/midiFile'

export type { MidiFileData }

/**
 * Standard MIDI files → song data (a lazy chunk, loaded by `importSongFile`).
 *
 * Positions are counted in units of a 24th of a quarter, so straight 16ths (6) and
 * 32nds (3), triplet 8ths (8) and triplet 16ths (4) are all whole numbers. Each quarter
 * of the song gets the grid its onsets fit best; a note sustained past the next onset
 * (a bass under an arpeggio) goes to voice 2, so it keeps its length.
 */

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
/** Notes of one voice starting together, in units; `end` is the longest of them. */
interface Onset {
  at: number
  end: number
  notes: { pitch: number; velocity: number; end: number }[]
}

const DRUM_CHANNEL = 9
const GUITAR_TUNING = [40, 45, 50, 55, 59, 64]
const BASS_TUNING = [28, 33, 38, 43]
const MAX_FRET = 24
const QUARTER = 24
// Grids a quarter can use, in units, plainest first: 16ths, triplet 8ths, triplet 16ths, 32nds.
const GRIDS = [6, 8, 4, 3]
// A voice 2 that would take more than this share of a track's notes means the file is
// played legato (notes overlap their successors), not written in two voices.
const MAX_VOICE2_SHARE = 0.6

interface NoteValue {
  units: number
  duration: NoteLengthCode
  dotted: boolean
  tuplet: number | null
}
// Longest first.
const STRAIGHT_VALUES: NoteValue[] = [
  { units: 96, duration: 'w', dotted: false, tuplet: null },
  { units: 72, duration: 'h', dotted: true, tuplet: null },
  { units: 48, duration: 'h', dotted: false, tuplet: null },
  { units: 36, duration: 'q', dotted: true, tuplet: null },
  { units: 24, duration: 'q', dotted: false, tuplet: null },
  { units: 18, duration: 'e', dotted: true, tuplet: null },
  { units: 12, duration: 'e', dotted: false, tuplet: null },
  { units: 6, duration: 's', dotted: false, tuplet: null },
  { units: 3, duration: 't', dotted: false, tuplet: null },
]
const TRIPLET_VALUES: NoteValue[] = [
  { units: 16, duration: 'q', dotted: false, tuplet: 3 },
  { units: 8, duration: 'e', dotted: false, tuplet: 3 },
  { units: 4, duration: 's', dotted: false, tuplet: 3 },
]

function makeBeat(value: NoteValue, notes: (Note | null)[] | null, stringCount: number): Beat {
  const beat = Song.defaultMeasure()
  beat.duration = notes == null ? `${value.duration}r` : value.duration
  beat.dotted = value.dotted
  beat.tuplet = value.tuplet
  beat.notes = notes ?? new Array(stringCount).fill(null)
  return beat
}

/** The pitch moved by octaves into the instrument's range. */
function fitPitch(pitch: number, tuning: number[]): number {
  let fitted = pitch
  while (fitted < tuning[0]) fitted += 12
  while (fitted > tuning[tuning.length - 1] + MAX_FRET) fitted -= 12
  return fitted
}

/**
 * Strings for pitches sounding together, each on the free string where its fret is lowest.
 * Pitches with the fewest playable strings go first (a low E has only one), the rest from
 * the highest down. `busy` strings (still ringing from an earlier note) are avoided while
 * another string can take the pitch. Pitches without a string are missing from the result.
 */
function assignStrings(pitches: number[], tuning: number[], busy: ReadonlySet<number>): Map<number, number> {
  const strings = new Map<number, number>()
  const taken = new Set<number>()
  const options = (raw: number) =>
    tuning.filter((open) => fitPitch(raw, tuning) - open >= 0 && fitPitch(raw, tuning) - open <= MAX_FRET)
      .length
  const order = [...new Set(pitches)].sort((a, b) => options(a) - options(b) || b - a)
  for (const raw of order) {
    const pitch = fitPitch(raw, tuning)
    const pick = (allowBusy: boolean) => {
      let best = -1
      for (let string = 0; string < tuning.length; string += 1) {
        const fret = pitch - tuning[string]
        if (taken.has(string) || (!allowBusy && busy.has(string)) || fret < 0 || fret > MAX_FRET) continue
        if (best === -1 || fret < pitch - tuning[best]) best = string
      }
      return best
    }
    const string = pick(false) !== -1 ? pick(false) : pick(true)
    if (string === -1) continue
    taken.add(string)
    strings.set(raw, string)
  }
  return strings
}

/** Places pitches on strings: each gets its own string, at the lowest fret that fits. */
export function placeOnStrings(pitches: number[], tuning: number[]): (number | null)[] {
  const frets: (number | null)[] = new Array(tuning.length).fill(null)
  for (const [pitch, string] of assignStrings(pitches, tuning, new Set()))
    frets[string] = fitPitch(pitch, tuning) - tuning[string]
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

/**
 * The grid of every quarter that has onsets: the plainest one all its onsets lie on
 * (within a unit, for files written by notation programs), else the one of 16ths and
 * triplet 8ths that moves them least (played-in files).
 */
function chooseGrids(onsets: number[]): Map<number, number> {
  const byQuarter = new Map<number, number[]>()
  for (const at of onsets) {
    const quarter = Math.floor((at + 0.5) / QUARTER)
    byQuarter.set(quarter, [...(byQuarter.get(quarter) ?? []), at])
  }
  const grids = new Map<number, number>()
  for (const [quarter, positions] of byQuarter) {
    const error = (grid: number) => positions.map((at) => Math.abs(at - Math.round(at / grid) * grid))
    const exact = GRIDS.find((grid) => error(grid).every((value) => value <= 1))
    const sum = (grid: number) => error(grid).reduce((total, value) => total + value, 0)
    grids.set(quarter, exact ?? (sum(8) < sum(6) ? 8 : 6))
  }
  return grids
}

function snapper(grids: Map<number, number>) {
  const gridAt = (at: number) => grids.get(Math.floor((at + 0.5) / QUARTER)) ?? 6
  return {
    gridAt: (unit: number) => grids.get(Math.floor(unit / QUARTER)) ?? 6,
    snap: (at: number) => Math.round(at / gridAt(at)) * gridAt(at),
  }
}

/** Bars up to the last onset, honouring time-signature changes at bar starts; positions in units. */
function buildBars(timeline: Timeline, lastOnset: number, toUnits: (tick: number) => number): Bar[] {
  const bars: Bar[] = []
  let position = 0
  let meter = { numerator: 4, denominator: 4 }
  while (position <= lastOnset) {
    if (bars.length >= IMPORT_LIMITS.measures) {
      throw new ImportError(`The song is longer than ${IMPORT_LIMITS.measures} bars.`, 'mid')
    }
    const change = [...timeline.meters]
      .reverse()
      .find((candidate) => toUnits(candidate.tick) <= position + 0.5)
    const changed =
      change != null && (change.numerator !== meter.numerator || change.denominator !== meter.denominator)
    if (change) meter = { numerator: change.numerator, denominator: change.denominator }
    const meta = Song.defaultMeasureMeta()
    meta.numerator = meter.numerator
    meta.denominator = meter.denominator
    meta.keySignature = 0
    meta.timeMeterPresent = bars.length === 0 || changed
    const length = Math.max(3, Math.round((meter.numerator * QUARTER * 4) / meter.denominator))
    bars.push({ start: position, length, meta })
    position += length
  }
  bars[0].meta.bpm = timeline.tempos.find((tempo) => tempo.tick === 0)?.bpm ?? timeline.tempos[0]?.bpm ?? 120
  for (const tempo of timeline.tempos) {
    const at = toUnits(tempo.tick)
    const bar = bars.findIndex(
      (candidate) => at >= candidate.start - 0.5 && at < candidate.start + candidate.length - 0.5,
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

/** Track names as LilyPond writes them ("guitar:", ":one") without the empty half. */
function trackName(group: NoteGroup, index: number): string {
  const name = group.name
    .trim()
    .replace(/^:+|:+$/g, '')
    .trim()
  return name || (group.channel === DRUM_CHANNEL ? 'Drums' : `Track ${index + 1}`)
}

function buildTrack(group: NoteGroup, index: number, tuning: number[], programs: Map<number, number>): Track {
  return {
    ...Song.defaultTrack(),
    name: trackName(group, index),
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

/**
 * A track's notes as onsets of voice 1 and voice 2: notes that still sound when the next
 * onset starts go to voice 2 (drums and legato-played tracks stay in one voice).
 */
function splitVoices(
  group: NoteGroup,
  toUnits: (tick: number) => number,
  { snap, gridAt }: ReturnType<typeof snapper>,
): Onset[][] {
  const byStart = new Map<number, { pitch: number; velocity: number; end: number }[]>()
  for (const note of group.notes) {
    const at = snap(toUnits(note.start))
    // A note without a note-off lasts until the next onset.
    const end = Number.isFinite(note.end) ? Math.max(at + gridAt(at), snap(toUnits(note.end))) : at
    const here = byStart.get(at) ?? []
    // The same pitch twice at one onset (fast ornaments snapped together) sounds once.
    const same = here.find((other) => other.pitch === note.pitch)
    if (same) same.end = Math.max(same.end, end)
    else here.push({ pitch: note.pitch, velocity: note.velocity, end })
    byStart.set(at, here)
  }
  const starts = [...byStart.keys()].sort((a, b) => a - b)
  const voices: Onset[][] = [[], []]
  let held = 0
  starts.forEach((at, i) => {
    const next = starts[i + 1] ?? Number.POSITIVE_INFINITY
    const notes = byStart.get(at)!
    const drums = group.channel === DRUM_CHANNEL
    const keep = drums ? notes : notes.filter((note) => note.end <= next)
    const sustained = drums ? [] : notes.filter((note) => note.end > next)
    held += sustained.length
    for (const [voice, part] of [keep, sustained].entries()) {
      if (part.length === 0) continue
      voices[voice].push({ at, end: Math.max(...part.map((note) => note.end)), notes: part })
    }
  })
  if (held > group.notes.length * MAX_VOICE2_SHARE) {
    // Everything back into one voice, as the onsets were.
    return [
      starts.map((at) => {
        const notes = byStart.get(at)!
        return { at, end: Math.max(...notes.map((note) => note.end)), notes }
      }),
      [],
    ]
  }
  return voices
}

/**
 * Strings for every onset of both voices, in time order: notes starting together are placed
 * together, and strings still ringing from an earlier note are avoided. Keyed by onset.
 */
function placeVoices(voices: Onset[][], tuning: number[], drums: boolean): Map<Onset, (Note | null)[]> {
  const placed = new Map<Onset, (Note | null)[]>()
  if (drums) {
    // Drum notes keep their MIDI number as the fret, one per line.
    for (const onset of voices[0]) {
      const pitches = [...new Set(onset.notes.map((note) => note.pitch))]
      warnImport('unplacedNotes', pitches.length - tuning.length)
      placed.set(
        onset,
        tuning.map((_, string) =>
          pitches[string] == null
            ? null
            : { ...Song.defaultNote(), fret: pitches[string], string, velocity: 96 },
        ),
      )
    }
    return placed
  }
  const ringing: { string: number; end: number }[] = []
  const times = [...new Set(voices.flat().map((onset) => onset.at))].sort((a, b) => a - b)
  for (const at of times) {
    const here = voices.map((voice) => voice.find((onset) => onset.at === at))
    const busy = new Set(ringing.filter((note) => note.end > at).map((note) => note.string))
    const pitches = here.flatMap((onset) => onset?.notes.map((note) => note.pitch) ?? [])
    const strings = assignStrings(pitches, tuning, busy)
    const used = new Set<number>()
    for (const onset of here) {
      if (onset == null) continue
      const notes: (Note | null)[] = new Array(tuning.length).fill(null)
      for (const { pitch, velocity, end } of onset.notes) {
        const string = strings.get(pitch)
        if (string == null || used.has(string)) {
          warnImport('unplacedNotes')
          continue
        }
        used.add(string)
        notes[string] = {
          ...Song.defaultNote(),
          fret: fitPitch(pitch, tuning) - tuning[string],
          string,
          velocity: Math.min(127, Math.max(1, velocity)),
        }
        ringing.push({ string, end })
      }
      placed.set(onset, notes)
    }
  }
  return placed
}

/**
 * [from, to) cut into stretches that take plain or triplet values: whole quarters are plain
 * (a beat-long note in a triplet passage is a quarter), the part of a quarter before or
 * after them takes that quarter's kind. Neighbouring plain stretches are joined.
 */
function stretches(from: number, to: number, gridAt: (unit: number) => number) {
  const firstWhole = Math.ceil(from / QUARTER) * QUARTER
  const lastWhole = Math.floor(to / QUARTER) * QUARTER
  const pieces: { from: number; to: number; triplet: boolean }[] = []
  const add = (start: number, end: number, triplet: boolean) => {
    if (end <= start) return
    const last = pieces[pieces.length - 1]
    if (last != null && !last.triplet && !triplet && last.to === start) last.to = end
    else pieces.push({ from: start, to: end, triplet })
  }
  const isTriplet = (unit: number) => gridAt(unit) % 3 !== 0
  if (firstWhole > lastWhole) {
    add(from, to, isTriplet(from))
  } else {
    add(from, firstWhole, isTriplet(from))
    add(firstWhole, lastWhole, false)
    add(lastWhole, to, isTriplet(lastWhole))
  }
  return pieces
}

/** Note values that fill [from, to): triplet values inside triplet quarters, plain ones elsewhere. */
function valuesBetween(from: number, to: number, gridAt: (unit: number) => number): NoteValue[] {
  const values: NoteValue[] = []
  for (const stretch of stretches(from, to, gridAt)) {
    const table = stretch.triplet ? TRIPLET_VALUES : STRAIGHT_VALUES
    for (let at = stretch.from; at < stretch.to;) {
      const value = table.find((candidate) => candidate.units <= stretch.to - at)
      // Only left over off the grid (bars of odd lengths); bar padding on load fills the rest.
      if (value == null) break
      values.push(value)
      at += value.units
    }
  }
  return values
}

/** A later piece of a note split into several values: the same notes, tied. */
function tiedCopy(notes: (Note | null)[]): (Note | null)[] {
  return notes.map((note) => (note == null ? null : { ...note, tied: true }))
}

/** One voice of one bar: notes at their onsets, gaps and short notes' tails as rests. */
function buildBarBeats(
  bar: Bar,
  onsets: Onset[],
  placed: Map<Onset, (Note | null)[]>,
  stringCount: number,
  gridAt: (unit: number) => number,
): Beat[] {
  const barEnd = bar.start + bar.length
  const inBar = onsets.filter((onset) => onset.at >= bar.start && onset.at < barEnd)
  const beats: Beat[] = []
  const rests = (from: number, to: number) => {
    for (const value of valuesBetween(from, to, gridAt)) beats.push(makeBeat(value, null, stringCount))
  }
  let cursor = bar.start
  inBar.forEach((onset, i) => {
    rests(cursor, onset.at)
    const next = inBar[i + 1]?.at ?? barEnd
    const soundEnd = Math.min(next, onset.end)
    const notes = placed.get(onset) ?? new Array(stringCount).fill(null)
    valuesBetween(onset.at, soundEnd, gridAt).forEach((value, piece) =>
      beats.push(makeBeat(value, piece === 0 ? notes : tiedCopy(notes), stringCount)),
    )
    rests(soundEnd, next)
    cursor = next
  })
  rests(cursor, barEnd)
  return beats
}

/** Converts a decoded MIDI file into song data (one track per MIDI track and channel). */
export function buildSongFromMidi(
  midi: MidiFileData,
  fileName: string,
  // Strings per track (by import order) instead of guitar or bass, e.g. a violin's.
  { tunings = [] }: { tunings?: (number[] | undefined)[] } = {},
): ImportedSong {
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

  const toUnits = (tick: number) => (tick * QUARTER) / midi.ticksPerBeat
  // One grid for all tracks, so parts playing together line up.
  const grid = snapper(
    chooseGrids(playable.flatMap((group) => group.notes.map((note) => toUnits(note.start)))),
  )
  const { gridAt, snap } = grid
  const lastOnset = Math.max(
    ...playable.flatMap((group) => group.notes.map((note) => snap(toUnits(note.start)))),
  )
  const bars = buildBars(timeline, lastOnset, toUnits)

  const tracks = playable.map((group, index) =>
    buildTrack(group, index, tunings[index] ?? chooseTuning(group), timeline.programs),
  )
  const measures = playable.map((group, index) => {
    const tuning = tracks[index].strings
    const voices = splitVoices(group, toUnits, grid)
    const placed = placeVoices(voices, tuning, group.channel === DRUM_CHANNEL)
    return bars.map((bar) => {
      const second = buildBarBeats(bar, voices[1], placed, tuning.length, gridAt)
      if (voices[1].every((onset) => onset.at < bar.start || onset.at >= bar.start + bar.length)) {
        const empty = makeBeat(STRAIGHT_VALUES[0], null, tuning.length)
        empty.empty = true // filled with rests on load
        second.splice(0, second.length, empty)
      }
      return [buildBarBeats(bar, voices[0], placed, tuning.length, gridAt), second]
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
  // Nothing of the previous song's info carries over (MIDI files have only a name).
  Song.songDescription = {
    title: song.title,
    author: '',
    subtitle: '',
    artist: '',
    album: '',
    music: '',
    copyright: '',
    writer: '',
    instructions: '',
    comments: [],
    wordsAndMusic: '',
  }
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
