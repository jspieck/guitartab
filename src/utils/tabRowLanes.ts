import type { TabBeat, TabNoteData } from '../types/tab'
import { beatShowsRhythm, getBeamCount } from './durationUtils'
import { beatHasText } from '../services/songMigrations'
import { beatHasLyrics } from './lyrics'

/**
 * Vertical lane layout of one tab row.
 *
 * Coordinates are row-local: y = 0 is the top string line, negative y is above
 * the strings. Each kind of annotation gets its own lane, and a lane exists only
 * when something in the row uses it, so annotations never collide vertically
 * and rows without effects stay compact.
 */

export type AboveLaneId =
  | 'rhythm'
  | 'articulation'
  | 'bend'
  | 'trill'
  | 'vibrato'
  | 'tremoloPicking'
  | 'whammy'
  | 'harmonic'
  | 'palmMute'
  | 'letRing'
  | 'volta'
  | 'text'
  | 'marker'
  | 'direction'
  | 'tempo'
  | 'chord'

export type BelowLaneId = 'tuplet' | 'dynamic' | 'lyrics'

export interface LaneBox {
  /** Row-local y of the lane's top edge. */
  top: number
  height: number
}

export interface RowLanes {
  above: Partial<Record<AboveLaneId, LaneBox>>
  below: Partial<Record<BelowLaneId, LaneBox>>
  /** Height of the lane stack above the top string (row top = -overBarHeight). */
  overBarHeight: number
  /** From the top string to the bottom of the tab content (strings, rhythm, lower lanes). */
  bodyHeight: number
  /** Sub-line per beat (`${blockId}:${beatIndex}`) inside multi-line lanes. */
  textLine: Record<string, number>
  chordLine: Record<string, number>
  /** Line of each articulation token at a beat (`${blockId}:${beatIndex}:${token}`). */
  articulationLine: Record<string, number>
  /** Baseline offset inside the whammy lane where a tremolo value of 0 sits. */
  whammyZero: number
  /** Verses in the lyrics lane (one line each, verse 1 on top). */
  lyricVerses: number
}

export interface LaneBeatInput {
  beat: TabBeat | undefined
  /** Row-local x of the beat's note centre. */
  centerX: number
}

export interface LaneBlockInput {
  blockId: number
  /** Rhythm on stems, first voice of a two-voice bar: stems and beams above the strings. */
  stemsUp?: boolean
  beats: LaneBeatInput[]
  meta:
    | {
        bpm?: number
        marker?: unknown
        directionTargets?: unknown[]
        directionJumps?: unknown[]
        repeatAlternative?: number
      }
    | undefined
}

export interface RowLaneInput {
  blocks: LaneBlockInput[]
  numStrings: number
  stringSpacing: number
}

/** Reserved strip directly above the top string for measure numbers / repeat counts. */
export const MEASURE_NUMBER_STRIP = 12
/** Rhythm band below the last string for rows whose deepest note has `beamLevels` beams/flags. */
export function getRhythmBandHeight(beamLevels: number): number {
  // Stems end 15px below the last string; each extra level adds 6px; flags reach 10px further.
  return beamLevels <= 0 ? 17 : 27 + (beamLevels - 1) * 6
}

/** Row-local y of the primary beam when stems go up (above the measure-number strip). */
export const STEMS_UP_BEAM_Y = -24

/** Lane above the strip for stems going up, for a row whose deepest such note has `beamLevels`. */
function stemsUpLaneHeight(beamLevels: number): number {
  // beams stack 6px further up per level; flags reach 10px beyond the last one
  const reach = -STEMS_UP_BEAM_Y + Math.max(0, beamLevels - 1) * 6 + (beamLevels > 0 ? 10 : 0)
  return Math.max(4, reach - MEASURE_NUMBER_STRIP + 2)
}

/** Rhythm band used when the row content is unknown (deepest supported level). */
export const RHYTHM_BAND_HEIGHT = getRhythmBandHeight(4)

export const LANE_HEIGHTS: Record<AboveLaneId | BelowLaneId, number> = {
  rhythm: 14,
  articulation: 14,
  bend: 16,
  trill: 14,
  vibrato: 10,
  tremoloPicking: 18,
  whammy: 8,
  harmonic: 14,
  palmMute: 14,
  letRing: 14,
  volta: 20,
  text: 15,
  marker: 20,
  direction: 20,
  tempo: 18,
  chord: 100,
  tuplet: 22,
  dynamic: 20,
  lyrics: 15,
}

/** Bottom-to-top order of the lanes above the strings. */
const ABOVE_ORDER: AboveLaneId[] = [
  'rhythm',
  'bend',
  'articulation',
  'trill',
  'vibrato',
  'tremoloPicking',
  'whammy',
  'harmonic',
  'palmMute',
  'letRing',
  'volta',
  'text',
  'marker',
  'direction',
  'tempo',
  'chord',
]

const BELOW_ORDER: BelowLaneId[] = ['tuplet', 'dynamic', 'lyrics']

/** Articulation tokens, in the vertical order they stack (nearest to the strings first). */
export const ARTICULATION_TOKENS: Array<[keyof TabNoteData & string, string]> = [
  ['stacatto', '•'],
  ['accentuated', '>'],
  ['heavyAccentuated', '^'],
  ['tap', 'T'],
  ['slap', 'S'],
  ['pop', 'P'],
  ['fadeIn', '≺'],
]

const TEXT_CHAR_WIDTH = 6.5
const TEXT_GAP = 6
const CHORD_DIAGRAM_WIDTH = 72

export const beatKey = (blockId: number, beatIndex: number) => `${blockId}:${beatIndex}`

type NoteRecord = TabNoteData & Record<string, unknown>

function notesOf(beat: TabBeat | undefined): NoteRecord[] {
  return (beat?.notes ?? []).filter((note): note is NoteRecord => note != null)
}

export function getArticulationTokens(beat: TabBeat | undefined): string[] {
  const notes = notesOf(beat)
  return ARTICULATION_TOKENS.filter(([property]) => notes.some((note) => Boolean(note[property]))).map(
    ([, label]) => label,
  )
}

export function estimateTextWidth(text: string, charWidth = TEXT_CHAR_WIDTH): number {
  return text.length * charWidth
}

/** Greedy line assignment so horizontally overlapping items go to separate lines. */
function assignLines(items: Array<{ key: string; left: number; right: number }>): {
  lines: Record<string, number>
  count: number
} {
  const lineEnds: number[] = []
  const lines: Record<string, number> = {}
  for (const item of [...items].sort((a, b) => a.left - b.left)) {
    let line = lineEnds.findIndex((end) => end + TEXT_GAP <= item.left)
    if (line === -1) {
      line = lineEnds.length
      lineEnds.push(item.right)
    } else {
      lineEnds[line] = item.right
    }
    lines[item.key] = line
  }
  return { lines, count: lineEnds.length }
}

function whammyRange(beat: TabBeat | undefined): { up: number; down: number } {
  const effects = beat?.effects as { tremoloBar?: Array<{ value?: number }> } | undefined
  if (!effects?.tremoloBar) {
    return { up: 0, down: 0 }
  }
  const values = effects.tremoloBar.map((point) => point.value ?? 0)
  return {
    up: Math.max(0, ...values) / WHAMMY_SCALE,
    down: Math.max(0, ...values.map((value) => -value)) / WHAMMY_SCALE,
  }
}

/** Tremolo bar values are 1/100 semitones; 10 px per full step down/up. */
export const WHAMMY_SCALE = 10

/** Note-level effects that each need a lane when any note in the row uses them. */
const NOTE_LANES: Array<[AboveLaneId, (note: NoteRecord) => boolean]> = [
  ['bend', (note) => note.bendObj != null],
  ['trill', (note) => note.trill != null],
  ['vibrato', (note) => Boolean(note.vibrato)],
  ['tremoloPicking', (note) => Boolean(note.tremoloPicking)],
  ['harmonic', (note) => note.artificialStyle != null || Boolean(note.naturalHarmonic)],
  ['palmMute', (note) => Boolean(note.palmMute)],
  ['letRing', (note) => Boolean(note.letRing)],
]

interface RowScan {
  used: Set<AboveLaneId | BelowLaneId>
  textItems: Array<{ key: string; left: number; right: number }>
  chordItems: Array<{ key: string; left: number; right: number }>
  articulationLine: Record<string, number>
  articulationLines: number
  whammyUp: number
  whammyDown: number
  beamLevels: number
  /** -1 while no bar of the row has stems going up */
  upBeamLevels: number
  lyricVerses: number
}

function scanBeat(
  scan: RowScan,
  key: string,
  beat: TabBeat | undefined,
  centerX: number,
  stemsUp: boolean,
): void {
  const notes = notesOf(beat)
  if (stemsUp) {
    scan.upBeamLevels = Math.max(
      scan.upBeamLevels,
      beat && beatShowsRhythm(beat) ? getBeamCount(beat.duration) : 0,
    )
  } else if (beat && beatShowsRhythm(beat)) {
    scan.beamLevels = Math.max(scan.beamLevels, getBeamCount(beat.duration))
  }

  const tokens = getArticulationTokens(beat)
  tokens.forEach((token, line) => {
    scan.articulationLine[`${key}:${token}`] = line
  })
  scan.articulationLines = Math.max(scan.articulationLines, tokens.length)

  for (const [lane, usesLane] of NOTE_LANES) {
    if (notes.some(usesLane)) scan.used.add(lane)
  }
  scanBeatAnnotations(scan, key, beat, centerX)
}

/** Beat-level annotations: whammy bar, text, chord diagram, dynamics, tuplets. */
function scanBeatAnnotations(scan: RowScan, key: string, beat: TabBeat | undefined, centerX: number): void {
  if (beat?.effects?.tremoloBar != null) {
    const whammy = whammyRange(beat)
    scan.used.add('whammy')
    scan.whammyUp = Math.max(scan.whammyUp, whammy.up)
    scan.whammyDown = Math.max(scan.whammyDown, whammy.down)
  }
  if (beatHasText(beat)) {
    const left = centerX - 4
    scan.textItems.push({ key, left, right: left + estimateTextWidth(String(beat.text)) })
  }
  if (beat?.chord != null) {
    scan.chordItems.push({
      key,
      left: centerX - CHORD_DIAGRAM_WIDTH / 2,
      right: centerX + CHORD_DIAGRAM_WIDTH / 2,
    })
  }
  if (beat?.dynamicPresent && beat.dynamic) scan.used.add('dynamic')
  if (beat?.tuplet) scan.used.add('tuplet')
  if (beatHasLyrics(beat)) scan.lyricVerses = Math.max(scan.lyricVerses, beat!.lyrics!.length)
}

function scanRow(input: RowLaneInput): RowScan {
  const scan: RowScan = {
    used: new Set(),
    textItems: [],
    chordItems: [],
    articulationLine: {},
    articulationLines: 0,
    whammyUp: 0,
    whammyDown: 0,
    beamLevels: 0,
    upBeamLevels: -1,
    lyricVerses: 0,
  }
  for (const block of input.blocks) {
    if (block.meta?.bpm != null) scan.used.add('tempo')
    if (block.meta?.marker != null) scan.used.add('marker')
    if (block.meta?.directionTargets?.length || block.meta?.directionJumps?.length) scan.used.add('direction')
    if (block.meta?.repeatAlternative != null) scan.used.add('volta')
    block.beats.forEach(({ beat, centerX }, beatIndex) => {
      scanBeat(scan, beatKey(block.blockId, beatIndex), beat, centerX, block.stemsUp === true)
    })
  }
  return scan
}

export function computeRowLanes(input: RowLaneInput): RowLanes {
  const {
    used,
    textItems,
    chordItems,
    articulationLine,
    articulationLines,
    whammyUp,
    whammyDown,
    beamLevels,
    upBeamLevels,
    lyricVerses,
  } = scanRow(input)
  const text = assignLines(textItems)
  const chords = assignLines(chordItems)
  if (articulationLines > 0) used.add('articulation')
  if (text.count > 0) used.add('text')
  if (chords.count > 0) used.add('chord')
  if (lyricVerses > 0) used.add('lyrics')
  if (upBeamLevels >= 0) used.add('rhythm')

  const heightOf = (lane: AboveLaneId | BelowLaneId): number => {
    switch (lane) {
      case 'rhythm':
        return stemsUpLaneHeight(upBeamLevels)
      case 'articulation':
        return LANE_HEIGHTS.articulation * articulationLines
      case 'text':
        return LANE_HEIGHTS.text * text.count
      case 'chord':
        return LANE_HEIGHTS.chord * chords.count
      case 'whammy':
        return LANE_HEIGHTS.whammy + whammyUp + whammyDown
      case 'lyrics':
        return LANE_HEIGHTS.lyrics * lyricVerses
      default:
        return LANE_HEIGHTS[lane]
    }
  }

  const above: RowLanes['above'] = {}
  let cursor = -MEASURE_NUMBER_STRIP
  for (const lane of ABOVE_ORDER) {
    if (!used.has(lane)) continue
    const height = heightOf(lane)
    cursor -= height
    above[lane] = { top: cursor, height }
  }

  const below: RowLanes['below'] = {}
  const lastString = (input.numStrings - 1) * input.stringSpacing
  let bottom = lastString + getRhythmBandHeight(beamLevels)
  for (const lane of BELOW_ORDER) {
    if (!used.has(lane)) continue
    const height = heightOf(lane)
    below[lane] = { top: bottom, height }
    bottom += height
  }

  return {
    above,
    below,
    overBarHeight: -cursor,
    bodyHeight: bottom,
    textLine: text.lines,
    chordLine: chords.lines,
    articulationLine,
    whammyZero: LANE_HEIGHTS.whammy / 2 + whammyUp,
    lyricVerses,
  }
}
