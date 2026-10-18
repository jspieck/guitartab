import Song, {
  type Beat,
  type BeatEffects,
  type Chord,
  type Grace,
  type MeasureMetaInfo,
  type Note,
  type Track,
} from '../assets/js/songData'
import type { GpifSong } from '../services/gpifImport'
import type { NoteLengthCode } from '../types/tab'
import { drumLine } from '../utils/drumLines'

/**
 * "Open Road": the multi-track demo song first-time visitors see. Written for this
 * project (no third-party music). 14 bars, A minor, 112 BPM (100 in the outro):
 *
 *   Intro  | Am  | Fmaj7 | C | G |                harmonics, volume swell, let-ring arpeggios
 *   Riff   ||: Am | F | C |1. G :||2. G |          strums with muted upstrokes, lead hook,
 *                                                  slap & pop bass, ghost-note snare, tapping fill
 *   Solo   | Dm  | F  | E  | E  |                 triplets, pull-off, bend, tremolo picking, trill
 *   Outro  | Am  |                                 whammy dip, slower tempo
 *
 * Each technique is labelled with a short text so the demo explains itself.
 * Strings are indexed from the lowest (0 = low E on guitar, E1 on bass).
 * Drum notes use the General MIDI drum note as their fret.
 */

const GUITAR = [40, 45, 50, 55, 59, 64]
const BASS = [28, 33, 38, 43]
const DRUM_SLOTS = 6
const BARS = 14

/** [string, fret, extra note properties] */
type NoteSpec = [number, number, Partial<Note>?]

function beat(
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

const g = (duration: NoteLengthCode, notes: NoteSpec[] = [], extra: Partial<Beat> = {}) =>
  beat(duration, GUITAR.length, notes, extra)
const b = (duration: NoteLengthCode, notes: NoteSpec[] = [], extra: Partial<Beat> = {}) =>
  beat(duration, BASS.length, notes, extra)

function effects(more: Partial<BeatEffects>): Partial<Beat> {
  return { effects: { ...Song.defaultMeasureEffects(), ...more } }
}

type DrumHit = number | [number, Partial<Note>]

/** A drum hit: General MIDI drum notes (optionally with note effects), each on its line. */
function d(duration: NoteLengthCode, hits: DrumHit[] = [], extra: Partial<Beat> = {}): Beat {
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
function emptyVoice(stringCount: number): Beat[] {
  const rest = beat('w', stringCount, [])
  rest.empty = true
  return [rest]
}

// ---------------------------------------------------------------------------
// Chords: shapes by string (0 = low E), and diagrams (frets highest string first, -1 muted)

type Shape = Record<number, number>
const SHAPES: Record<string, Shape> = {
  Am: { 1: 0, 2: 2, 3: 2, 4: 1, 5: 0 },
  Fmaj7: { 0: 1, 2: 3, 3: 2, 4: 1, 5: 0 },
  F: { 0: 1, 1: 3, 2: 3, 3: 2, 4: 1, 5: 1 },
  C: { 1: 3, 2: 2, 3: 0, 4: 1, 5: 0 },
  G: { 0: 3, 1: 2, 2: 0, 3: 0, 4: 0, 5: 3 },
  Dm: { 2: 0, 3: 2, 4: 3, 5: 1 },
  E: { 0: 0, 1: 2, 2: 2, 3: 1, 4: 0, 5: 0 },
}

function diagram(name: string): Chord {
  const shape = SHAPES[name]
  const frets = [5, 4, 3, 2, 1, 0].map((string) => shape[string] ?? -1)
  return { ...Song.defaultChord(), name, capo: 0, frets, fingers: frets.map(() => 0), display: true }
}

function strum(name: string, extra: Partial<Note> = {}): NoteSpec[] {
  return Object.entries(SHAPES[name]).map(([string, fret]) => [Number(string), fret, extra])
}

/** The fretting hand lifts off: every string of the chord sounds as a muted "x". */
function mutedStrum(name: string): NoteSpec[] {
  return Object.keys(SHAPES[name]).map((string) => [Number(string), 0, { dead: true }])
}

const down = effects({ stroke: { strokeType: 'down', strokeLength: 32 } })
const up = effects({ stroke: { strokeType: 'up', strokeLength: 32 } })

/** Strum pattern D – D U – D U (quarter, eighth, eighth, quarter, eighth, eighth). */
function strumBar(
  name: string,
  first: Partial<Beat> = {},
  { mutedUps = false, accent = false } = {},
): Beat[] {
  const upStrum = () => (mutedUps ? mutedStrum(name) : strum(name))
  return [
    g('q', strum(name, accent ? { accentuated: true } : {}), { ...down, chord: diagram(name), ...first }),
    g('e', strum(name), down),
    g('e', upStrum(), up),
    g('q', strum(name), down),
    g('e', strum(name), down),
    g('e', upStrum(), up),
  ]
}

/** Eighth-note arpeggio over the strings in `order`, every note ringing. */
function arpeggio(name: string, order: number[], first: Partial<Beat> = {}): Beat[] {
  const shape = SHAPES[name]
  return order.map((string, i) =>
    g('e', [[string, shape[string], { letRing: true }]], i === 0 ? { chord: diagram(name), ...first } : {}),
  )
}

// ---------------------------------------------------------------------------
// Rhythm guitar (acoustic)

const rhythm: Beat[][] = [
  arpeggio('Am', [1, 2, 3, 4, 5, 4, 3, 2], { dynamic: 'mp', dynamicPresent: true, text: 'fingerpicked' }),
  arpeggio('Fmaj7', [0, 2, 3, 4, 5, 4, 3, 2]),
  arpeggio('C', [1, 2, 3, 4, 5, 4, 3, 2]),
  arpeggio('G', [0, 1, 2, 3, 4, 5, 4, 3]),
  strumBar('Am', { dynamic: 'mf', dynamicPresent: true, text: 'strum D - D U - D U' }, { accent: true }),
  strumBar('F'),
  strumBar('C', { text: 'muted upstrokes' }, { mutedUps: true }),
  strumBar('G'),
  // 2nd ending: three hits, the last one ringing
  [
    g('q', strum('G', { accentuated: true }), { ...down, chord: diagram('G') }),
    g('q', strum('G', { accentuated: true }), down),
    g('h', strum('G', { letRing: true }), down),
  ],
  strumBar('Dm', { dynamic: 'f', dynamicPresent: true }),
  strumBar('F'),
  strumBar('E'),
  strumBar('E'),
  [
    g('w', strum('Am', { letRing: true, heavyAccentuated: true }), {
      ...effects({ stroke: { strokeType: 'down', strokeLength: 8 } }),
      chord: diagram('Am'),
      text: 'slow strum, let ring',
    }),
  ],
]

// ---------------------------------------------------------------------------
// Lead guitar (overdrive): A minor pentatonic around the 5th fret

const bend = (value: number) => ({
  bendObj: [
    { bendPosition: 0, bendValue: 0, vibrato: 0 },
    { bendPosition: 20, bendValue: value, vibrato: 0 },
    { bendPosition: 60, bendValue: value, vibrato: 0 },
  ],
})
const vib = { vibrato: true }
const hammer = { pullDown: true }
const harmonic = { artificialStyle: 'N.H.', letRing: true }
const staccato = { stacatto: true }

/** A sixteenth grace note on the same string, sliding into the main note. */
function slideFrom(fret: number, string: number): { graceObj: Grace } {
  return {
    graceObj: {
      fret,
      string,
      height: 0,
      dynamic: 'mf',
      transition: 'slide',
      duration: 's',
      setOnBeat: 'before',
      dead: false,
    },
  }
}

const lead: Beat[][] = [
  // Intro: 12th-fret harmonics, a volume swell, then a pickup into the riff
  [
    g('q', [[1, 12, harmonic]], { dynamic: 'pp', dynamicPresent: true, text: 'natural harmonics' }),
    g('q', [[0, 12, harmonic]]),
    g('h', [[5, 12, harmonic]]),
  ],
  [g('h', [[1, 12, harmonic]]), g('h', [[5, 12, harmonic]])],
  [
    g('w', [[3, 5, vib]], {
      ...effects({ fadeIn: true }),
      dynamic: 'mp',
      dynamicPresent: true,
      text: 'volume swell',
    }),
  ],
  [g('h'), g('q'), g('e', [[2, 7]]), g('e', [[3, 5]])],
  // Riff hook
  [
    g('e', [[4, 5]], { dynamic: 'f', dynamicPresent: true }),
    g('e', [[4, 8]]),
    g('q', [[5, 5, vib]]),
    g('e', [[4, 8]]),
    g('e', [[4, 5]]),
    g('q', [[3, 7]]),
  ],
  [
    g('q', [[3, 5, hammer]], { text: 'hammer-on' }),
    g('e', [[3, 7]]),
    g('e', [[4, 5]]),
    g('h', [[4, 6, { ...vib, ...slideFrom(4, 4) }]], { text: 'grace slide' }),
  ],
  [
    g('e', [[4, 5, staccato]]),
    g('e', [[4, 8, staccato]]),
    g('e', [[5, 5, staccato]]),
    g('e', [[4, 8, staccato]]),
    g('q', [[4, 5, { slide: true }]]),
    g('q', [[3, 5]]),
  ],
  [g('q', [[3, 7, vib]]), g('e', [[3, 5]]), g('e', [[2, 7]]), g('h', [[2, 5, { ...vib, letRing: true }]])],
  // 2nd ending: tapped E5 pulled off down the pentatonic, landing on D for the Dm
  [
    g('e', [[5, 12, { tap: true, pullDown: true }]], { text: 'tapping' }),
    g('e', [[5, 8, hammer]]),
    g('e', [[5, 5]]),
    g('e', [[4, 8, hammer]]),
    g('e', [[4, 5]]),
    g('e', [[3, 7]]),
    g('q', [[1, 5, vib]]),
  ],
  // Solo
  [
    g('q', [[5, 5, vib]]),
    g('e', [[5, 8, hammer]], { text: 'pull-off' }),
    g('e', [[5, 5]]),
    g('q', [[4, 6, bend(100)]]),
    g('q', [[4, 5]]),
  ],
  [
    g('e', [[4, 8]], { tuplet: 3, text: 'triplets' }),
    g('e', [[4, 6]], { tuplet: 3 }),
    g('e', [[4, 5]], { tuplet: 3 }),
    g('e', [[3, 7]], { tuplet: 3 }),
    g('e', [[3, 5]], { tuplet: 3 }),
    g('e', [[3, 7]], { tuplet: 3 }),
    g('h', [[3, 5, vib]]),
  ],
  [
    g('h', [[4, 9, { tremoloPicking: true, tremoloPickingLength: 's' }]], { text: 'tremolo picking' }),
    g('e', [[4, 6]]),
    g('e', [[4, 9]]),
    g('q', [[4, 5]]),
  ],
  [
    g('q', [[5, 7, { trill: { fret: 8, period: 1 } }]], { text: 'trill' }),
    g('q', [[5, 5]]),
    g('q', [[4, 6]]),
    g('q', [[4, 9, bend(50)]]),
  ],
  // Resolves the G# into A, with a dip on the whammy bar
  [
    g('w', [[4, 10, { ...vib, letRing: true }]], {
      ...effects({
        tremoloBar: [
          { position: 0, value: 0, vibrato: 0 },
          { position: 15, value: -50, vibrato: 0 },
          { position: 30, value: 0, vibrato: 0 },
          { position: 60, value: 0, vibrato: 0 },
        ],
      }),
      text: 'whammy dip',
    }),
  ],
]

// ---------------------------------------------------------------------------
// Bass (4 strings, E1 A1 D2 G2)

const roots: Record<string, [NoteSpec, NoteSpec]> = {
  Am: [
    [1, 0],
    [3, 2],
  ],
  F: [
    [0, 1],
    [2, 3],
  ],
  C: [
    [1, 3],
    [3, 5],
  ],
  G: [
    [0, 3],
    [2, 5],
  ],
}

/** Eighths on the root with an octave pop: R R O R R R O R; optionally slapped roots and popped octaves. */
function octaveBar(name: string, { slapPop = false, text = '' } = {}): Beat[] {
  const [root, octave] = roots[name]
  return [root, root, octave, root, root, root, octave, root].map((note, i) => {
    const isOctave = note === octave
    const extra: Partial<Beat> = slapPop ? effects(isOctave ? { pop: true } : { slap: true }) : {}
    return b('e', [note], i === 0 && text ? { ...extra, text } : extra)
  })
}

const quarters = (...notes: NoteSpec[]) => notes.map((note) => b('q', [note]))

const bass: Beat[][] = [
  [b('h', [[1, 0]]), b('h', [[1, 0]])],
  [b('h', [[0, 1]]), b('h', [[0, 1]])],
  [b('h', [[1, 3]]), b('h', [[1, 3]])],
  [b('h', [[0, 3]]), b('q', [[0, 3]]), b('q', [[0, 4]])],
  octaveBar('Am'),
  octaveBar('F'),
  octaveBar('C'),
  octaveBar('G', { slapPop: true, text: 'slap & pop' }),
  // 2nd ending: walk up G A B C# into D
  quarters([0, 3], [1, 0], [1, 2], [1, 4]),
  // Walking line through the solo
  quarters([1, 5], [2, 3], [3, 2], [2, 3]),
  quarters([0, 1], [1, 0], [1, 3], [1, 0]),
  quarters([0, 0], [0, 4], [1, 2], [0, 4]),
  quarters([0, 0], [1, 2], [2, 0], [0, 4]),
  [b('w', [[1, 0, { letRing: true }]])],
]

// ---------------------------------------------------------------------------
// Drums (General MIDI)

const KICK = 36
const SNARE = 38
const STICK = 37
const HAT = 42
const OPEN_HAT = 46
const CRASH = 49
const RIDE = 51
const TOM_HIGH = 48
const TOM_LOW = 45
const ghostSnare: DrumHit = [SNARE, { ghost: true }]
const accentCrash: DrumHit = [CRASH, { accentuated: true }]

/**
 * Eight eighths: `top` cymbal on each, kick on 1, the "and" of 2 and 3, snare on 2 and 4,
 * optionally a ghost note on the "and" of 3.
 */
function rockBar(top: number, { crash = false, openEnd = false, ghosts = false, text = '' } = {}): Beat[] {
  const kick = new Set([0, 3, 4])
  const snare = new Set([2, 6])
  return Array.from({ length: 8 }, (_, i) => {
    const cymbal: DrumHit = i === 0 && crash ? accentCrash : i === 7 && openEnd ? OPEN_HAT : top
    const hits: DrumHit[] = [cymbal]
    if (kick.has(i)) hits.push(KICK)
    if (snare.has(i)) hits.push(SNARE)
    if (ghosts && i === 5) hits.push(ghostSnare)
    return d('e', hits, i === 0 && text ? { text } : {})
  })
}

/** Intro groove: hats, kick on 1 and 3, side stick on 2 and 4. */
function softBar(): Beat[] {
  return Array.from({ length: 8 }, (_, i) =>
    d('e', [HAT, ...(i % 4 === 0 ? [KICK] : []), ...(i % 4 === 2 ? [STICK] : [])]),
  )
}

const drums: Beat[][] = [
  softBar(),
  softBar(),
  softBar(),
  // Snare pickup into the riff
  [...softBar().slice(0, 6), d('e', [SNARE]), d('e', [SNARE, KICK])],
  rockBar(HAT, { crash: true, ghosts: true, text: 'ghost notes' }),
  rockBar(HAT, { ghosts: true }),
  rockBar(HAT, { ghosts: true }),
  rockBar(HAT, { ghosts: true, openEnd: true }),
  // 2nd ending: snare and toms into the solo
  [
    d('e', [HAT, KICK]),
    d('e', [HAT]),
    d('e', [SNARE]),
    d('e', [SNARE]),
    d('s', [TOM_HIGH]),
    d('s', [TOM_HIGH]),
    d('s', [TOM_LOW]),
    d('s', [TOM_LOW]),
    d('e', [SNARE, KICK]),
    d('e', [SNARE]),
  ],
  rockBar(RIDE, { crash: true }),
  rockBar(RIDE),
  rockBar(RIDE),
  // Fill: two beats of groove, then sixteenths down the toms
  [
    d('q', [RIDE, KICK]),
    d('q', [RIDE, SNARE]),
    d('s', [SNARE]),
    d('s', [SNARE]),
    d('s', [SNARE]),
    d('s', [SNARE]),
    d('s', [TOM_HIGH]),
    d('s', [TOM_HIGH]),
    d('s', [TOM_LOW]),
    d('s', [TOM_LOW, KICK]),
  ],
  [d('q', [accentCrash, KICK]), d('h'), d('q')],
]

// ---------------------------------------------------------------------------

function bars(): MeasureMetaInfo[] {
  return Array.from({ length: BARS }, (_, i) => {
    const meta = Song.defaultMeasureMeta()
    meta.keySignature = 0
    meta.timeMeterPresent = i === 0
    if (i === 0) {
      meta.bpm = 112
      meta.marker = { text: 'Intro', color: { red: 40, green: 120, blue: 200 } }
    }
    if (i === 4) {
      meta.marker = { text: 'Riff', color: { red: 220, green: 60, blue: 60 } }
      meta.repeatOpen = true
    }
    if (i === 7) {
      meta.repeatAlternative = 0b01 // 1st ending
      meta.repeatClose = 1
    }
    if (i === 8) meta.repeatAlternative = 0b10 // 2nd ending
    if (i === 9) meta.marker = { text: 'Solo', color: { red: 230, green: 140, blue: 20 } }
    if (i === 13) {
      meta.marker = { text: 'Outro', color: { red: 90, green: 90, blue: 90 } }
      meta.bpm = 100
    }
    return meta
  })
}

function track(
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

/** The demo as song data, ready for `applyGpifSong`. */
export function buildDemoArrangement(): GpifSong {
  const tracks = [
    track('Acoustic Guitar', GUITAR, 24, 0, { red: 60, green: 140, blue: 90 }),
    track('Lead Guitar', GUITAR, 29, 1, { red: 220, green: 60, blue: 60 }),
    track('Bass', BASS, 33, 2, { red: 70, green: 90, blue: 200 }),
    track('Drums', new Array(DRUM_SLOTS).fill(0), 0, 9, { red: 120, green: 120, blue: 120 }),
  ]
  const parts = [rhythm, lead, bass, drums]
  const measures = parts.map((part, t) => part.map((voice) => [voice, emptyVoice(tracks[t].numStrings)]))
  const chords = parts.map((part) => {
    const map = new Map<string, Chord>()
    for (const voice of part) for (const one of voice) if (one.chord) map.set(one.chord.name, one.chord)
    return map
  })
  return {
    description: {
      title: 'Open Road',
      subtitle: 'GuitarTab demo song',
      artist: 'GuitarTab',
      album: '',
      author: 'Demo',
      music: 'GuitarTab',
      copyright: '',
      writer: '',
      instructions: 'Press Play. Switch tracks in the sequencer at the bottom.',
      comments: [],
      wordsAndMusic: '',
    },
    bpm: 112,
    measureMeta: bars(),
    tracks,
    chords,
    measures,
  }
}
