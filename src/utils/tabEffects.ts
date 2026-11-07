import { stringLine } from './tabStrings'
import type { Grace, TabBeat, TabNoteData } from '../types/tab'
import { getMeasureBeatNoteX, getMeasureBeatWidth, getMeasureBeatX } from './measureBeatLayout'
import {
  beatKey,
  getArticulationTokens,
  LANE_HEIGHTS,
  MEASURE_NUMBER_STRIP,
  RHYTHM_BAND_HEIGHT,
  WHAMMY_SCALE,
  type AboveLaneId,
  type BelowLaneId,
  type LaneBox,
  type RowLanes,
} from './tabRowLanes'
import { beatHasText } from '../services/songMigrations'
import { beatLyric, estimateLyricWidth, lyricDisplayText, lyricJoinsNext } from './lyrics'

interface BendPoint {
  bendPosition?: number
  bendValue?: number
}

interface TremoloBarPoint {
  position?: number
  value?: number
}

type EffectNote = TabNoteData & {
  naturalHarmonic?: boolean
  bendObj?: BendPoint[]
  graceObj?: Grace
}

export interface SlideEffect {
  path: string
  beatIndex: number
  stringIndex: number
}

export interface BendEffect {
  path: string
  arrowPath: string
  valueText: string
  textX: number
  textY: number
  beatIndex: number
  stringIndex: number
}

export interface ArcEffect {
  path: string
  beatIndex: number
  stringIndex: number
}

export interface VibratoEffect {
  path: string
  beatIndex: number
  stringIndex: number
}

export interface TrillEffect {
  textX: number
  textY: number
  path: string
  beatIndex: number
  stringIndex: number
}

export interface TremoloBarEffect {
  path: string
  beatIndex: number
}

export interface TextEffect {
  text: string
  x: number
  y: number
  fontSize: string
  beatIndex: number
}

/** A labelled run over consecutive beats (P.M. / let ring), drawn as label + dashed line. */
export interface EffectRun {
  kind: 'palmMute' | 'letRing'
  label: string
  x: number
  y: number
  lineStartX: number
  lineEndX: number
  lineY: number
}

export interface BeatAnnotation {
  text: string
  x: number
  y: number
  beatIndex: number
}

/** A lyric syllable, centred under its note; `hyphenX` places the joining hyphen. */
export interface LyricAnnotation {
  text: string
  x: number
  y: number
  verse: number
  beatIndex: number
  hyphenX: number | null
}

export interface StrokeEffect {
  path: string
  arrowPath: string
  beatIndex: number
}

export interface HarmonicEffect {
  x: number
  y: number
  text: string
  beatIndex: number
  stringIndex: number
}

export interface TremoloPickingEffect {
  x: number
  y: number
  lines: number
  beatIndex: number
  stringIndex: number
}

export interface GraceNoteEffect {
  x: number
  y: number
  fret: number
  slurPath: string
  beatIndex: number
  stringIndex: number
}

export interface TabEffectsInput {
  measureData: TabBeat[]
  trackId: number
  voiceId: number
  blockId: number
  stringSpacing: number
  numStrings: number
  /** Row lane layout; when missing, a lane stack is derived for this measure alone. */
  lanes?: RowLanes
}

export interface TabEffectCollections {
  slides: SlideEffect[]
  bends: BendEffect[]
  ties: ArcEffect[]
  pullDowns: ArcEffect[]
  vibratos: VibratoEffect[]
  trills: TrillEffect[]
  tremoloBars: TremoloBarEffect[]
  textEffects: TextEffect[]
  runs: EffectRun[]
  harmonics: HarmonicEffect[]
  tremoloPickings: TremoloPickingEffect[]
  graceNotes: GraceNoteEffect[]
  beatTexts: BeatAnnotation[]
  dynamics: BeatAnnotation[]
  lyrics: LyricAnnotation[]
  strokes: StrokeEffect[]
}

function getEffectNote(note: TabNoteData | null | undefined): EffectNote | null {
  return (note as EffectNote | null | undefined) ?? null
}

function getBeatX(input: TabEffectsInput, beatIndex: number): number {
  return getMeasureBeatX(input.trackId, input.voiceId, input.blockId, beatIndex, input.measureData)
}

function getBeatWidth(input: TabEffectsInput, beatIndex: number): number {
  return getMeasureBeatWidth(input.trackId, input.voiceId, input.blockId, beatIndex, input.measureData)
}

function getBeatNoteX(input: TabEffectsInput, beatIndex: number): number {
  return getMeasureBeatNoteX(input.trackId, input.voiceId, input.blockId, beatIndex, input.measureData)
}

const NOTE_TEXT_BASELINE_OFFSET = 6

function getStringY(input: TabEffectsInput, stringIndex: number): number {
  return stringLine(stringIndex, input.numStrings) * input.stringSpacing + NOTE_TEXT_BASELINE_OFFSET
}

/**
 * Lane box for `lane`. Rows always carry lanes from the layout engine; the
 * fallback stacks lanes in a fixed order for callers without a row layout.
 */
function getLane(input: TabEffectsInput, lane: AboveLaneId | BelowLaneId): LaneBox {
  const fromRow = input.lanes?.above[lane as AboveLaneId] ?? input.lanes?.below[lane as BelowLaneId]
  if (fromRow) {
    return fromRow
  }
  if (lane === 'tuplet' || lane === 'dynamic' || lane === 'lyrics') {
    const top = (input.numStrings - 1) * input.stringSpacing + RHYTHM_BAND_HEIGHT
    const offset = {
      tuplet: 0,
      dynamic: LANE_HEIGHTS.tuplet,
      lyrics: LANE_HEIGHTS.tuplet + LANE_HEIGHTS.dynamic,
    }
    return { top: top + offset[lane], height: LANE_HEIGHTS[lane] }
  }
  const height = LANE_HEIGHTS[lane]
  return { top: -MEASURE_NUMBER_STRIP - height, height }
}

function getNoteCenter(context: BeatEffectContext): number {
  return getBeatNoteX(context.input, context.beatIndex)
}

/** Approximate half width of a fret label at 16px (digits are ~8.5px wide). */
function getDigitHalfWidth(note: TabNoteData | null): number {
  if (!note) return 4.5
  const label = note.dead ? 'x' : note.ghost ? `(${note.fret})` : String(note.fret)
  return Math.max(4.5, label.length * 4.4)
}

function getBendValueText(maxBendValue: number): string {
  if (maxBendValue >= 100) return 'full'
  if (maxBendValue >= 75) return '3/4'
  if (maxBendValue >= 50) return '1/2'
  if (maxBendValue >= 25) return '1/4'
  return ''
}

export function getFontSizeForEffect(effectText: string): string {
  switch (effectText) {
    case '•':
      return '20px'
    case 'P.M.':
      return '11px'
    case 'let ring':
    case 'A.H.':
    case 'N.H.':
    case 'P.H.':
    case 'T.H.':
    case 'S.H.':
      return '10px'
    case '>':
    case '^':
      return '18px'
    default:
      return '14px'
  }
}

interface BeatEffectContext {
  input: TabEffectsInput
  beat: TabBeat | undefined
  beatIndex: number
  beatX: number
  beatWidth: number
}

interface NoteEffectContext extends BeatEffectContext {
  rawNote: TabNoteData | null
  note: EffectNote | null
  stringIndex: number
  yPos: number
}

function createEmptyEffectCollections(): TabEffectCollections {
  return {
    slides: [],
    bends: [],
    ties: [],
    pullDowns: [],
    vibratos: [],
    trills: [],
    tremoloBars: [],
    textEffects: [],
    runs: [],
    harmonics: [],
    tremoloPickings: [],
    graceNotes: [],
    beatTexts: [],
    dynamics: [],
    lyrics: [],
    strokes: [],
  }
}

function createBeatEffectContext(
  input: TabEffectsInput,
  beat: TabBeat | undefined,
  beatIndex: number,
): BeatEffectContext {
  return {
    input,
    beat,
    beatIndex,
    beatX: getBeatX(input, beatIndex),
    beatWidth: getBeatWidth(input, beatIndex),
  }
}

function createNoteEffectContext(
  context: BeatEffectContext,
  rawNote: TabNoteData | null,
  stringIndex: number,
): NoteEffectContext {
  return {
    ...context,
    rawNote,
    note: getEffectNote(rawNote),
    stringIndex,
    yPos: getStringY(context.input, stringIndex),
  }
}

function createWavePath(startX: number, waveY: number, width: number): string {
  let pathData = `M${startX} ${waveY + 3}`

  for (let index = 3; index < width; index += 3) {
    pathData += index % 6 === 0 ? `L${startX + index} ${waveY + 5}` : `L${startX + index} ${waveY + 1}`
  }

  return pathData
}

function collectSlideEffect(context: NoteEffectContext, slides: SlideEffect[]): void {
  if (!context.note?.slide) {
    return
  }

  const startX = getNoteCenter(context) + getDigitHalfWidth(context.note) + 2
  const nextBeat = context.input.measureData[context.beatIndex + 1]
  const nextNote = getEffectNote(nextBeat?.notes?.[context.stringIndex])
  const slideUp = Boolean(nextNote && nextNote.fret > context.note.fret)
  let endX = startX + Math.min(context.beatWidth * 0.6, 25)
  if (nextBeat) {
    // Stop before the next beat's digit on this string.
    const nextCenter = getBeatNoteX(context.input, context.beatIndex + 1)
    endX = Math.min(endX, nextCenter - getDigitHalfWidth(nextNote) - 2)
  }
  // Sliding up to a higher fret is drawn rising ("/"), sliding down falling ("\").
  const yOffset = slideUp ? 3 : -3
  const midY = context.yPos - 6

  slides.push({
    path: `M${startX} ${midY + yOffset}L${Math.max(endX, startX + 4)} ${midY - yOffset}`,
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectBendEffect(context: NoteEffectContext, bends: BendEffect[]): void {
  if (!context.note?.bendObj || context.note.bendObj.length === 0) {
    return
  }

  // The bend rises from the note to the bend lane; its value label sits in the lane.
  const lane = getLane(context.input, 'bend')
  const startX = getNoteCenter(context) + getDigitHalfWidth(context.note) + 1
  const startY = context.yPos - 9
  const tipY = lane.top + lane.height - 1
  const maxBendValue = Math.max(0, ...context.note.bendObj.map((point) => point.bendValue || 0))
  const yForValue = (value: number) =>
    maxBendValue > 0 ? startY + (tipY - startY) * (value / maxBendValue) : startY
  let pathData = `M${startX} ${startY}`
  let arrowPath = ''
  let peakX = startX
  let peakY = startY

  context.note.bendObj.forEach((bendPoint: BendPoint) => {
    const x = startX + (bendPoint.bendPosition || 0) / 4
    const y = yForValue(bendPoint.bendValue || 0)
    pathData += `L${x} ${y}`
    if (y < peakY) {
      peakX = x
      peakY = y
    }
  })

  if (maxBendValue > 0) {
    arrowPath = `M${peakX - 3} ${peakY + 4}L${peakX} ${peakY}L${peakX + 3} ${peakY + 4}`
  }

  bends.push({
    path: pathData,
    arrowPath,
    valueText: getBendValueText(maxBendValue),
    textX: peakX,
    textY: lane.top + 9,
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectTieEffect(context: NoteEffectContext, ties: ArcEffect[]): void {
  if (!context.rawNote?.tied || context.beatIndex === 0) {
    return
  }

  const startX = getBeatNoteX(context.input, context.beatIndex - 1) + 8
  const endX = getBeatNoteX(context.input, context.beatIndex) - 5
  const curveY = context.yPos + 8
  const curveHeight = 5

  ties.push({
    path: `M${startX} ${curveY}C${startX} ${curveY + curveHeight}, ${endX} ${curveY + curveHeight}, ${endX} ${curveY}`,
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectPullDownEffect(context: NoteEffectContext, pullDowns: ArcEffect[]): void {
  if (!context.rawNote?.pullDown || context.beatIndex >= context.input.measureData.length - 1) {
    return
  }

  const startX = getBeatNoteX(context.input, context.beatIndex) + 8
  const endX = getBeatNoteX(context.input, context.beatIndex + 1) - 5
  const curveY = context.yPos - 12
  const curveHeight = 6

  pullDowns.push({
    path: `M${startX} ${curveY}C${startX} ${curveY - curveHeight}, ${endX} ${curveY - curveHeight}, ${endX} ${curveY}`,
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectVibratoEffect(context: NoteEffectContext, vibratos: VibratoEffect[]): void {
  if (!context.rawNote?.vibrato) {
    return
  }

  const lane = getLane(context.input, 'vibrato')
  const width = Math.max(9, Math.min(context.beatWidth - 4, 30))
  const startX = getNoteCenter(context) - width / 2
  const waveY = lane.top + (lane.height - 6) / 2

  vibratos.push({
    path: createWavePath(startX, waveY, width),
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectHarmonicEffect(context: NoteEffectContext, beatEffects: string[]): void {
  if (context.note?.naturalHarmonic) {
    beatEffects.push('N.H.')
  } else if (context.note?.artificialStyle != null) {
    // The stored style is the label: N.H., A.H., P.H. (pinch), T.H. (tapped), S.H. (semi).
    beatEffects.push(context.note.artificialStyle || 'A.H.')
  }
}

function collectTremoloPickingEffect(
  context: NoteEffectContext,
  tremoloPickings: TremoloPickingEffect[],
): void {
  if (!context.rawNote?.tremoloPicking) {
    return
  }

  let lines = 1
  if (context.rawNote.tremoloPickingLength === 's') lines = 2
  if (context.rawNote.tremoloPickingLength === 't') lines = 3

  tremoloPickings.push({
    x: getNoteCenter(context) - 7,
    y: getLane(context.input, 'tremoloPicking').top + 1,
    lines,
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectGraceNoteEffect(context: NoteEffectContext, graceNotes: GraceNoteEffect[]): void {
  if (!context.note?.graceObj) {
    return
  }

  const mainNoteX = getNoteCenter(context)
  const graceX = mainNoteX - getDigitHalfWidth(context.note) - 6

  graceNotes.push({
    x: graceX,
    y: context.yPos + 2,
    fret: context.note.graceObj.fret,
    slurPath: `M${graceX + 5} ${context.yPos - 5}C${graceX + 10} ${context.yPos - 12}, ${mainNoteX - 5} ${context.yPos - 12}, ${mainNoteX} ${context.yPos - 5}`,
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectTrillEffect(context: NoteEffectContext, trills: TrillEffect[]): void {
  if (context.rawNote?.trill == null) {
    return
  }

  const lane = getLane(context.input, 'trill')
  const centerX = getNoteCenter(context)
  const width = Math.max(6, Math.min(context.beatWidth - 14, 25))

  trills.push({
    textX: centerX - 10,
    textY: lane.top + lane.height - 3,
    path: createWavePath(centerX + 2, lane.top + lane.height - 10, width),
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectNoteLevelEffects(
  context: NoteEffectContext,
  collections: TabEffectCollections,
  beatEffects: string[],
): void {
  collectSlideEffect(context, collections.slides)
  collectBendEffect(context, collections.bends)
  collectTieEffect(context, collections.ties)
  collectPullDownEffect(context, collections.pullDowns)
  collectVibratoEffect(context, collections.vibratos)
  collectTrillEffect(context, collections.trills)
  collectHarmonicEffect(context, beatEffects)
  collectTremoloPickingEffect(context, collections.tremoloPickings)
  collectGraceNoteEffect(context, collections.graceNotes)
}

function appendBeatTextEffects(
  context: BeatEffectContext,
  textEffects: TextEffect[],
  harmonicLabels: string[],
): void {
  const centerX = getNoteCenter(context)

  const harmonic = [...new Set(harmonicLabels)][0]
  if (harmonic) {
    const lane = getLane(context.input, 'harmonic')
    textEffects.push({
      text: harmonic,
      x: centerX,
      y: lane.top + lane.height - 3,
      fontSize: getFontSizeForEffect(harmonic),
      beatIndex: context.beatIndex,
    })
  }

  const lane = getLane(context.input, 'articulation')
  const key = beatKey(context.input.blockId, context.beatIndex)
  getArticulationTokens(context.beat).forEach((token, index) => {
    const line = context.input.lanes?.articulationLine[`${key}:${token}`] ?? index
    // Line 0 is nearest to the strings (bottom of the lane).
    const lineBottom = lane.top + lane.height - line * LANE_HEIGHTS.articulation
    textEffects.push({
      text: token,
      x: centerX,
      y: lineBottom - (token === '•' ? 0 : 2),
      fontSize: getFontSizeForEffect(token),
      beatIndex: context.beatIndex,
    })
  })
}

function collectTremoloBarEffect(context: BeatEffectContext, tremoloBars: TremoloBarEffect[]): void {
  const tremoloBar = context.beat?.effects?.tremoloBar as TremoloBarPoint[] | undefined
  if (!tremoloBar) {
    return
  }

  const lane = getLane(context.input, 'whammy')
  const startX = getNoteCenter(context)
  const zeroY = lane.top + (context.input.lanes?.whammyZero ?? lane.height / 2)
  let pathData = `M${startX} ${zeroY}`

  tremoloBar.forEach((point: TremoloBarPoint) => {
    pathData += `L${startX + (point.position || 0) / 4} ${zeroY - (point.value || 0) / WHAMMY_SCALE}`
  })

  tremoloBars.push({
    path: pathData,
    beatIndex: context.beatIndex,
  })
}

type RunKind = EffectRun['kind']

const RUN_LABELS: Record<RunKind, string> = { palmMute: 'P.M.', letRing: 'let ring' }
const RUN_LABEL_WIDTH: Record<RunKind, number> = { palmMute: 22, letRing: 34 }

function beatHasRun(beat: TabBeat | undefined, kind: RunKind): boolean {
  return beat?.notes?.some((note: TabNoteData | null) => Boolean(note?.[kind])) === true
}

/** One label at the first beat of each run of consecutive beats, then a dashed line. */
function collectRunEffect(context: BeatEffectContext, kind: RunKind, runs: EffectRun[]): void {
  const beats = context.input.measureData
  if (!beatHasRun(context.beat, kind) || beatHasRun(beats[context.beatIndex - 1], kind)) {
    return
  }

  let endBeatIndex = context.beatIndex
  while (beatHasRun(beats[endBeatIndex + 1], kind)) {
    endBeatIndex += 1
  }

  const lane = getLane(context.input, kind)
  const x = getNoteCenter(context) - 6
  runs.push({
    kind,
    label: RUN_LABELS[kind],
    x,
    y: lane.top + lane.height - 3,
    lineStartX: x + RUN_LABEL_WIDTH[kind] + 3,
    lineEndX: getBeatX(context.input, endBeatIndex) + getBeatWidth(context.input, endBeatIndex) - 2,
    lineY: lane.top + lane.height - 6,
  })
}

function collectBeatAnnotations(context: BeatEffectContext, collections: TabEffectCollections): void {
  const beat = context.beat
  const key = beatKey(context.input.blockId, context.beatIndex)
  if (beatHasText(beat)) {
    const lane = getLane(context.input, 'text')
    const line = context.input.lanes?.textLine[key] ?? 0
    collections.beatTexts.push({
      text: String(beat.text),
      x: getNoteCenter(context) - 4,
      // Line 0 is nearest to the strings.
      y: lane.top + lane.height - line * LANE_HEIGHTS.text - 3,
      beatIndex: context.beatIndex,
    })
  }
  if (beat?.dynamicPresent && beat.dynamic) {
    const lane = getLane(context.input, 'dynamic')
    collections.dynamics.push({
      text: String(beat.dynamic),
      x: getNoteCenter(context),
      y: lane.top + lane.height - 5,
      beatIndex: context.beatIndex,
    })
  }
}

/** Lyric syllables, one line per verse; a joined syllable gets a hyphen towards the next one. */
function collectLyrics(context: BeatEffectContext, lyrics: LyricAnnotation[]): void {
  const syllables = context.beat?.lyrics
  if (!syllables) return
  const lane = getLane(context.input, 'lyrics')
  const centerX = getNoteCenter(context)
  const beats = context.input.measureData
  syllables.forEach((syllable, verse) => {
    if (syllable === '') return
    let hyphenX: number | null = null
    if (lyricJoinsNext(syllable)) {
      const right = centerX + estimateLyricWidth(syllable) / 2
      const next = beats.findIndex(
        (beat, index) => index > context.beatIndex && beatLyric(beat, verse) !== '',
      )
      if (next >= 0) {
        const nextCenter = getBeatNoteX(context.input, next)
        hyphenX = (right + nextCenter - estimateLyricWidth(beatLyric(beats[next], verse)) / 2) / 2
      } else {
        hyphenX = right + 5
      }
    }
    lyrics.push({
      text: lyricDisplayText(syllable),
      x: centerX,
      y: lane.top + (verse + 1) * LANE_HEIGHTS.lyrics - 4,
      verse,
      beatIndex: context.beatIndex,
      hyphenX,
    })
  })
}

/** Brush stroke: vertical arrow left of the chord, pointing in the strum direction on the page. */
function collectStrokeEffect(context: BeatEffectContext, strokes: StrokeEffect[]): void {
  const effects = context.beat?.effects as { stroke?: { strokeType?: string } } | undefined
  if (!effects?.stroke) {
    return
  }
  const strings = (context.beat?.notes ?? [])
    .map((note, index) => (note ? index : -1))
    .filter((index) => index >= 0)
  if (strings.length === 0) {
    return
  }

  const widest = Math.max(...strings.map((index) => getDigitHalfWidth(context.beat?.notes?.[index] ?? null)))
  const x = getNoteCenter(context) - widest - 5
  const spacing = context.input.stringSpacing
  const lines = strings.map((string) => stringLine(string, context.input.numStrings))
  const topY = Math.min(...lines) * spacing - 5
  const bottomY = Math.max(...lines) * spacing + 5
  // A down stroke strums from the low (bottom) to the high (top) string.
  const pointsUp = effects.stroke.strokeType !== 'up'
  const tipY = pointsUp ? topY : bottomY
  const direction = pointsUp ? 1 : -1
  strokes.push({
    path: `M${x} ${topY}L${x} ${bottomY}`,
    arrowPath: `M${x - 3} ${tipY + 5 * direction}L${x} ${tipY}L${x + 3} ${tipY + 5 * direction}`,
    beatIndex: context.beatIndex,
  })
}

function collectBeatLevelEffects(context: BeatEffectContext, collections: TabEffectCollections): void {
  collectTremoloBarEffect(context, collections.tremoloBars)
  collectRunEffect(context, 'palmMute', collections.runs)
  collectRunEffect(context, 'letRing', collections.runs)
  collectBeatAnnotations(context, collections)
  collectLyrics(context, collections.lyrics)
  collectStrokeEffect(context, collections.strokes)
}

export function buildTabEffects(input: TabEffectsInput): TabEffectCollections {
  const collections = createEmptyEffectCollections()

  input.measureData.forEach((beat, beatIndex) => {
    const context = createBeatEffectContext(input, beat, beatIndex)
    const beatEffects: string[] = []

    beat?.notes?.forEach((rawNote: TabNoteData | null, stringIndex: number) => {
      collectNoteLevelEffects(
        createNoteEffectContext(context, rawNote, stringIndex),
        collections,
        beatEffects,
      )
    })

    appendBeatTextEffects(context, collections.textEffects, beatEffects)
    collectBeatLevelEffects(context, collections)
  })

  return collections
}
