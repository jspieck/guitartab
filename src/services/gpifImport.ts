import Song, {
  type Beat,
  type Bend,
  type Chord,
  type Grace,
  type MeasureMetaInfo,
  type Note,
  type SongDescription,
  type Stroke,
  type Track,
  type TremoloBar,
} from '../stores/song'
import { IMPORT_LIMITS, ImportError } from './importErrors'
import { assignDrumLines } from '../utils/drumLines'
import type { NoteLengthCode } from '../types/tab'

/**
 * Reads GPIF, the XML score format of Guitar Pro 6 (.gpx) and 7/8 (.gp), into song data.
 *
 * GPIF stores every entity once in a flat list and links them by id:
 * MasterBar → one Bar per staff → Voices → Beats → Rhythm + Notes.
 * Each Guitar Pro staff becomes one track here (a piano's two staves become two tracks).
 */

const DRUM_CHANNEL = 9
const GUITAR_TUNING = [40, 45, 50, 55, 59, 64]
const MAX_VOICES = 2
const MAX_FRET = 24
// Guitar Pro curve offsets run 0–100; GP3–5 files (and this app) use 0–60.
const CURVE_POSITION_SCALE = 0.6
const CURVE_END = 60

const NOTE_VALUES: Record<string, NoteLengthCode> = {
  Long: 'w',
  DoubleWhole: 'w',
  Whole: 'w',
  Half: 'h',
  Quarter: 'q',
  Eighth: 'e',
  '16th': 's',
  '32nd': 't',
  '64th': 'z',
  '128th': 'o',
  '256th': '2' as NoteLengthCode, // no editor support for 256ths; kept as before
}
const HARMONICS: Record<string, string> = {
  Natural: 'N.H.',
  Artificial: 'A.H.',
  Pinch: 'P.H.',
  Tap: 'T.H.',
  Semi: 'S.H.',
  Feedback: 'N.H.',
}
const TREMOLO_PICKING: Record<string, string> = { '1/8': 'e', '1/16': 's', '1/32': 't' }
// Tempo automations name the beat unit: 1 = eighth, 2 = quarter, 3 = dotted quarter, 4 = half, 5 = dotted half.
const TEMPO_UNIT_TO_QUARTERS = [1, 0.5, 1, 1.5, 2, 3]
// GP6 drum notes name a kit element (and variation) instead of a MIDI note.
export const GP6_DRUM_ELEMENTS: Record<number, number[]> = {
  0: [36],
  1: [38],
  2: [37],
  3: [56],
  4: [54],
  5: [39],
  6: [43],
  7: [45],
  8: [47],
  9: [48],
  10: [42, 44, 46],
  11: [49],
  12: [49],
  13: [51, 53],
  14: [57],
  15: [52],
}

export interface GpifSong {
  description: SongDescription
  bpm: number
  measureMeta: MeasureMetaInfo[]
  tracks: Track[]
  chords: Map<string, Chord>[]
  measures: Beat[][][][]
}

interface Rhythm {
  duration: NoteLengthCode
  dots: number
  tuplet: number | null
}

interface GpifNote {
  note: Note
  /** MIDI pitch for notes without a string (piano, GP7 drums), else null. */
  pitch: number | null
  /** Trill partner as a MIDI pitch; turned into a fret once the tuning is known. */
  trillPitch: number | null
  drumArticulation: number | null
}

interface GpifBeat {
  rhythm: Rhythm
  noteIds: string[]
  dynamic: string | null
  grace: 'before' | 'with' | null
  chordId: string | null
  text: string | null
  tremoloPicking: string | null
  fadeIn: boolean
  slap: boolean
  pop: boolean
  stroke: Stroke | null
  tremoloBar: TremoloBar | null
}

interface Staff {
  name: string
  tuning: number[]
  capo: number
  isDrums: boolean
  program: number
  channel: number
  color: Track['color']
  chordsById: Map<string, Chord>
  /** MIDI note per GP7 drum articulation index. */
  drumArticulations: number[]
}

// ---------------------------------------------------------------------------
// XML helpers. GPIF wraps most text in CDATA, so read textContent.

function childElements(node: Element | null | undefined, name?: string): Element[] {
  const out: Element[] = []
  if (node == null) return out
  for (const child of Array.from(node.children)) {
    if (name == null || child.tagName === name) out.push(child)
  }
  return out
}

function child(node: Element | null | undefined, name: string): Element | null {
  if (node == null) return null
  return childElements(node, name)[0] ?? null
}

function text(node: Element | null | undefined, name: string): string | null {
  const element = child(node, name)
  return element == null ? null : (element.textContent ?? '').trim()
}

function int(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function float(value: string | null | undefined): number | null {
  const parsed = Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) ? parsed : null
}

function idList(value: string | null): string[] {
  return (value ?? '')
    .trim()
    .split(/\s+/)
    .filter((id) => id !== '')
}

/** `<Properties><Property name="X">…</Property></Properties>` as a name → element map. */
function properties(node: Element | null | undefined): Map<string, Element> {
  const map = new Map<string, Element>()
  for (const property of childElements(child(node, 'Properties'), 'Property')) {
    const name = property.getAttribute('name')
    if (name != null) map.set(name, property)
  }
  return map
}

function byId(root: Element, listName: string, itemName: string): Map<string, Element> {
  const map = new Map<string, Element>()
  for (const item of childElements(child(root, listName), itemName)) {
    const id = item.getAttribute('id')
    if (id != null) map.set(id, item)
  }
  return map
}

// ---------------------------------------------------------------------------
// Score, tracks, staves

function readDescription(score: Element | null): SongDescription {
  const field = (name: string) => text(score, name) ?? ''
  return {
    title: field('Title'),
    subtitle: field('SubTitle'),
    artist: field('Artist'),
    album: field('Album'),
    writer: field('Words'),
    music: field('Music'),
    wordsAndMusic: field('WordsAndMusic'),
    copyright: field('Copyright'),
    author: field('Tabber'),
    instructions: field('Instructions'),
    comments: field('Notices') === '' ? [] : field('Notices').split(/\r?\n/),
  }
}

/** Chord diagrams of a track or staff; GPIF lists strings low to high, the app high to low. */
function readChords(props: Map<string, Element>, stringCount: number): Map<string, Chord> {
  const chords = new Map<string, Chord>()
  for (const propertyName of ['DiagramCollection', 'DiagramWorkingSet']) {
    for (const item of childElements(child(props.get(propertyName), 'Items'), 'Item')) {
      const id = item.getAttribute('id')
      if (id == null || chords.has(id)) continue
      const diagram = child(item, 'Diagram')
      const count = int(diagram?.getAttribute('stringCount'), stringCount)
      const baseFret = int(diagram?.getAttribute('baseFret'), 0)
      const frets = new Array(count).fill(-1)
      for (const fret of childElements(diagram, 'Fret')) {
        const string = int(fret.getAttribute('string'), -1)
        if (string >= 0 && string < count)
          frets[count - 1 - string] = int(fret.getAttribute('fret'), 0) + baseFret
      }
      chords.set(id, {
        ...Song.defaultChord(),
        name: item.getAttribute('name') ?? '',
        capo: 0,
        frets,
        fingers: frets.map(() => 0),
        display: true,
      })
    }
  }
  return chords
}

function readTuning(props: Map<string, Element>): number[] | null {
  const pitches = idList(text(props.get('Tuning'), 'Pitches')).map((pitch) => int(pitch, -1))
  return pitches.length > 0 && pitches.every((pitch) => pitch >= 0 && pitch < 128) ? pitches : null
}

function readStaves(trackNode: Element): Staff[] {
  const trackProps = properties(trackNode)
  const name = text(trackNode, 'Name') || text(trackNode, 'ShortName') || 'Track'
  const rgb = idList(text(trackNode, 'Color')).map((value) => int(value, 0))
  const color =
    rgb.length === 3 ? { red: rgb[0], green: rgb[1], blue: rgb[2] } : { red: 220, green: 60, blue: 60 }

  // GP6 keeps sound settings in <GeneralMidi>; GP7 splits them into <Sounds> and <MidiConnection>.
  const generalMidi = child(trackNode, 'GeneralMidi')
  const sound = child(child(trackNode, 'Sounds'), 'Sound')
  const program = int(text(generalMidi, 'Program') ?? text(child(sound, 'MIDI'), 'Program'), 0)
  let channel = int(
    text(generalMidi, 'PrimaryChannel') ?? text(child(trackNode, 'MidiConnection'), 'PrimaryChannel'),
    0,
  )
  const instrumentSet = child(trackNode, 'InstrumentSet')
  const instrumentRef = child(trackNode, 'Instrument')?.getAttribute('ref') ?? ''
  const isDrums =
    channel === DRUM_CHANNEL ||
    text(instrumentSet, 'Type') === 'drumKit' ||
    instrumentRef.startsWith('drumkit')
  if (isDrums) channel = DRUM_CHANNEL

  const drumArticulations: number[] = []
  for (const element of childElements(child(instrumentSet, 'Elements'), 'Element')) {
    for (const articulation of childElements(child(element, 'Articulations'), 'Articulation')) {
      drumArticulations.push(int(text(articulation, 'OutputMidiNumber'), 0))
    }
  }

  const staffNodes = childElements(child(trackNode, 'Staves'), 'Staff')
  // GP6 has no <Staves>; its grand-staff instruments ("…-gs") use two bars per master bar.
  const staffProps =
    staffNodes.length > 0
      ? staffNodes.map((staff) => properties(staff))
      : instrumentRef.endsWith('-gs')
        ? [trackProps, trackProps]
        : [trackProps]

  return staffProps.map((props, index) => {
    const tuning =
      readTuning(props) ?? readTuning(trackProps) ?? (isDrums ? new Array(6).fill(0) : GUITAR_TUNING)
    const capo = int(text(props.get('CapoFret') ?? trackProps.get('CapoFret'), 'Fret'), 0)
    const chords = readChords(props, tuning.length)
    for (const [id, chord] of readChords(trackProps, tuning.length))
      if (!chords.has(id)) chords.set(id, chord)
    return {
      name: staffProps.length > 1 ? `${name} ${index + 1}` : name,
      tuning: [...tuning],
      capo,
      isDrums,
      program,
      channel,
      color,
      chordsById: chords,
      drumArticulations,
    }
  })
}

function toTrack(staff: Staff): Track {
  return {
    ...Song.defaultTrack(),
    name: staff.name,
    strings: staff.tuning,
    numStrings: staff.tuning.length,
    capo: staff.capo,
    volume: 127,
    balance: 63,
    color: staff.color,
    channel: { index: staff.channel, effectChannel: staff.channel },
    program: staff.program,
    primaryChannel: staff.channel,
  }
}

// ---------------------------------------------------------------------------
// Bars and tempo

function readMasterBars(gpif: Element): { meta: MeasureMetaInfo[]; barIds: string[][] } {
  const nodes = childElements(child(gpif, 'MasterBars'), 'MasterBar')
  if (nodes.length > IMPORT_LIMITS.measures) {
    throw new ImportError(`The song is longer than ${IMPORT_LIMITS.measures} bars.`, 'gp')
  }
  const meta: MeasureMetaInfo[] = []
  const barIds: string[][] = []
  nodes.forEach((node, index) => {
    const [numerator, denominator] = (text(node, 'Time') ?? '4/4').split('/').map((part) => int(part, 4))
    const previous = meta[index - 1]
    const bar = Song.defaultMeasureMeta()
    bar.numerator = numerator > 0 && numerator <= 32 ? numerator : 4
    bar.denominator = [1, 2, 4, 8, 16, 32].includes(denominator) ? denominator : 4
    bar.timeMeterPresent =
      previous == null || previous.numerator !== bar.numerator || previous.denominator !== bar.denominator
    bar.keySignature = int(text(child(node, 'Key'), 'AccidentalCount'), 0)

    const repeat = child(node, 'Repeat')
    bar.repeatOpen = repeat?.getAttribute('start') === 'true'
    if (repeat?.getAttribute('end') === 'true') {
      // GPIF counts plays; the app counts repeats.
      bar.repeatClose = Math.max(1, int(repeat.getAttribute('count'), 2) - 1)
    }
    const endings = idList(text(node, 'AlternateEndings'))
      .map((value) => int(value, 0))
      .filter((pass) => pass >= 1 && pass <= 8)
    if (endings.length > 0)
      bar.repeatAlternative = endings.reduce((mask, pass) => mask | (1 << (pass - 1)), 0)

    const section = child(node, 'Section')
    const sectionText = text(section, 'Text') || text(section, 'Letter')
    if (sectionText) bar.marker = { text: sectionText, color: { red: 255, green: 0, blue: 0 } }

    meta.push(bar)
    barIds.push(idList(text(node, 'Bars')))
  })
  return { meta, barIds }
}

/** Quarter-note BPM of a tempo automation's "<value> <unit>". */
function tempoBpm(automation: Element): number {
  const [value, unit] = idList(text(automation, 'Value'))
  return Math.round((float(value) ?? 0) * (TEMPO_UNIT_TO_QUARTERS[int(unit, 2)] ?? 1))
}

/** Tempo automations of the master track; the first change in a bar wins. Returns the start tempo. */
function applyTempos(gpif: Element, meta: MeasureMetaInfo[]): number {
  const automations = child(child(gpif, 'MasterTrack'), 'Automations')
  for (const automation of childElements(automations, 'Automation')) {
    if (text(automation, 'Type') !== 'Tempo') continue
    const bar = int(text(automation, 'Bar'), -1)
    const bpm = tempoBpm(automation)
    if (bar >= 0 && bar < meta.length && bpm > 0 && meta[bar].bpm == null) meta[bar].bpm = bpm
  }
  meta[0].bpm = meta[0].bpm ?? 120
  return meta[0].bpm
}

// ---------------------------------------------------------------------------
// Rhythms, beats, notes

function readRhythms(gpif: Element): Map<string, Rhythm> {
  const rhythms = new Map<string, Rhythm>()
  for (const [id, node] of byId(gpif, 'Rhythms', 'Rhythm')) {
    const tuplet = child(node, 'PrimaryTuplet')
    const num = tuplet ? int(tuplet.getAttribute('num'), 0) : 0
    rhythms.set(id, {
      duration: NOTE_VALUES[text(node, 'NoteValue') ?? ''] ?? 'q',
      dots: int(child(node, 'AugmentationDot')?.getAttribute('count'), 0),
      tuplet: num > 1 ? num : null,
    })
  }
  return rhythms
}

/** A bend or whammy curve from GPIF's origin / middle / destination points. */
function readCurve(
  props: Map<string, Element>,
  prefix: string,
  scale: (value: number) => number,
): { position: number; value: number }[] {
  const value = (name: string) => float(text(props.get(`${prefix}${name}`), 'Float'))
  const offset = (name: string, fallback: number) => {
    const raw = value(name)
    return Math.round((raw ?? fallback) * CURVE_POSITION_SCALE)
  }
  const origin = value('OriginValue') ?? 0
  const middle = value('MiddleValue')
  const destination = value('DestinationValue') ?? middle ?? origin
  const points = [{ position: 0, value: origin }]
  if (value('OriginOffset') != null) points.push({ position: offset('OriginOffset', 0), value: origin })
  if (middle != null) {
    points.push({ position: offset('MiddleOffset1', 50), value: middle })
    if (value('MiddleOffset2') != null) points.push({ position: offset('MiddleOffset2', 50), value: middle })
  }
  points.push({ position: offset('DestinationOffset', 100), value: destination })
  if (points[points.length - 1].position < CURVE_END) points.push({ position: CURVE_END, value: destination })
  // Keep positions increasing; GP files sometimes repeat an offset.
  return points
    .filter((point, i) => i === 0 || point.position > points[i - 1].position)
    .map((point) => ({ position: Math.min(CURVE_END, point.position), value: scale(point.value) }))
}

function readBeat(node: Element, rhythms: Map<string, Rhythm>): GpifBeat {
  const props = properties(node)
  const rhythm = rhythms.get(child(node, 'Rhythm')?.getAttribute('ref') ?? '') ?? {
    duration: 'q',
    dots: 0,
    tuplet: null,
  }
  const graceText = text(node, 'GraceNotes')
  const direction = text(props.get('Brush'), 'Direction')
  const whammy = props.get('WhammyBar') != null && child(props.get('WhammyBar'), 'Enable') != null
  return {
    rhythm,
    noteIds: idList(text(node, 'Notes')),
    dynamic: text(node, 'Dynamic')?.toLowerCase() ?? null,
    grace: graceText == null ? null : graceText === 'OnBeat' ? 'with' : 'before',
    chordId: text(node, 'Chord'),
    text: text(node, 'FreeText'),
    tremoloPicking: TREMOLO_PICKING[text(node, 'Tremolo') ?? ''] ?? null,
    fadeIn: text(node, 'Fadding') === 'FadeIn',
    slap: child(props.get('Slapped'), 'Enable') != null,
    pop: child(props.get('Popped'), 'Enable') != null,
    stroke:
      direction === 'Up' || direction === 'Down'
        ? { strokeType: direction === 'Up' ? 'up' : 'down', strokeLength: 16 }
        : null,
    tremoloBar: whammy
      ? readCurve(props, 'WhammyBar', (value) => Math.max(-800, Math.min(400, Math.round(value)))).map(
          (point) => ({ ...point, vibrato: 0 }),
        )
      : null,
  }
}

function concertPitch(props: Map<string, Element>): number | null {
  const midi = text(props.get('Midi'), 'Number')
  if (midi != null) return int(midi, 0)
  const step = text(props.get('Tone'), 'Step')
  const octave = text(props.get('Octave'), 'Number')
  if (step != null && octave != null) return int(octave, 0) * 12 + int(step, 0)
  const pitch = child(props.get('ConcertPitch'), 'Pitch')
  if (pitch != null) {
    const steps: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
    const accidentals: Record<string, number> = { '#': 1, '##': 2, b: -1, bb: -2 }
    const base = steps[text(pitch, 'Step') ?? ''] ?? 0
    return (
      (int(text(pitch, 'Octave'), 4) + 1) * 12 + base + (accidentals[text(pitch, 'Accidental') ?? ''] ?? 0)
    )
  }
  return null
}

function readNote(node: Element): GpifNote {
  const props = properties(node)
  const enabled = (name: string) => child(props.get(name), 'Enable') != null
  const accent = int(text(node, 'Accent'), 0)
  const stringText = text(props.get('String'), 'String')
  const fretText = text(props.get('Fret'), 'Fret')
  const note: Note = {
    ...Song.defaultNote(),
    string: int(stringText, 0),
    fret: int(fretText, 0),
    tied: child(node, 'Tie')?.getAttribute('destination') === 'true',
    letRing: child(node, 'LetRing') != null,
    ghost: text(node, 'AntiAccent') != null,
    stacatto: (accent & 0x01) !== 0,
    heavyAccentuated: (accent & 0x04) !== 0,
    accentuated: (accent & 0x08) !== 0,
    vibrato: child(node, 'Vibrato') != null,
    dead: enabled('Muted'),
    palmMute: enabled('PalmMuted'),
    tap: enabled('Tapped'),
    slide: props.has('Slide'),
    pullDown: enabled('HopoOrigin'),
  }
  const harmonic = HARMONICS[text(props.get('HarmonicType'), 'HType') ?? '']
  if (harmonic) note.artificialStyle = harmonic
  if (enabled('Bended')) {
    // GPIF bend values are the same scale as GP3–5: 100 = one whole tone.
    const bend: Bend = readCurve(props, 'Bend', (value) => Math.round(value)).map((point) => ({
      bendPosition: point.position,
      bendValue: point.value,
      vibrato: 0,
    }))
    note.bendObj = bend
  }
  const trill = text(node, 'Trill')
  const element = text(props.get('Element'), 'Element')
  if (element != null) {
    note.element = int(element, 0)
    const variation = int(text(props.get('Variation'), 'Variation'), 0)
    const midi = GP6_DRUM_ELEMENTS[note.element]
    if (midi) note.fret = midi[Math.min(variation, midi.length - 1)]
  }
  const articulation = text(node, 'InstrumentArticulation')
  const fretted = stringText != null && fretText != null
  return {
    note,
    pitch: fretted || element != null ? null : concertPitch(props),
    trillPitch: trill == null ? null : int(trill, -1),
    drumArticulation: articulation == null ? null : int(articulation, 0),
  }
}

// ---------------------------------------------------------------------------
// Assembling beats per staff

function durationOf(
  rhythm: Rhythm,
  hasNotes: boolean,
): Pick<Beat, 'duration' | 'dotted' | 'doubleDotted' | 'tuplet'> {
  return {
    duration: hasNotes ? rhythm.duration : `${rhythm.duration}r`,
    dotted: rhythm.dots === 1,
    doubleDotted: rhythm.dots >= 2,
    tuplet: rhythm.tuplet,
  }
}

interface BuildContext {
  beats: Map<string, GpifBeat>
  notes: Map<string, GpifNote>
  staff: Staff
  /** Last dynamic per voice, so the marking is only drawn where it changes. */
  lastDynamic: string[]
}

/** Drums store the MIDI note as the fret. */
function drumMidi(gpNote: GpifNote, staff: Staff): number {
  const fromArticulation =
    gpNote.drumArticulation != null ? staff.drumArticulations[gpNote.drumArticulation] : undefined
  return fromArticulation ?? gpNote.pitch ?? gpNote.note.fret
}

/**
 * Notes given only as pitches (piano, keyboard): highest first, each on the free string
 * with the lowest playable fret. What doesn't fit is dropped from the tab.
 */
function placePitches(
  unplaced: { note: Note; pitch: number }[],
  placed: (Note | null)[],
  staff: Staff,
): void {
  const fretOn = (pitch: number, string: number) => pitch - staff.capo - staff.tuning[string]
  for (const { note, pitch } of [...unplaced].sort((a, b) => b.pitch - a.pitch)) {
    let best = -1
    for (let string = 0; string < staff.tuning.length; string += 1) {
      const fret = fretOn(pitch, string)
      if (placed[string] != null || fret < 0 || fret > MAX_FRET) continue
      if (best === -1 || fret < fretOn(pitch, best)) best = string
    }
    if (best !== -1) placed[best] = { ...note, string: best, fret: fretOn(pitch, best) }
  }
}

function placeNotes(gpBeat: GpifBeat, context: BuildContext): (Note | null)[] {
  const { staff } = context
  const placed: (Note | null)[] = new Array(staff.tuning.length).fill(null)
  const unplaced: { note: Note; pitch: number }[] = []
  const drums: Note[] = []
  for (const id of gpBeat.noteIds) {
    const gpNote = context.notes.get(id)
    if (gpNote == null) continue
    const note: Note = { ...gpNote.note }
    if (gpBeat.tremoloPicking) {
      note.tremoloPicking = true
      note.tremoloPickingLength = gpBeat.tremoloPicking
    }
    if (staff.isDrums) {
      drums.push({ ...note, fret: drumMidi(gpNote, staff) })
    } else if (gpNote.pitch != null) {
      unplaced.push({ note, pitch: gpNote.pitch })
    } else if (note.string >= 0 && note.string < placed.length && placed[note.string] == null) {
      const trillFret = (gpNote.trillPitch ?? -1) - staff.tuning[note.string] - staff.capo
      if (gpNote.trillPitch != null && trillFret >= 0) note.trill = { fret: trillFret, period: 1 }
      placed[note.string] = note
    }
  }
  // Each drum on its own line (kick at the bottom, cymbals on top), as the demo song lays them out.
  assignDrumLines(
    drums.map((note) => note.fret),
    placed.length,
  ).forEach((line, i) => {
    if (line >= 0) placed[line] = { ...drums[i], string: line }
  })
  placePitches(unplaced, placed, staff)
  return placed
}

function graceFrom(note: Note, duration: string, setOnBeat: string): Grace {
  return {
    fret: note.fret,
    string: note.string,
    height: 0,
    dynamic: 'mf',
    transition: 'none',
    duration,
    setOnBeat,
    dead: note.dead,
  }
}

function buildVoice(beatIds: string[], voiceIndex: number, context: BuildContext): Beat[] {
  if (beatIds.length > IMPORT_LIMITS.beatsPerVoice) {
    throw new ImportError(`A bar has more than ${IMPORT_LIMITS.beatsPerVoice} beats.`, 'gp')
  }
  const out: Beat[] = []
  let pendingGrace: { notes: (Note | null)[]; duration: string; setOnBeat: string } | null = null
  for (const id of beatIds) {
    const gpBeat = context.beats.get(id)
    if (gpBeat == null) continue
    const notes = placeNotes(gpBeat, context)
    if (gpBeat.grace != null) {
      pendingGrace = { notes, duration: gpBeat.rhythm.duration, setOnBeat: gpBeat.grace }
      continue
    }
    const beat = Song.defaultMeasure()
    const hasNotes = notes.some((note) => note != null)
    Object.assign(beat, durationOf(gpBeat.rhythm, hasNotes))
    beat.notes = notes
    if (pendingGrace) {
      pendingGrace.notes.forEach((grace, string) => {
        const target = notes[string]
        if (grace != null && target != null)
          target.graceObj = graceFrom(grace, pendingGrace!.duration, pendingGrace!.setOnBeat)
      })
      pendingGrace = null
    }
    if (gpBeat.dynamic) {
      beat.dynamic = gpBeat.dynamic
      beat.dynamicPresent = gpBeat.dynamic !== context.lastDynamic[voiceIndex]
      context.lastDynamic[voiceIndex] = gpBeat.dynamic
    } else {
      beat.dynamic = context.lastDynamic[voiceIndex]
    }
    if (gpBeat.text) beat.text = gpBeat.text
    const chord = gpBeat.chordId != null ? context.staff.chordsById.get(gpBeat.chordId) : undefined
    if (chord) beat.chord = { ...chord, frets: [...chord.frets], fingers: [...chord.fingers] }
    beat.effects.fadeIn = gpBeat.fadeIn
    beat.effects.slap = gpBeat.slap
    beat.effects.pop = gpBeat.pop
    if (gpBeat.stroke) beat.effects.stroke = gpBeat.stroke
    if (gpBeat.tremoloBar) beat.effects.tremoloBar = gpBeat.tremoloBar
    out.push(beat)
  }
  return out
}

/** A voice the app fills with rests on load (`writeNoteInfoToBeat`). */
function emptyVoice(stringCount: number): Beat[] {
  const beat = Song.defaultMeasure()
  beat.duration = 'wr'
  beat.notes = new Array(stringCount).fill(null)
  beat.empty = true
  return [beat]
}

// ---------------------------------------------------------------------------

/** Parses GPIF XML into song data without touching the current song. */
export function parseGpif(xml: string, format: string): GpifSong {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const gpif = doc.documentElement
  if (doc.getElementsByTagName('parsererror').length > 0 || gpif?.tagName !== 'GPIF') {
    throw new ImportError('The score data is not valid GPIF XML.', format)
  }

  const trackNodes = childElements(child(gpif, 'Tracks'), 'Track')
  const staves = trackNodes.flatMap(readStaves)
  if (staves.length === 0) throw new ImportError('The file contains no tracks.', format)
  if (staves.length > IMPORT_LIMITS.tracks)
    throw new ImportError(`Too many tracks (${staves.length}).`, format)

  const { meta, barIds } = readMasterBars(gpif)
  if (meta.length === 0) throw new ImportError('The file contains no bars.', format)
  const bpm = applyTempos(gpif, meta)

  const bars = byId(gpif, 'Bars', 'Bar')
  const voices = byId(gpif, 'Voices', 'Voice')
  const rhythms = readRhythms(gpif)
  const beats = new Map<string, GpifBeat>()
  for (const [id, node] of byId(gpif, 'Beats', 'Beat')) beats.set(id, readBeat(node, rhythms))
  const notes = new Map<string, GpifNote>()
  for (const [id, node] of byId(gpif, 'Notes', 'Note')) notes.set(id, readNote(node))

  const measures: Beat[][][][] = staves.map((staff) => {
    const context: BuildContext = { beats, notes, staff, lastDynamic: new Array(MAX_VOICES).fill('mf') }
    const staffIndex = staves.indexOf(staff)
    return meta.map((_, barIndex) => {
      const bar = bars.get(barIds[barIndex][staffIndex] ?? '')
      const voiceIds = idList(text(bar, 'Voices'))
      const block: Beat[][] = []
      for (let v = 0; v < MAX_VOICES; v += 1) {
        const voice = voices.get(voiceIds[v] ?? '-1')
        const built = voice ? buildVoice(idList(text(voice, 'Beats')), v, context) : []
        block.push(built.length > 0 ? built : emptyVoice(staff.tuning.length))
      }
      return block
    })
  })

  return {
    description: readDescription(child(gpif, 'Score')),
    bpm,
    measureMeta: meta,
    tracks: staves.map(toTrack),
    chords: staves.map(
      (staff) => new Map([...staff.chordsById.values()].map((chord) => [chord.name, chord])),
    ),
    measures,
  }
}

/** Replaces the current song with a parsed GPIF score. */
export function applyGpifSong(song: GpifSong): void {
  Song.songDescription = song.description
  Song.measureMeta = song.measureMeta
  Song.numMeasures = song.measureMeta.length
  Song.tracks = song.tracks
  Song.chordsMap = song.chords
  for (const track of song.tracks) {
    const channel = Song.allChannels[track.channel.index]
    if (channel) channel.cInstrument = track.program
  }
  Song.measures = song.measures
  Song.setTempo(song.bpm)
}
