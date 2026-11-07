import type { Beat, MeasureMetaInfo, Note, SongDescription, Track } from '../../src/types/song'

/** Plain song data for exporter/importer tests (no `Song` store involved). */

export function note(fret: number, extra: Partial<Note> = {}): Note {
  return {
    string: 0,
    fret,
    dead: false,
    height: 0,
    tied: false,
    tieBegin: false,
    tiedTo: { blockId: -1, beatId: -1 },
    palmMute: false,
    stacatto: false,
    tap: false,
    fadeIn: false,
    pop: false,
    slap: false,
    ghost: false,
    accentuated: false,
    heavyAccentuated: false,
    vibrato: false,
    tremoloPickingLength: 'e',
    tremoloPicking: false,
    pullDown: false,
    letRing: false,
    slide: false,
    velocity: 0,
    element: 0,
    octave: 0,
    tone: 0,
    ...extra,
  }
}

/** A beat; `notes` maps string index (0 = lowest) to a note; no notes makes it a rest. */
export function beat(
  duration: string,
  notes: Record<number, Note> = {},
  extra: Partial<Beat> = {},
  stringCount = 6,
): Beat {
  const list: (Note | null)[] = new Array(stringCount).fill(null)
  for (const [string, value] of Object.entries(notes))
    list[Number(string)] = { ...value, string: Number(string) }
  const hasNotes = Object.keys(notes).length > 0
  return {
    duration: (hasNotes ? duration : `${duration}r`) as Beat['duration'],
    notes: list,
    effects: { vibrato: false, fadeIn: false, tap: false, slap: false, pop: false },
    dynamic: 'mf',
    otherNotes: [],
    tuplet: null,
    tupletId: 0,
    dotted: false,
    doubleDotted: false,
    dynamicPresent: false,
    empty: false,
    keySignature: '',
    noteIds: [],
    rhythmId: 0,
    ...extra,
  }
}

export function meta(
  numerator: number,
  denominator: number,
  extra: Partial<MeasureMetaInfo> = {},
): MeasureMetaInfo {
  return {
    numerator,
    denominator,
    timeMeterPresent: false,
    repeatOpen: false,
    keySignature: 0,
    automations: [],
    ...extra,
  }
}

export function track(name: string, extra: Partial<Track> = {}): Track {
  return {
    name,
    numStrings: 6,
    capo: 0,
    strings: [40, 45, 50, 55, 59, 64],
    volume: 127,
    balance: 63,
    reverb: 0,
    color: { red: 0, green: 0, blue: 0 },
    channel: { index: 0, effectChannel: 0 },
    program: 25,
    primaryChannel: 0,
    letItRing: false,
    ...extra,
  }
}

export function description(extra: Partial<SongDescription> = {}): SongDescription {
  return {
    title: 'Test',
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
    ...extra,
  }
}
