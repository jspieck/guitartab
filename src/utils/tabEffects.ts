import type { Grace, TabBeat, TabNoteData } from '../types/tab'
import { getMeasureBeatWidth, getMeasureBeatX } from './measureBeatLayout'

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

export interface LetRingEffect {
  x: number
  y: number
  lineEndX: number
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
  letRings: LetRingEffect[]
  harmonics: HarmonicEffect[]
  tremoloPickings: TremoloPickingEffect[]
  graceNotes: GraceNoteEffect[]
}

function getEffectNote(note: TabNoteData | null | undefined): EffectNote | null {
  return note as EffectNote | null | undefined ?? null
}

function getBeatX(input: TabEffectsInput, beatIndex: number): number {
  return getMeasureBeatX(
    input.trackId,
    input.voiceId,
    input.blockId,
    beatIndex,
    input.measureData,
  )
}

function getBeatWidth(input: TabEffectsInput, beatIndex: number): number {
  return getMeasureBeatWidth(
    input.trackId,
    input.voiceId,
    input.blockId,
    beatIndex,
    input.measureData,
  )
}

const NOTE_TEXT_BASELINE_OFFSET = 6
const BEAM_OFFSET_FROM_BOTTOM = 15

function getStringY(input: TabEffectsInput, stringIndex: number): number {
  return stringIndex * input.stringSpacing + NOTE_TEXT_BASELINE_OFFSET
}

function getBeamY(input: TabEffectsInput): number {
  return (input.numStrings - 1) * input.stringSpacing + BEAM_OFFSET_FROM_BOTTOM
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
    letRings: [],
    harmonics: [],
    tremoloPickings: [],
    graceNotes: [],
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
    pathData += index % 6 === 0
      ? `L${startX + index} ${waveY + 5}`
      : `L${startX + index} ${waveY + 1}`
  }

  return pathData
}

function collectSlideEffect(context: NoteEffectContext, slides: SlideEffect[]): void {
  if (!context.note?.slide) {
    return
  }

  const startX = context.beatX + context.beatWidth / 2 + 8
  const nextBeat = context.input.measureData[context.beatIndex + 1]
  const nextNote = getEffectNote(nextBeat?.notes?.[context.stringIndex])
  const slideUp = Boolean(nextNote && nextNote.fret > context.note.fret)
  const slideLength = Math.min(context.beatWidth * 0.6, 25)
  const yOffset = slideUp ? -3 : 3

  slides.push({
    path: `M${startX} ${context.yPos + 4 + yOffset}L${startX + slideLength} ${context.yPos + 4 - yOffset}`,
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectBendEffect(context: NoteEffectContext, bends: BendEffect[]): void {
  if (!context.note?.bendPresent || !context.note.bendObj || context.note.bendObj.length === 0) {
    return
  }

  const startX = context.beatX + context.beatWidth / 2 + 5
  const startY = context.yPos - 8
  let pathData = `M${startX} ${startY + 10}`
  let arrowPath = ''
  let maxBendValue = 0
  let lastX = startX
  let lastY = startY + 10

  context.note.bendObj.forEach((bendPoint: BendPoint, index: number) => {
    const posOffset = (bendPoint.bendPosition || 0) / 4
    const bendValue = bendPoint.bendValue || 0
    const bendHeight = bendValue / 5
    const x = startX + posOffset
    const nextY = startY + 10 - bendHeight

    if (bendValue > maxBendValue) {
      maxBendValue = bendValue
    }

    if (index === 0 && bendPoint.bendPosition === 0) {
      pathData = `M${x} ${nextY + bendHeight}`
    }

    pathData += `L${x} ${nextY}`
    lastX = x
    lastY = nextY
  })

  if (maxBendValue > 0) {
    arrowPath = `M${lastX - 3} ${lastY + 4}L${lastX} ${lastY}L${lastX + 3} ${lastY + 4}`
  }

  bends.push({
    path: pathData,
    arrowPath,
    valueText: getBendValueText(maxBendValue),
    textX: lastX,
    textY: lastY - 5,
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectTieEffect(context: NoteEffectContext, ties: ArcEffect[]): void {
  if (!context.rawNote?.tied || context.beatIndex === 0) {
    return
  }

  const prevBeatX = getBeatX(context.input, context.beatIndex - 1)
  const prevBeatWidth = getBeatWidth(context.input, context.beatIndex - 1)
  const startX = prevBeatX + prevBeatWidth / 2 + 8
  const endX = context.beatX + context.beatWidth / 2 - 5
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

  const nextBeatX = getBeatX(context.input, context.beatIndex + 1)
  const nextBeatWidth = getBeatWidth(context.input, context.beatIndex + 1)
  const startX = context.beatX + context.beatWidth / 2 + 8
  const endX = nextBeatX + nextBeatWidth / 2 - 5
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

  const startX = context.beatX + context.beatWidth / 2 + 5
  const waveY = context.yPos - 18
  const width = Math.min(context.beatWidth * 0.7, 30)

  vibratos.push({
    path: createWavePath(startX, waveY, width),
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectHarmonicEffect(context: NoteEffectContext, beatEffects: string[]): void {
  if (context.note?.naturalHarmonic) {
    beatEffects.push('N.H.')
  } else if (context.note?.artificialPresent) {
    beatEffects.push('A.H.')
  }
}

function collectLetRingToken(rawNote: TabNoteData | null, beatEffects: string[]): void {
  if (rawNote?.letRing) {
    beatEffects.push('let ring')
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
    x: context.beatX + context.beatWidth / 2 - 5,
    y: getBeamY(context.input) + 4,
    lines,
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectGraceNoteEffect(context: NoteEffectContext, graceNotes: GraceNoteEffect[]): void {
  if (!context.note?.gracePresent || !context.note.graceObj) {
    return
  }

  const graceX = context.beatX + 3
  const mainNoteX = context.beatX + context.beatWidth / 2

  graceNotes.push({
    x: graceX,
    y: context.yPos + 4,
    fret: context.note.graceObj.fret,
    slurPath: `M${graceX + 5} ${context.yPos - 5}C${graceX + 10} ${context.yPos - 12}, ${mainNoteX - 5} ${context.yPos - 12}, ${mainNoteX} ${context.yPos - 5}`,
    beatIndex: context.beatIndex,
    stringIndex: context.stringIndex,
  })
}

function collectBeatTextTokens(rawNote: TabNoteData | null, beatEffects: string[]): void {
  ;([
    ['palmMute', 'P.M.'],
    ['tap', 'T'],
    ['pop', 'P'],
    ['slap', 'S'],
    ['stacatto', '•'],
    ['fadeIn', '≺'],
    ['accentuated', '>'],
    ['heavyAccentuated', '^'],
  ] as const).forEach(([propertyName, label]) => {
    if (rawNote?.[propertyName]) {
      beatEffects.push(label)
    }
  })
}

function collectTrillEffect(context: NoteEffectContext, trills: TrillEffect[]): void {
  if (!context.rawNote?.trillPresent) {
    return
  }

  const centerX = context.beatX + context.beatWidth / 2
  const waveY = context.yPos - 18
  const width = Math.min(context.beatWidth * 0.6, 25)

  trills.push({
    textX: centerX - 8,
    textY: waveY + 5,
    path: createWavePath(centerX + 4, waveY, width),
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
  collectLetRingToken(context.rawNote, beatEffects)
  collectTremoloPickingEffect(context, collections.tremoloPickings)
  collectGraceNoteEffect(context, collections.graceNotes)
  collectBeatTextTokens(context.rawNote, beatEffects)
}

const TEXT_EFFECT_BASE_Y = -20
const TEXT_EFFECT_SECOND_ROW_Y = -32
const TEXT_EFFECT_HORIZONTAL_GAP = 36

function appendBeatTextEffects(
  context: BeatEffectContext,
  textEffects: TextEffect[],
  beatEffects: string[],
): void {
  const labels = [...new Set(beatEffects)]
  if (labels.length === 0) {
    return
  }

  const centerX = context.beatX + context.beatWidth / 2

  if (labels.length === 1) {
    textEffects.push({
      text: labels[0],
      x: centerX,
      y: TEXT_EFFECT_BASE_Y,
      fontSize: getFontSizeForEffect(labels[0]),
      beatIndex: context.beatIndex,
    })
    return
  }

  if (labels.length <= 3) {
    const span = (labels.length - 1) * TEXT_EFFECT_HORIZONTAL_GAP
    labels.forEach((effectText, index) => {
      textEffects.push({
        text: effectText,
        x: centerX - span / 2 + index * TEXT_EFFECT_HORIZONTAL_GAP,
        y: TEXT_EFFECT_BASE_Y,
        fontSize: getFontSizeForEffect(effectText),
        beatIndex: context.beatIndex,
      })
    })
    return
  }

  const firstRowCount = Math.ceil(labels.length / 2)
  const rows = [labels.slice(0, firstRowCount), labels.slice(firstRowCount)]
  const rowYs = [TEXT_EFFECT_BASE_Y, TEXT_EFFECT_SECOND_ROW_Y]

  rows.forEach((rowLabels, rowIndex) => {
    if (rowLabels.length === 0) {
      return
    }

    const span = (rowLabels.length - 1) * TEXT_EFFECT_HORIZONTAL_GAP
    rowLabels.forEach((effectText, index) => {
      textEffects.push({
        text: effectText,
        x: centerX - span / 2 + index * TEXT_EFFECT_HORIZONTAL_GAP,
        y: rowYs[rowIndex],
        fontSize: getFontSizeForEffect(effectText),
        beatIndex: context.beatIndex,
      })
    })
  })
}

function collectTremoloBarEffect(context: BeatEffectContext, tremoloBars: TremoloBarEffect[]): void {
  const tremoloBar = context.beat?.effects?.tremoloBar as TremoloBarPoint[] | undefined
  if (!context.beat?.effects?.tremoloBarPresent || !tremoloBar) {
    return
  }

  const startX = context.beatX + context.beatWidth / 2
  const startY = getBeamY(context.input) + 10
  let pathData = `M${startX} ${startY}`

  tremoloBar.forEach((point: TremoloBarPoint) => {
    pathData += `L${startX + (point.position || 0) / 4} ${startY + (point.value || 0) / 10}`
  })

  tremoloBars.push({
    path: pathData,
    beatIndex: context.beatIndex,
  })
}

function hasLetRing(beat: TabBeat | undefined): boolean {
  return beat?.notes?.some((note: TabNoteData | null) => note?.letRing) === true
}

function getLetRingEndBeatIndex(context: BeatEffectContext): number {
  let endBeatIndex = context.beatIndex

  for (let index = context.beatIndex + 1; index < context.input.measureData.length; index++) {
    if (hasLetRing(context.input.measureData[index])) {
      endBeatIndex = index
      continue
    }

    break
  }

  return endBeatIndex
}

function collectLetRingEffect(context: BeatEffectContext, letRings: LetRingEffect[]): void {
  if (!hasLetRing(context.beat) || hasLetRing(context.input.measureData[context.beatIndex - 1])) {
    return
  }

  const endBeatIndex = getLetRingEndBeatIndex(context)
  letRings.push({
    x: context.beatX + context.beatWidth / 2,
    y: (context.input.numStrings - 1) * context.input.stringSpacing + 10,
    lineEndX: getBeatX(context.input, endBeatIndex) + getBeatWidth(context.input, endBeatIndex),
  })
}

function collectBeatLevelEffects(context: BeatEffectContext, collections: TabEffectCollections): void {
  collectTremoloBarEffect(context, collections.tremoloBars)
  collectLetRingEffect(context, collections.letRings)
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