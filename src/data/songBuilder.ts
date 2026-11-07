import Song, {
  type Beat,
  type BeatEffects,
  type Chord,
  type MeasureMetaInfo,
  type Note,
  type Track,
} from '../stores/song'
import type { GpifSong } from '../services/gpifImport'
import type { SongDescription } from '../types/song'
import type { NoteLengthCode } from '../types/tab'
import { drumLine } from '../utils/drumLines'

/**
 * Building blocks for the songs written in code (the demo "Open Road", the example
 * "Back Porch Shuffle"). Strings are indexed from the lowest (0 = low E on guitar, E1 on
 * bass); drum notes use the General MIDI drum note as their fret.
 */

export const GUITAR = [40, 45, 50, 55, 59, 64]
export const BASS = [28, 33, 38, 43]
export const DRUM_SLOTS = 6

// General MIDI drums
export const KICK = 36
export const SNARE = 38
export const STICK = 37
export const HAT = 42
export const OPEN_HAT = 46
export const CRASH = 49
export const RIDE = 51
export const TOM_HIGH = 48
export const TOM_LOW = 45

/** [string, fret, extra note properties] */
export type NoteSpec = [number, number, Partial<Note>?]

export function beat(
  duration: NoteLengthCode,
  stringCount: number,
  notes: NoteSpec[],
  extra: Partial<Beat> = {},
): Beat {
  const beatData = Song.defaultMeasure()
  beatData.notes = new Array(stringCount).fill(null)
  for (const [string, fret, more] of notes) {
    beatData.notes[string] = { ...Song.defaultNote(), string, fret, ...more }
  }
  beatData.duration = notes.length > 0 ? duration : `${duration}r`
  beatData.tuplet = null
  Object.assign(beatData, extra)
  // Every beat gets its own effects object, so editing one stroke doesn't change the others.
  const stroke = extra.effects?.stroke
  beatData.effects = {
    ...Song.defaultMeasureEffects(),
    ...extra.effects,
    ...(stroke ? { stroke: { ...stroke } } : {}),
  }
  return beatData
}

export const g = (duration: NoteLengthCode, notes: NoteSpec[] = [], extra: Partial<Beat> = {}) =>
  beat(duration, GUITAR.length, notes, extra)
export const b = (duration: NoteLengthCode, notes: NoteSpec[] = [], extra: Partial<Beat> = {}) =>
  beat(duration, BASS.length, notes, extra)

export function effects(more: Partial<BeatEffects>): Partial<Beat> {
  return { effects: { ...Song.defaultMeasureEffects(), ...more } }
}

export type DrumHit = number | [number, Partial<Note>]

/** A drum hit: General MIDI drum notes (optionally with note effects), each on its line. */
export function d(duration: NoteLengthCode, hits: DrumHit[] = [], extra: Partial<Beat> = {}): Beat {
  const notes = hits.map((hit) => {
    const [midi, more] = typeof hit === 'number' ? [hit, undefined] : hit
    return [drumLine(midi), midi, more] as NoteSpec
  })
  if (new Set(notes.map(([slot]) => slot)).size !== notes.length) {
    throw new Error(`Two drums share a line: ${hits.join(', ')}`)
  }
  return beat(duration, DRUM_SLOTS, notes, extra)
}

/** A voice the app fills with rests on load. */
export function emptyVoice(stringCount: number): Beat[] {
  const rest = beat('w', stringCount, [])
  rest.empty = true
  return [rest]
}

/** Chord shape by string (0 = low E) → fret. */
export type Shape = Record<number, number>

/** A chord diagram (frets highest string first, -1 muted) for a shape. */
export function diagramOf(name: string, shape: Shape): Chord {
  const frets = [5, 4, 3, 2, 1, 0].map((string) => shape[string] ?? -1)
  return { ...Song.defaultChord(), name, capo: 0, frets, fingers: frets.map(() => 0), display: true }
}

export function track(
  name: string,
  strings: number[],
  program: number,
  channel: number,
  color: Track['color'],
): Track {
  return {
    ...Song.defaultTrack(),
    name,
    strings: [...strings],
    numStrings: strings.length,
    capo: 0,
    volume: 127,
    balance: 63,
    color,
    channel: { index: channel, effectChannel: channel },
    program,
    primaryChannel: channel,
  }
}

/** Bar metadata for `count` bars in 4/4, A minor/C major; `edit` adds markers, repeats, tempo. */
export function plainBars(
  count: number,
  edit: (meta: MeasureMetaInfo, index: number) => void,
): MeasureMetaInfo[] {
  return Array.from({ length: count }, (_, i) => {
    const meta = Song.defaultMeasureMeta()
    meta.keySignature = 0
    meta.timeMeterPresent = i === 0
    edit(meta, i)
    return meta
  })
}

/** The parts (one voice-1 bar list per track) as song data, ready for `applyGpifSong`. */
export function assembleSong(
  description: Partial<SongDescription> & { title: string },
  bpm: number,
  measureMeta: MeasureMetaInfo[],
  tracks: Track[],
  parts: Beat[][][],
): GpifSong {
  const measures = parts.map((part, t) => part.map((voice) => [voice, emptyVoice(tracks[t].numStrings)]))
  const chords = parts.map((part) => {
    const map = new Map<string, Chord>()
    for (const voice of part) for (const one of voice) if (one.chord) map.set(one.chord.name, one.chord)
    return map
  })
  return {
    description: {
      subtitle: '',
      artist: '',
      album: '',
      author: '',
      music: '',
      copyright: '',
      writer: '',
      instructions: '',
      comments: [],
      wordsAndMusic: '',
      ...description,
    },
    bpm,
    measureMeta,
    tracks,
    chords,
    measures,
  }
}
