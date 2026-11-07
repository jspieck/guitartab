import { unzipSync } from 'fflate'
import Song from '../stores/song'
import type {
  Beat,
  Chord,
  DirectionJump,
  DirectionTarget,
  MeasureMetaInfo,
  Note,
  SongDescription,
  Track,
} from '../types/song'
import type { NoteLengthCode } from '../types/tab'
import { CHORD_KIND_SUFFIXES, chordNameOf } from '../utils/chordSymbols'
import { DIRECTION_LABELS, isDirectionJump, isDirectionTarget } from '../utils/directions'
import { assignDrumLines } from '../utils/drumLines'
import { MAX_LYRIC_VERSES, setBeatLyric } from '../utils/lyrics'
import type { GpifSong } from './gpifImport'
import { IMPORT_LIMITS, ImportError } from './importErrors'
import { warnImport } from './importWarnings'
import { shortenPickupBar } from './import/pickupBar'
import { arrangeOnStrings } from './midi/noteArranger'
import { setClefFrom, type Clef } from '../utils/clefs'

/**
 * Reads MusicXML (score-partwise, plain `.musicxml`/`.xml` or compressed `.mxl`) into song
 * data, the same shape the GPIF importer applies (`applyGpifSong`). One track per part.
 * Notes keep their `<string>`/`<fret>` when the file has them (tab staves, our own export);
 * otherwise they are placed on the strings like MIDI keyboard input (`arrangeOnStrings`),
 * an octave further in when they don't fit. Pure apart from the default-object helpers on
 * `Song`; loaded on demand (`songImport.importSongFile`).
 */

const DRUM_CHANNEL = 9
const CHANNEL_COUNT = 64
const MAX_VOICES = 2
const MAX_FRET = 24
const GUITAR_TUNING = [40, 45, 50, 55, 59, 64]
const BASS_TUNING = [28, 33, 38, 43]
const EPSILON = 1e-6

const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const NOTE_TYPES: Record<string, { code: NoteLengthCode; quarters: number }> = {
  maxima: { code: 'w', quarters: 4 },
  long: { code: 'w', quarters: 4 },
  breve: { code: 'w', quarters: 4 },
  whole: { code: 'w', quarters: 4 },
  half: { code: 'h', quarters: 2 },
  quarter: { code: 'q', quarters: 1 },
  eighth: { code: 'e', quarters: 1 / 2 },
  '16th': { code: 's', quarters: 1 / 4 },
  '32nd': { code: 't', quarters: 1 / 8 },
  '64th': { code: 'z', quarters: 1 / 16 },
  '128th': { code: 'o', quarters: 1 / 32 },
}
/** Plain and dotted note values, longest first, for lengths without a usable `<type>`. */
const SPLIT_VALUES: { code: NoteLengthCode; dotted: boolean; quarters: number }[] = [
  { code: 'w', dotted: false, quarters: 4 },
  { code: 'h', dotted: true, quarters: 3 },
  { code: 'h', dotted: false, quarters: 2 },
  { code: 'q', dotted: true, quarters: 1.5 },
  { code: 'q', dotted: false, quarters: 1 },
  { code: 'e', dotted: true, quarters: 0.75 },
  { code: 'e', dotted: false, quarters: 0.5 },
  { code: 's', dotted: true, quarters: 0.375 },
  { code: 's', dotted: false, quarters: 0.25 },
  { code: 't', dotted: false, quarters: 0.125 },
  { code: 'z', dotted: false, quarters: 0.0625 },
]
const DYNAMICS = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']
const TREMOLO_LENGTHS: Record<number, string> = { 1: 'e', 2: 's', 3: 't' }
const BEAT_UNIT_QUARTERS: Record<string, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
}

// ---------------------------------------------------------------------------
// XML helpers

function children(node: Element | null | undefined, name?: string): Element[] {
  if (node == null) return []
  return Array.from(node.children).filter((element) => name == null || element.tagName === name)
}

function child(node: Element | null | undefined, name: string): Element | null {
  return children(node, name)[0] ?? null
}

function text(node: Element | null | undefined, name: string): string | null {
  const found = child(node, name)
  return found == null ? null : (found.textContent ?? '').trim()
}

function num(value: string | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function pitchOf(
  node: Element | null,
  stepName: string,
  alterName: string,
  octaveName: string,
): number | null {
  const step = STEPS[text(node, stepName) ?? '']
  const octave = num(text(node, octaveName))
  if (step == null || octave == null) return null
  return (octave + 1) * 12 + step + Math.round(num(text(node, alterName)) ?? 0)
}

// ---------------------------------------------------------------------------
// Files

/** The score inside an `.mxl` archive: the root file named in META-INF/container.xml. */
export function extractMxl(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new ImportError('This is not a valid .mxl (compressed MusicXML) file.', 'mxl')
  }
  const container = files['META-INF/container.xml']
  // The first <rootfile> is the score; a tiny file, so no XML parser needed.
  const named =
    container != null
      ? /<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/.exec(decodeXmlBytes(container))
      : null
  const rootPath =
    named?.[1] ??
    Object.keys(files).find((name) => !name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(name))
  const root = rootPath != null ? files[rootPath] : undefined
  if (root == null) throw new ImportError('The .mxl file contains no score.', 'mxl')
  return decodeXmlBytes(root)
}

/** MusicXML text from file bytes: UTF-8, or UTF-16 with a byte-order mark. */
export function decodeXmlBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  return new TextDecoder('utf-8').decode(bytes)
}

/** Parses `.musicxml`, `.xml` or `.mxl` bytes without touching the current song. */
export function parseMusicXmlBytes(bytes: Uint8Array, format: string): GpifSong {
  return parseMusicXml(format === 'mxl' ? extractMxl(bytes) : decodeXmlBytes(bytes), format)
}

// ---------------------------------------------------------------------------
// What a part holds before it becomes tab

interface PartInfo {
  name: string
  program: number
  channel: number
  /** midi-unpitched (0-based) per score-instrument id, for drum notes */
  unpitched: Map<string, number>
}

interface RawNote {
  /** sounding MIDI pitch (drums: the drum note), null when unknown */
  pitch: number | null
  /** MusicXML string number (1 = highest) and fret, when the file gives them */
  string: number | null
  fret: number | null
  tieStop: boolean
  note: Note
}

interface RawGrace {
  pitch: number | null
  string: number | null
  fret: number | null
  slash: boolean
  type: string
  dead: boolean
}

interface RawBeat {
  start: number
  quarters: number
  rest: boolean
  type: string | null
  dots: number
  tuplet: { actual: number; normal: number } | null
  notes: RawNote[]
  /** grace notes written before this beat in its voice */
  graces: RawGrace[]
  lyrics: { verse: string; text: string }[]
  stroke: 'up' | 'down' | null
  slash: boolean
}

interface BeatMark {
  at: number
  text?: string
  dynamic?: string
  chord?: string
}

interface RawMeasure {
  /** voice id → beats in time order */
  voices: Map<string, RawBeat[]>
  marks: BeatMark[]
}

interface PartAttributes {
  tuning: number[] | null
  capo: number
  drums: boolean
  /** semitones from written to sounding pitch (`<transpose>`) */
  transpose: number
  /** clef per bar where a `<clef>` of the part's first staff is given */
  clefs: Record<number, Clef>
}

// ---------------------------------------------------------------------------
// Score header

function readDescription(root: Element): SongDescription {
  const description: SongDescription = {
    title: '',
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
  const identification = child(root, 'identification')
  const creator = (type: string) =>
    children(identification, 'creator')
      .find((node) => node.getAttribute('type') === type)
      ?.textContent?.trim() ?? ''
  const credit = (type: string) =>
    children(root, 'credit')
      .find((node) => text(node, 'credit-type') === type)
      ?.getElementsByTagName('credit-words')[0]
      ?.textContent?.trim() ?? ''
  description.title =
    text(child(root, 'work'), 'work-title') || text(root, 'movement-title') || credit('title') || ''
  description.subtitle =
    (text(child(root, 'work'), 'work-title') ? text(root, 'movement-title') : '') || credit('subtitle') || ''
  description.artist = creator('composer') || credit('composer')
  description.writer = creator('lyricist') || credit('lyricist')
  description.author = creator('arranger') || credit('arranger')
  description.copyright = text(identification, 'rights') || credit('rights')
  return description
}

function readPartList(root: Element): Map<string, PartInfo> {
  const parts = new Map<string, PartInfo>()
  for (const scorePart of children(child(root, 'part-list'), 'score-part')) {
    const instruments = children(scorePart, 'midi-instrument')
    const unpitched = new Map<string, number>()
    for (const instrument of instruments) {
      const value = num(text(instrument, 'midi-unpitched'))
      if (value != null) unpitched.set(instrument.getAttribute('id') ?? '', value - 1)
    }
    const first = instruments[0]
    parts.set(scorePart.getAttribute('id') ?? '', {
      name: text(scorePart, 'part-name') || text(scorePart, 'part-abbreviation') || '',
      program: Math.max(0, (num(text(first, 'midi-program')) ?? 1) - 1),
      channel: (num(text(first, 'midi-channel')) ?? 0) - 1,
      unpitched,
    })
  }
  return parts
}

// ---------------------------------------------------------------------------
// Bar metadata (shared by all parts; the first part that has a marking sets it)

interface MetaState {
  meta: MeasureMetaInfo[]
  /** set per bar by the first part only, so repeat and ending signs aren't counted twice */
  ending: number | null
}

function metaAt(state: MetaState, index: number): MeasureMetaInfo {
  while (state.meta.length <= index) {
    const bar = Song.defaultMeasureMeta()
    bar.keySignature = 0
    bar.timeMeterPresent = false
    state.meta.push(bar)
  }
  return state.meta[index]
}

function endingMask(numbers: string): number {
  let mask = 0
  for (const part of numbers.split(/[\s,]+/)) {
    const range = /^(\d+)(?:-(\d+))?$/.exec(part)
    if (range == null) continue
    const from = Number(range[1])
    const to = Number(range[2] ?? range[1])
    for (let pass = from; pass <= to && pass <= 8; pass += 1) if (pass >= 1) mask |= 1 << (pass - 1)
  }
  return mask
}

function readBarline(barline: Element, bar: MeasureMetaInfo, state: MetaState): void {
  const repeat = child(barline, 'repeat')
  if (repeat?.getAttribute('direction') === 'forward') bar.repeatOpen = true
  if (repeat?.getAttribute('direction') === 'backward') {
    // MusicXML counts plays; the app counts repeats.
    bar.repeatClose = Math.max(1, (num(repeat.getAttribute('times')) ?? 2) - 1)
  }
  const ending = child(barline, 'ending')
  if (ending == null) return
  const type = ending.getAttribute('type')
  if (type === 'start') {
    const mask = endingMask(ending.getAttribute('number') ?? '')
    state.ending = mask > 0 ? mask : null
    if (state.ending != null) bar.repeatAlternative = state.ending
  } else if (type === 'stop' || type === 'discontinue') {
    const mask = endingMask(ending.getAttribute('number') ?? '')
    if (mask > 0) bar.repeatAlternative = mask
    state.ending = null
  }
}

function addTarget(bar: MeasureMetaInfo, target: DirectionTarget): void {
  if (!(bar.directionTargets ?? []).includes(target))
    bar.directionTargets = [...(bar.directionTargets ?? []), target]
}

function addJump(bar: MeasureMetaInfo, jump: DirectionJump): void {
  if (!(bar.directionJumps ?? []).includes(jump)) bar.directionJumps = [...(bar.directionJumps ?? []), jump]
}

const LABEL_TO_SIGN = new Map(
  Object.entries(DIRECTION_LABELS).map(([sign, label]) => [label.toLowerCase(), sign]),
)

/** "D.S. al Coda" etc. as words; returns true when the words were a navigation sign. */
function readSignWords(words: string, bar: MeasureMetaInfo): boolean {
  const sign = LABEL_TO_SIGN.get(words.trim().toLowerCase())
  if (sign == null) return false
  if (isDirectionTarget(sign)) addTarget(bar, sign)
  else if (isDirectionJump(sign)) addJump(bar, sign)
  return true
}

/** "al Coda" / "al Fine" from the words that go with a D.C./D.S. */
function jumpSuffix(words: string): string {
  const lower = words.toLowerCase()
  if (lower.includes('double coda')) return 'AlDoubleCoda'
  if (lower.includes('coda')) return 'AlCoda'
  return lower.includes('fine') ? 'AlFine' : ''
}

/** Playback attributes of `<sound>`: segno/coda targets, D.C./D.S./To Coda jumps, Fine, tempo. */
function readSound(sound: Element, words: string, bar: MeasureMetaInfo): void {
  const attribute = (name: string) => sound.getAttribute(name)?.toLowerCase() ?? null
  const tempo = num(attribute('tempo'))
  if (tempo != null && tempo > 0) bar.bpm ??= Math.round(tempo)
  const segno = attribute('segno')
  if (segno != null) addTarget(bar, segno.includes('segnosegno') ? 'SegnoSegno' : 'Segno')
  const coda = attribute('coda')
  if (coda != null) addTarget(bar, coda.includes('double') ? 'DoubleCoda' : 'Coda')
  if (attribute('fine') != null) addTarget(bar, 'Fine')
  const after = jumpSuffix(words)
  if (attribute('dacapo') === 'yes') addJump(bar, `DaCapo${after}` as DirectionJump)
  const dalsegno = attribute('dalsegno')
  if (dalsegno != null)
    addJump(bar, `${dalsegno.includes('segnosegno') ? 'DaSegnoSegno' : 'DaSegno'}${after}` as DirectionJump)
  const tocoda = attribute('tocoda')
  if (tocoda != null) addJump(bar, tocoda.includes('double') ? 'DaDoubleCoda' : 'DaCoda')
}

function metronomeBpm(metronome: Element | null): number | null {
  const perMinute = num(text(metronome, 'per-minute'))
  if (metronome == null || perMinute == null) return null
  const unit = BEAT_UNIT_QUARTERS[text(metronome, 'beat-unit') ?? 'quarter'] ?? 1
  const dotted = child(metronome, 'beat-unit-dot') != null ? 1.5 : 1
  return Math.round(perMinute * unit * dotted)
}

function chordName(harmony: Element): string | null {
  const root = child(harmony, 'root')
  const step = text(root, 'root-step')
  if (step == null) return null
  const kind = child(harmony, 'kind')
  const bass = child(harmony, 'bass')
  const bassStep = text(bass, 'bass-step')
  return chordNameOf({
    root: step,
    rootAlter: Math.round(num(text(root, 'root-alter')) ?? 0),
    // The printed form wins; otherwise the app's suffix for the kind.
    suffix: kind?.getAttribute('text') ?? CHORD_KIND_SUFFIXES[kind?.textContent?.trim() ?? ''] ?? '',
    bass: bassStep ? { step: bassStep, alter: Math.round(num(text(bass, 'bass-alter')) ?? 0) } : null,
  })
}

/** Bar-level `<direction-type>` children (read in the first part only). */
const BAR_DIRECTIONS: Record<string, (element: Element, bar: MeasureMetaInfo) => void> = {
  rehearsal: (element, bar) => {
    const label = element.textContent?.trim()
    if (label) bar.marker ??= { text: label, color: { red: 255, green: 0, blue: 0 } }
  },
  segno: (_, bar) => addTarget(bar, 'Segno'),
  coda: (_, bar) => addTarget(bar, 'Coda'),
  metronome: (element, bar) => {
    const bpm = metronomeBpm(element)
    if (bpm != null && bpm > 0) bar.bpm ??= bpm
  },
}

// Words that are a sign with a <sound> (read from the sound) don't also become beat text.
const SIGN_WORDS = /^(d\.?\s?[cs]\.?|fine|to coda|coda|segno)/i

/** The `<direction-type>` children: dynamics to `marks`, bar markings to the bar; returns the words. */
function readDirectionTypes(
  node: Element,
  at: number,
  bar: MeasureMetaInfo,
  marks: BeatMark[],
  firstPart: boolean,
): string[] {
  const words: string[] = []
  for (const element of children(node, 'direction-type').flatMap((type) => children(type))) {
    if (element.tagName === 'words') {
      const phrase = (element.textContent ?? '').trim()
      if (phrase) words.push(phrase)
    } else if (element.tagName === 'dynamics') {
      const dynamic = children(element).find((mark) => DYNAMICS.includes(mark.tagName))?.tagName
      if (dynamic) marks.push({ at, dynamic })
    } else if (firstPart) BAR_DIRECTIONS[element.tagName]?.(element, bar)
  }
  return words
}

/** A `<direction>`: bar markings go to the bar (first part only), the rest to the beat at `at`. */
function readDirection(
  node: Element,
  at: number,
  bar: MeasureMetaInfo,
  marks: BeatMark[],
  firstPart: boolean,
): void {
  const words = readDirectionTypes(node, at, bar, marks, firstPart)
  const sound = child(node, 'sound')
  if (firstPart && sound != null) readSound(sound, words.join(' '), bar)
  for (const phrase of words) {
    if (firstPart && readSignWords(phrase, bar)) continue
    if (sound != null && SIGN_WORDS.test(phrase)) continue
    marks.push({ at, text: phrase })
  }
}

// ---------------------------------------------------------------------------
// Notes

interface NoteFlags {
  tieStop: boolean
  string: number | null
  fret: number | null
}

const isStart = (mark: Element) => mark.getAttribute('type') === 'start'

/** `<technical>` marks; string and fret go to `flags`, the rest onto the note. */
const TECHNICAL: Record<string, (mark: Element, note: Note, flags: NoteFlags) => void> = {
  string: (mark, _, flags) => (flags.string = num(mark.textContent)),
  fret: (mark, _, flags) => (flags.fret = num(mark.textContent)),
  'hammer-on': (mark, note) => (note.pullDown ||= isStart(mark)),
  'pull-off': (mark, note) => (note.pullDown ||= isStart(mark)),
  harmonic: (mark, note) => (note.artificialStyle = child(mark, 'artificial') != null ? 'A.H.' : 'N.H.'),
  tap: (_, note) => (note.tap = true),
  bend: (mark, note) => {
    // Semitones; the app stores 50 per semitone, positions 0–60 over the note.
    const value = Math.round((num(text(mark, 'bend-alter')) ?? 0) * 50)
    if (value === 0) return
    note.bendObj = [
      { bendPosition: 0, bendValue: 0, vibrato: 0 },
      { bendPosition: 30, bendValue: value, vibrato: 0 },
      { bendPosition: 60, bendValue: value, vibrato: 0 },
    ]
  },
}

const ARTICULATIONS: Record<string, (note: Note) => void> = {
  accent: (note) => (note.accentuated = true),
  'strong-accent': (note) => (note.heavyAccentuated = true),
  staccato: (note) => (note.stacatto = true),
  staccatissimo: (note) => (note.stacatto = true),
}

const ORNAMENTS: Record<string, (mark: Element, note: Note) => void> = {
  // The partner, as a step up, becomes a fret once the note is on a string (`placedNote`).
  'trill-mark': (mark, note) =>
    (note.trill = { fret: mark.getAttribute('trill-step') === 'whole' ? -2 : -1, period: 4 }),
  tremolo: (mark, note) => {
    const length = TREMOLO_LENGTHS[num(mark.textContent) ?? 0]
    if (length == null || mark.getAttribute('type') === 'start') return
    note.tremoloPicking = true
    note.tremoloPickingLength = length
  },
  'wavy-line': (mark, note) => (note.vibrato ||= isStart(mark) && note.trill == null),
}

/** `<notations>` children. */
const NOTATIONS: Record<string, (element: Element, note: Note, flags: NoteFlags) => void> = {
  tied: (element, _, flags) => (flags.tieStop ||= element.getAttribute('type') === 'stop'),
  slide: (element, note) => (note.slide ||= isStart(element)),
  glissando: (element, note) => (note.slide ||= isStart(element)),
  technical: (element, note, flags) => {
    for (const mark of children(element)) TECHNICAL[mark.tagName]?.(mark, note, flags)
  },
  articulations: (element, note) => {
    for (const mark of children(element)) ARTICULATIONS[mark.tagName]?.(note)
  },
  ornaments: (element, note) => {
    for (const mark of children(element)) ORNAMENTS[mark.tagName]?.(mark, note)
  },
}

function readNoteFlags(node: Element, note: Note): NoteFlags {
  const flags: NoteFlags = {
    tieStop: children(node, 'tie').some((tie) => tie.getAttribute('type') === 'stop'),
    string: null,
    fret: null,
  }
  const notehead = child(node, 'notehead')
  if (notehead?.textContent?.trim() === 'x') note.dead = true
  else if (notehead?.getAttribute('parentheses') === 'yes') note.ghost = true
  for (const element of children(node, 'notations').flatMap((notations) => children(notations)))
    NOTATIONS[element.tagName]?.(element, note, flags)
  return flags
}

function readPitch(node: Element, attributes: PartAttributes, part: PartInfo): number | null {
  if (attributes.drums || child(node, 'unpitched') != null) {
    const instrument = child(node, 'instrument')?.getAttribute('id')
    const mapped = instrument != null ? part.unpitched.get(instrument) : undefined
    if (mapped != null) return mapped
    if (child(node, 'pitch') == null)
      return pitchOf(child(node, 'unpitched'), 'display-step', 'display-alter', 'display-octave')
  }
  const written = pitchOf(child(node, 'pitch'), 'step', 'alter', 'octave')
  return written == null ? null : written + attributes.transpose
}

function strokeOf(node: Element): 'up' | 'down' | null {
  const arpeggiate = node.querySelector('notations > arpeggiate')
  if (arpeggiate == null) return null
  // A downward arpeggio in MusicXML sweeps from the top; the app calls that an up stroke.
  return arpeggiate.getAttribute('direction') === 'down' ? 'up' : 'down'
}

// ---------------------------------------------------------------------------
// One part

interface PartContext {
  info: PartInfo
  attributes: PartAttributes
  divisions: number
  firstPart: boolean
  state: MetaState
  /** the last time signature seen, to mark where it changes */
  meter: { numerator: number; denominator: number } | null
  /** the key in effect, carried on to bars without a `<key>` */
  key: { fifths: number; minor: boolean }
  /** inside a `<measure-style><slash>` region: every beat is a slash */
  slashStyle: boolean
}

function readTime(time: Element, bar: MeasureMetaInfo): void {
  // "3+2" is an additive meter of 5 beats.
  const numerator = (text(time, 'beats') ?? '4').split('+').reduce((sum, part) => sum + (num(part) ?? 0), 0)
  const denominator = num(text(time, 'beat-type')) ?? 4
  if (numerator > 0 && numerator <= 32 && [1, 2, 4, 8, 16, 32].includes(denominator)) {
    bar.numerator = numerator
    bar.denominator = denominator
  }
}

/** Tuning (lowest line first, as the app counts strings) and capo; the first ones in a part count. */
function readStaffDetails(details: Element, attributes: PartAttributes): void {
  if (attributes.tuning != null) return
  const lines = children(details, 'staff-tuning')
    .map((tuning) => ({
      line: num(tuning.getAttribute('line')) ?? 0,
      pitch: pitchOf(tuning, 'tuning-step', 'tuning-alter', 'tuning-octave'),
    }))
    .filter((entry): entry is { line: number; pitch: number } => entry.pitch != null)
    .sort((a, b) => a.line - b.line)
  if (lines.length > 0 && lines.length <= IMPORT_LIMITS.strings)
    attributes.tuning = lines.map((entry) => entry.pitch)
  const capo = num(text(details, 'capo'))
  if (capo != null && capo >= 0) attributes.capo = capo
}

/**
 * MusicXML `<clef>` → clef. Guitar parts are written with `clef-octave-change` −1 under a G
 * clef, which is how we write the plain treble clef too, so only the sign and line decide.
 */
function clefFromMusicXml(sign: string | null, line: string | null): Clef | null {
  const lineNumber = line == null ? null : Number(line)
  if (sign === 'G' && (lineNumber == null || lineNumber === 2)) return 'treble'
  if (sign === 'F' && (lineNumber == null || lineNumber === 4)) return 'bass'
  if (sign === 'C' && (lineNumber == null || lineNumber === 3)) return 'alto'
  if (sign === 'C' && lineNumber === 4) return 'tenor'
  return null
}

/** Clefs of the part's first staff (a second staff is usually its TAB staff). */
function readClefs(node: Element, context: PartContext, barIndex: number): void {
  for (const clefNode of children(node, 'clef')) {
    const number = clefNode.getAttribute('number')
    if (number != null && number !== '1') continue
    const sign = text(clefNode, 'sign')
    if (sign === 'percussion') context.attributes.drums = true
    const clef = clefFromMusicXml(sign, text(clefNode, 'line'))
    if (clef != null) context.attributes.clefs[barIndex] = clef
  }
  const slash = child(child(node, 'measure-style'), 'slash')
  if (slash != null) context.slashStyle = slash.getAttribute('type') === 'start'
}

function readAttributes(node: Element, context: PartContext, bar: MeasureMetaInfo, barIndex: number): void {
  const divisions = num(text(node, 'divisions'))
  if (divisions != null && divisions > 0) context.divisions = divisions
  const time = child(node, 'time')
  const fifths = num(text(child(node, 'key'), 'fifths'))
  if (context.firstPart && time != null) readTime(time, bar)
  if (context.firstPart && fifths != null) {
    bar.keySignature = Math.max(-7, Math.min(7, Math.round(fifths)))
    context.key = { fifths: bar.keySignature, minor: text(child(node, 'key'), 'mode') === 'minor' }
  }
  readClefs(node, context, barIndex)
  const transpose = child(node, 'transpose')
  if (transpose != null)
    context.attributes.transpose =
      (num(text(transpose, 'chromatic')) ?? 0) + 12 * (num(text(transpose, 'octave-change')) ?? 0)
  const details = child(node, 'staff-details')
  if (details != null) readStaffDetails(details, context.attributes)
}

interface MeasurePosition {
  at: number
  /** the last beat started per voice, which `<chord/>` notes join */
  last: Map<string, RawBeat>
  /** grace notes per voice, waiting for the beat they lead into */
  graces: Map<string, RawGrace[]>
}

function readLyrics(node: Element): RawBeat['lyrics'] {
  return children(node, 'lyric').flatMap((lyric) => {
    const syllable = text(lyric, 'text')
    if (!syllable) return []
    const syllabic = text(lyric, 'syllabic') ?? 'single'
    // The app marks a syllable that continues its word with a trailing hyphen.
    const joined = syllabic === 'begin' || syllabic === 'middle' ? `${syllable}-` : syllable
    return [{ verse: lyric.getAttribute('number') ?? '1', text: joined }]
  })
}

function readTuplet(node: Element): RawBeat['tuplet'] {
  const modification = child(node, 'time-modification')
  if (modification == null) return null
  return {
    actual: num(text(modification, 'actual-notes')) ?? 1,
    normal: num(text(modification, 'normal-notes')) ?? 1,
  }
}

function readGrace(node: Element, pitch: number | null, flags: NoteFlags, note: Note): RawGrace {
  return {
    pitch,
    string: flags.string,
    fret: flags.fret,
    slash: child(node, 'grace')?.getAttribute('slash') === 'yes',
    type: text(node, 'type') ?? '16th',
    dead: note.dead,
  }
}

/** A grace note waits for the beat it leads into; a `<chord/>` note joins the voice's last beat. */
function addToVoice(node: Element, voice: string, raw: RawNote, position: MeasurePosition): void {
  if (child(node, 'grace') != null) {
    const grace = readGrace(node, raw.pitch, raw, raw.note)
    position.graces.set(voice, [...(position.graces.get(voice) ?? []), grace])
  } else {
    position.last.get(voice)?.notes.push(raw)
  }
}

/**
 * Slash notation: a `slash` note head or a `<measure-style>` slash region. A rhythm slash has a
 * placeholder pitch, not a note (`slashOnly`); our slashed notes keep their string and fret.
 */
function slashOf(
  node: Element,
  context: PartContext,
  isRest: boolean,
  flags: { fret: number | null },
): { slash: boolean; slashOnly: boolean } {
  const slash = context.slashStyle || text(node, 'notehead') === 'slash'
  return { slash, slashOnly: slash && !isRest && flags.fret == null }
}

function readNote(node: Element, context: PartContext, measure: RawMeasure, position: MeasurePosition): void {
  const voice = text(node, 'voice') || '1'
  const isRest = child(node, 'rest') != null
  const isCue = child(node, 'cue') != null
  const pitch = isRest ? null : readPitch(node, context.attributes, context.info)
  const note = Song.defaultNote()
  const flags = readNoteFlags(node, note)
  const { slash, slashOnly } = slashOf(node, context, isRest, flags)
  // a rest, or a rhythm slash: takes time, plays nothing
  const silent = isRest || slashOnly

  if (child(node, 'grace') != null || child(node, 'chord') != null) {
    if (!silent && !isCue) addToVoice(node, voice, { pitch, ...flags, note }, position)
    return
  }
  const start = position.at
  const quarters = (num(text(node, 'duration')) ?? 0) / context.divisions
  position.at += quarters
  // Cue notes take time but are not played.
  if (isCue) return
  const beat: RawBeat = {
    start,
    quarters,
    rest: silent,
    type: text(node, 'type'),
    dots: children(node, 'dot').length,
    tuplet: readTuplet(node),
    notes: silent ? [] : [{ pitch, ...flags, note }],
    graces: silent ? [] : (position.graces.get(voice) ?? []),
    lyrics: readLyrics(node),
    stroke: strokeOf(node),
    slash,
  }
  if (!silent) position.graces.delete(voice)
  measure.voices.set(voice, [...(measure.voices.get(voice) ?? []), beat])
  position.last.set(voice, beat)
}

/** The elements of a `<measure>` besides notes and attributes. */
const MEASURE_ELEMENTS: Record<
  string,
  (
    element: Element,
    context: PartContext,
    measure: RawMeasure,
    position: MeasurePosition,
    bar: MeasureMetaInfo,
  ) => void
> = {
  backup: (element, context, _, position) => {
    position.at = Math.max(0, position.at - (num(text(element, 'duration')) ?? 0) / context.divisions)
  },
  forward: (element, context, _, position) => {
    position.at += (num(text(element, 'duration')) ?? 0) / context.divisions
  },
  direction: (element, context, measure, position, bar) =>
    readDirection(element, position.at, bar, measure.marks, context.firstPart),
  harmony: (element, _, measure, position) => {
    const chord = chordName(element)
    if (chord) measure.marks.push({ at: position.at, chord })
  },
  barline: (element, context, _, __, bar) => {
    if (context.firstPart) readBarline(element, bar, context.state)
  },
  sound: (element, context, _, __, bar) => {
    if (context.firstPart) readSound(element, '', bar)
  },
}

/** After the first part's bar: a volta still running, and the time signature carried on. */
function finishBar(node: Element, bar: MeasureMetaInfo, context: PartContext): void {
  if (bar.repeatAlternative == null && context.state.ending != null)
    bar.repeatAlternative = context.state.ending
  const hasTime = children(node, 'attributes').some((attributes) => child(attributes, 'time') != null)
  if (context.meter != null && !hasTime) {
    bar.numerator = context.meter.numerator
    bar.denominator = context.meter.denominator
  }
  bar.timeMeterPresent =
    context.meter == null ||
    context.meter.numerator !== bar.numerator ||
    context.meter.denominator !== bar.denominator
  context.meter = { numerator: bar.numerator, denominator: bar.denominator }
  bar.keySignature = context.key.fifths
  if (context.key.minor) bar.keyMinor = true
}

function readMeasure(node: Element, index: number, context: PartContext): RawMeasure {
  const bar = metaAt(context.state, index)
  const measure: RawMeasure = { voices: new Map(), marks: [] }
  const position: MeasurePosition = { at: 0, last: new Map(), graces: new Map() }
  for (const element of children(node)) {
    if (element.tagName === 'attributes') readAttributes(element, context, bar, index)
    else if (element.tagName === 'note') readNote(element, context, measure, position)
    else MEASURE_ELEMENTS[element.tagName]?.(element, context, measure, position, bar)
  }
  if (context.firstPart) finishBar(node, bar, context)
  return measure
}

// ---------------------------------------------------------------------------
// From raw beats to tab beats

/** Splits a length (in quarters) into plain and dotted note values, longest first. */
export function splitQuarters(
  quarters: number,
): { code: NoteLengthCode; dotted: boolean; quarters: number }[] {
  const out: { code: NoteLengthCode; dotted: boolean; quarters: number }[] = []
  let left = quarters
  for (const value of SPLIT_VALUES) {
    while (left >= value.quarters - EPSILON) {
      out.push(value)
      left -= value.quarters
    }
  }
  return out
}

/** How many plain notes a tuplet of `actual` replaces, as `Duration` counts it (0 = unsupported). */
function supportedNormal(actual: number): number {
  if (actual === 3) return 2
  if (actual >= 5 && actual <= 7) return 4
  if (actual >= 9 && actual <= 15) return 8
  return 0
}

interface BeatShape {
  duration: NoteLengthCode
  dotted: boolean
  doubleDotted: boolean
  tuplet: number | null
}

/** The beat's note value as written, when the app can hold it and it matches the length. */
function writtenShape(beat: RawBeat): BeatShape | null {
  const base = beat.type != null ? NOTE_TYPES[beat.type] : undefined
  if (base == null || beat.dots > 2) return null
  let quarters = base.quarters * (beat.dots === 2 ? 1.75 : beat.dots === 1 ? 1.5 : 1)
  let tuplet: number | null = null
  if (beat.tuplet != null && beat.tuplet.actual !== beat.tuplet.normal) {
    if (supportedNormal(beat.tuplet.actual) !== beat.tuplet.normal) return null
    tuplet = beat.tuplet.actual
    quarters = (quarters * beat.tuplet.normal) / beat.tuplet.actual
  }
  // Files may round durations (divisions too coarse for the tuplet); allow a little slack.
  if (beat.quarters > 0 && Math.abs(quarters - beat.quarters) > Math.max(0.02, beat.quarters * 0.05))
    return null
  return { duration: base.code, dotted: beat.dots === 1, doubleDotted: beat.dots === 2, tuplet }
}

function restBeats(quarters: number, stringCount: number): Beat[] {
  return splitQuarters(quarters).map((value) => {
    const beat = Song.defaultMeasure()
    beat.duration = `${value.code}r`
    beat.dotted = value.dotted
    beat.notes = new Array(stringCount).fill(null)
    return beat
  })
}

interface PlacementContext {
  tuning: number[]
  capo: number
  drums: boolean
  /** per voice: pitch → string it last sounded on, so a tie stays on its string */
  lastString: Map<number, number>[]
}

function placedNote(raw: RawNote, string: number, fret: number): Note {
  const note: Note = { ...raw.note, string, fret, tied: raw.tieStop }
  // `trill.fret` holds -(steps up) until here; without a trill-step, the next fret, as the toolbar does.
  if (note.trill != null && note.trill.fret < 0)
    note.trill = { fret: fret - note.trill.fret, period: note.trill.period }
  return note
}

/** The free string with the lowest fret for a pitch, moved by octaves into the guitar's range. */
function foldedPlace(
  pitch: number,
  placed: (Note | null)[],
  context: PlacementContext,
): { string: number; fret: number } | null {
  const { tuning, capo } = context
  const lowest = tuning[0] + capo
  const highest = tuning[tuning.length - 1] + capo + MAX_FRET
  let shifted = pitch
  while (shifted < lowest) shifted += 12
  while (shifted > highest) shifted -= 12
  let best: { string: number; fret: number } | null = null
  for (let string = 0; string < tuning.length; string += 1) {
    const fret = shifted - capo - tuning[string]
    if (placed[string] != null || fret < 0 || fret > MAX_FRET) continue
    if (best == null || fret < best.fret) best = { string, fret }
  }
  return best
}

/** Puts a beat's notes on strings; returns the strings and how many notes had no room. */
function placeBeatNotes(
  notes: RawNote[],
  voice: number,
  context: PlacementContext,
): { placed: (Note | null)[]; dropped: number } {
  const { tuning, capo } = context
  const placed: (Note | null)[] = new Array(tuning.length).fill(null)
  let dropped = 0
  if (context.drums) {
    // Drums store the MIDI note as the fret, each drum on its own line.
    const drums = notes.filter((raw) => raw.pitch != null)
    assignDrumLines(
      drums.map((raw) => raw.pitch!),
      tuning.length,
    ).forEach((line, i) => {
      if (line >= 0) placed[line] = placedNote(drums[i], line, drums[i].pitch!)
      else dropped += 1
    })
    return { placed, dropped: dropped + notes.length - drums.length }
  }
  const lastString = context.lastString[voice]
  const unplaced: RawNote[] = []
  for (const raw of notes) {
    const string = raw.string != null ? tuning.length - raw.string : -1
    if (raw.fret != null && string >= 0 && string < tuning.length && placed[string] == null) {
      placed[string] = placedNote(raw, string, raw.fret)
      continue
    }
    const tiedString = raw.tieStop && raw.pitch != null ? lastString.get(raw.pitch) : undefined
    const tiedFret = tiedString != null ? raw.pitch! - capo - tuning[tiedString] : -1
    if (tiedString != null && placed[tiedString] == null && tiedFret >= 0) {
      placed[tiedString] = placedNote(raw, tiedString, tiedFret)
      continue
    }
    if (raw.pitch == null) dropped += 1
    else unplaced.push(raw)
  }
  const used = new Set(placed.flatMap((note, string) => (note != null ? [string] : [])))
  // arrangeOnStrings answers in ascending pitch order.
  const sorted = [...unplaced].sort((a, b) => a.pitch! - b.pitch!)
  const arranged = arrangeOnStrings(
    sorted.map((raw) => raw.pitch!),
    tuning,
    capo,
    used,
  )
  sorted.forEach((raw, i) => {
    const { string, fret } = arranged[i]
    const spot =
      string >= 0 && placed[string] == null ? { string, fret } : foldedPlace(raw.pitch!, placed, context)
    if (spot == null) dropped += 1
    else placed[spot.string] = placedNote(raw, spot.string, spot.fret)
  })
  placed.forEach((note, string) => {
    if (note != null) lastString.set(note.fret + capo + tuning[string], string)
  })
  return { placed, dropped }
}

/** The note a grace note leads into, and the grace's fret: on its own string when known, else by pitch. */
function graceTarget(
  grace: RawGrace,
  placed: (Note | null)[],
  context: PlacementContext,
): { target: Note; fret: number } | null {
  const { tuning, capo } = context
  if (grace.string != null && grace.fret != null) {
    const target = placed[tuning.length - grace.string]
    return target != null ? { target, fret: grace.fret } : null
  }
  const target = placed.find((note) => note != null && note.graceObj == null)
  if (target == null || grace.pitch == null) return null
  const fret = context.drums ? grace.pitch : grace.pitch - capo - tuning[target.string]
  return fret >= 0 && (context.drums || fret <= MAX_FRET) ? { target, fret } : null
}

function attachGraces(graces: RawGrace[], placed: (Note | null)[], context: PlacementContext): void {
  for (const grace of graces) {
    const found = graceTarget(grace, placed, context)
    if (found == null) continue
    found.target.graceObj = {
      fret: found.fret,
      string: found.target.string,
      height: 0,
      dynamic: 'mf',
      transition: 'none',
      duration: NOTE_TYPES[grace.type]?.code ?? 's',
      // Our export writes a slashed grace for one played before the beat.
      setOnBeat: grace.slash ? 'before' : 'with',
      dead: grace.dead,
    }
  }
}

function emptyVoice(stringCount: number): Beat[] {
  const beat = Song.defaultMeasure()
  beat.duration = 'wr'
  beat.notes = new Array(stringCount).fill(null)
  beat.empty = true
  return [beat]
}

interface VoiceBuild {
  placement: PlacementContext
  voice: number
  lastDynamic: string[]
  /** lyric `number` attributes → verse index, in order of appearance */
  verses: Map<string, number>
}

/** A later piece of a length split into several values: the same notes, tied, without what starts a note. */
function continuation(note: Note | null): Note | null {
  if (note == null) return null
  const copy: Note = { ...note, tied: true }
  delete copy.graceObj
  delete copy.bendObj
  return copy
}

function pieceBeat(
  piece: BeatShape,
  placed: (Note | null)[],
  first: boolean,
  raw: RawBeat,
  build: VoiceBuild,
): Beat {
  const hasNotes = placed.some((note) => note != null)
  const beat = Song.defaultMeasure()
  beat.duration = hasNotes ? piece.duration : `${piece.duration}r`
  beat.dotted = piece.dotted
  beat.doubleDotted = piece.doubleDotted
  beat.tuplet = piece.tuplet
  beat.notes = hasNotes
    ? placed.map((note) => (first ? note : continuation(note)))
    : new Array(placed.length).fill(null)
  // every piece of a slashed length is a slash, with or without notes (a rhythm slash)
  if (raw.slash) beat.slash = true
  if (first && hasNotes) {
    if (raw.stroke) beat.effects.stroke = { strokeType: raw.stroke, strokeLength: 16 }
    for (const lyric of raw.lyrics) {
      if (!build.verses.has(lyric.verse)) build.verses.set(lyric.verse, build.verses.size)
      const verse = build.verses.get(lyric.verse)!
      if (verse < MAX_LYRIC_VERSES) setBeatLyric(beat, verse, lyric.text)
    }
  }
  return beat
}

/** Beats of one voice of one bar, gaps filled with rests; marks go on the beat they fall on. */
function buildVoice(raws: RawBeat[], marks: BeatMark[], build: VoiceBuild): Beat[] {
  const { placement, voice } = build
  const stringCount = placement.tuning.length
  const out: { beat: Beat; start: number }[] = []
  let cursor = 0
  for (const raw of [...raws].sort((a, b) => a.start - b.start)) {
    if (raw.start < cursor - EPSILON) {
      // Overlapping notes in one voice can't be held in the tab.
      warnImport('overlappingNotes', raw.notes.length)
      continue
    }
    if (raw.start > cursor + EPSILON)
      for (const rest of restBeats(raw.start - cursor, stringCount)) out.push({ beat: rest, start: cursor })
    const shape = writtenShape(raw)
    const pieces: BeatShape[] =
      shape != null
        ? [shape]
        : splitQuarters(raw.quarters).map((value) => ({
            duration: value.code,
            dotted: value.dotted,
            doubleDotted: false,
            tuplet: null,
          }))
    let placed: (Note | null)[] = new Array(stringCount).fill(null)
    if (!raw.rest) {
      const result = placeBeatNotes(raw.notes, voice, placement)
      placed = result.placed
      warnImport('unplacedNotes', result.dropped)
      attachGraces(raw.graces, placed, placement)
    }
    pieces.forEach((piece, i) =>
      out.push({ beat: pieceBeat(piece, placed, i === 0, raw, build), start: raw.start }),
    )
    cursor = raw.start + raw.quarters
  }
  applyMarks(out, marks, build, voice)
  return out.map((entry) => entry.beat)
}

function applyMarks(
  beats: { beat: Beat; start: number }[],
  marks: BeatMark[],
  build: VoiceBuild,
  voice: number,
): void {
  const beatAt = (at: number) => beats.find((entry) => entry.start >= at - EPSILON) ?? beats[beats.length - 1]
  for (const mark of voice === 0 ? marks : []) {
    const target = beatAt(mark.at)
    if (target == null) continue
    if (mark.text) target.beat.text = target.beat.text ? `${target.beat.text} ${mark.text}` : mark.text
    if (mark.chord) target.beat.chord = nameOnlyChord(mark.chord, build.placement.tuning.length)
    if (mark.dynamic) {
      target.beat.dynamic = mark.dynamic
      target.beat.dynamicPresent = mark.dynamic !== build.lastDynamic[voice]
      build.lastDynamic[voice] = mark.dynamic
    }
  }
  // Beats carry the dynamic in force (as the GPIF reader does), so playback keeps it.
  for (const { beat } of beats) {
    if (beat.dynamicPresent) build.lastDynamic[voice] = beat.dynamic
    else beat.dynamic = build.lastDynamic[voice]
  }
}

/** A chord symbol without a diagram (MusicXML `<harmony>` names it; frets are rarely given). */
function nameOnlyChord(name: string, stringCount: number): Chord {
  return {
    name,
    capo: 0,
    frets: new Array(stringCount).fill(-1),
    chordType: '',
    chordRoot: '',
    fingers: new Array(stringCount).fill(-1),
    display: false,
  }
}

function chooseTuning(measures: RawMeasure[], attributes: PartAttributes): number[] {
  if (attributes.tuning != null) return attributes.tuning
  if (attributes.drums) return new Array(6).fill(0)
  const pitches = measures.flatMap((measure) =>
    [...measure.voices.values()].flatMap((beats) =>
      beats.flatMap((beat) => beat.notes.flatMap((raw) => (raw.pitch != null ? [raw.pitch] : []))),
    ),
  )
  if (pitches.length === 0) return GUITAR_TUNING
  return Math.min(...pitches) < GUITAR_TUNING[0] && Math.max(...pitches) < 67 ? BASS_TUNING : GUITAR_TUNING
}

/** The voice ids of a part in order of first appearance; the first two become voices 1 and 2. */
function voiceOrder(measures: RawMeasure[]): string[] {
  const order: string[] = []
  for (const measure of measures)
    for (const [voice, beats] of measure.voices)
      if (!order.includes(voice) && beats.some((beat) => !beat.rest)) order.push(voice)
  return order
}

// ---------------------------------------------------------------------------

interface ReadPart {
  info: PartInfo
  attributes: PartAttributes
  measures: RawMeasure[]
}

/** The `<score-partwise>` element, or an ImportError saying why the text isn't one. */
function scoreRoot(xml: string, format: string): Element {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const root = doc.documentElement
  if (doc.getElementsByTagName('parsererror').length > 0 || root == null) {
    throw new ImportError('This is not well-formed MusicXML.', format)
  }
  if (root.tagName === 'score-timewise') return timewiseToPartwise(doc, root)
  if (root.tagName !== 'score-partwise') throw new ImportError('This is not a MusicXML score.', format)
  return root
}

/**
 * Timewise MusicXML (measures holding parts) turned around into partwise (parts holding
 * measures): the same elements, so the reader needs no second path.
 */
function timewiseToPartwise(doc: Document, root: Element): Element {
  const partwise = doc.createElement('score-partwise')
  const measures = children(root, 'measure')
  for (const node of children(root))
    if (node.tagName !== 'measure') partwise.appendChild(node.cloneNode(true))
  const partIds = children(child(root, 'part-list'), 'score-part').map(
    (part) => part.getAttribute('id') ?? '',
  )
  for (const measure of measures)
    for (const part of children(measure, 'part'))
      if (!partIds.includes(part.getAttribute('id') ?? '')) partIds.push(part.getAttribute('id') ?? '')
  for (const id of partIds) {
    const partNode = doc.createElement('part')
    partNode.setAttribute('id', id)
    for (const measure of measures) {
      const measureNode = doc.createElement('measure')
      for (const attribute of Array.from(measure.attributes))
        measureNode.setAttribute(attribute.name, attribute.value)
      const content = children(measure, 'part').find((part) => part.getAttribute('id') === id)
      for (const node of children(content)) measureNode.appendChild(node.cloneNode(true))
      partNode.appendChild(measureNode)
    }
    partwise.appendChild(partNode)
  }
  return partwise
}

function readParts(root: Element, state: MetaState, format: string): ReadPart[] {
  const partInfos = readPartList(root)
  const partNodes = children(root, 'part')
  if (partNodes.length === 0) throw new ImportError('The file contains no parts.', format)
  if (partNodes.length > IMPORT_LIMITS.tracks)
    throw new ImportError(`Too many parts (${partNodes.length}).`, format)
  return partNodes.map((partNode, partIndex) => {
    const info = partInfos.get(partNode.getAttribute('id') ?? '') ?? {
      name: '',
      program: 0,
      channel: -1,
      unpitched: new Map(),
    }
    const measureNodes = children(partNode, 'measure')
    if (measureNodes.length > IMPORT_LIMITS.measures)
      throw new ImportError(`The song is longer than ${IMPORT_LIMITS.measures} bars.`, format)
    const context: PartContext = {
      info,
      attributes: { tuning: null, capo: 0, drums: info.channel === DRUM_CHANNEL, transpose: 0, clefs: {} },
      divisions: 1,
      firstPart: partIndex === 0,
      state,
      meter: null,
      key: { fifths: 0, minor: false },
      slashStyle: false,
    }
    const measures = measureNodes.map((node, index) => readMeasure(node, index, context))
    return { info, attributes: context.attributes, measures }
  })
}

function partTrack(part: ReadPart, index: number, tuning: number[], channel: number): Track {
  const { info, attributes } = part
  const track: Track = {
    ...Song.defaultTrack(),
    name: info.name || (attributes.drums ? 'Drums' : `Track ${index + 1}`),
    strings: [...tuning],
    numStrings: tuning.length,
    capo: attributes.capo,
    volume: 127,
    balance: 63,
    color: { red: 220, green: 60, blue: 60 },
    channel: { index: channel, effectChannel: channel },
    program: info.program,
    primaryChannel: channel,
  }
  if (!attributes.drums) {
    for (const [bar, clef] of Object.entries(attributes.clefs)) setClefFrom(track, Number(bar), clef)
  }
  return track
}

/** The part's bars as tab: its first two voices, every bar of the song (missing ones empty). */
function partBars(part: ReadPart, tuning: number[], barCount: number, format: string): Beat[][][] {
  const voices = voiceOrder(part.measures)
  const build: Omit<VoiceBuild, 'voice'> = {
    placement: {
      tuning,
      capo: part.attributes.capo,
      drums: part.attributes.drums,
      lastString: Array.from({ length: MAX_VOICES }, () => new Map()),
    },
    lastDynamic: new Array(MAX_VOICES).fill('mf'),
    verses: new Map(),
  }
  return Array.from({ length: barCount }, (_, barIndex) => {
    const raw = part.measures[barIndex]
    const block: Beat[][] = []
    for (let voice = 0; voice < MAX_VOICES; voice += 1) {
      const beats = raw?.voices.get(voices[voice] ?? '') ?? []
      if (beats.length > IMPORT_LIMITS.beatsPerVoice)
        throw new ImportError(`A bar has more than ${IMPORT_LIMITS.beatsPerVoice} beats.`, format)
      const built = buildVoice(beats, voice === 0 ? (raw?.marks ?? []) : [], { ...build, voice })
      block.push(built.length > 0 ? built : emptyVoice(tuning.length))
    }
    // The tab holds two voices; notes of further voices are counted as left out.
    for (const voice of voices.slice(MAX_VOICES))
      for (const beat of raw?.voices.get(voice) ?? []) warnImport('extraVoiceNotes', beat.notes.length)
    return block
  })
}

/** Channels for the parts: drums on 10, the others one each from 1 on (the song has 64). */
function partChannels(parts: ReadPart[]): number[] {
  let next = 0
  return parts.map(({ attributes }) => {
    if (attributes.drums) return DRUM_CHANNEL
    const channel = next
    next = (next + 1) % CHANNEL_COUNT
    if (next === DRUM_CHANNEL) next += 1
    return channel
  })
}

function chordLibrary(bars: Beat[][][]): Map<string, Chord> {
  const chords = new Map<string, Chord>()
  for (const block of bars)
    for (const beat of block[0] ?? []) if (beat.chord) chords.set(beat.chord.name, beat.chord)
  return chords
}

/** Parses MusicXML text into song data without touching the current song. */
export function parseMusicXml(xml: string, format = 'musicxml'): GpifSong {
  const root = scoreRoot(xml, format)
  const state: MetaState = { meta: [], ending: null }
  const parts = readParts(root, state, format)
  if (state.meta.length === 0) throw new ImportError('The file contains no bars.', format)

  const channels = partChannels(parts)
  const tunings = parts.map((part) => chooseTuning(part.measures, part.attributes))
  const tracks = parts.map((part, i) => partTrack(part, i, tunings[i], channels[i]))
  const measures = parts.map((part, i) => partBars(part, tunings[i], state.meta.length, format))
  // A first measure marked implicit is a pickup (usually numbered 0).
  if (child(child(root, 'part'), 'measure')?.getAttribute('implicit') === 'yes')
    shortenPickupBar(state.meta, measures)

  state.meta[0].bpm ??= 120
  state.meta[0].timeMeterPresent = true
  return {
    description: readDescription(root),
    bpm: state.meta[0].bpm,
    measureMeta: state.meta,
    tracks,
    chords: measures.map(chordLibrary),
    measures,
  }
}
