import { MODALS, type ModalDefinition } from '../assets/js/modals/modalTypes'
import type { Beat, MeasureMeta, Note } from '../types/tab'
import { beatHasText } from './songMigrations'

const DYNAMIC_VALUE_BY_ID: Record<string, string> = {
  pppDynamic: 'ppp',
  ppDynamic: 'pp',
  pDynamic: 'p',
  mpDynamic: 'mp',
  mfDynamic: 'mf',
  fDynamic: 'f',
  ffDynamic: 'ff',
  fffDynamic: 'fff',
}

interface ModalRequest {
  modal: ModalDefinition
  params: Record<string, unknown>
}

interface NotationModalContext {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  beat: Beat
  measureMeta: MeasureMeta
}

export interface NoteEffectSelection {
  notes: {
    trackId: number
    blockId: number
    voiceId: number
    beatId: number
    string: number
    note: Note
  }[]
  blocks: number[]
  beats: {
    trackId: number
    blockId: number
    voiceId: number
    beatId: number
    beat: Beat
  }[]
}

const NOTATION_MODAL_BUILDERS: Partial<
  Record<string, (context: NotationModalContext) => ModalRequest | null>
> = {
  addText: ({ trackId, blockId, voiceId, beatId, beat }) =>
    beatHasText(beat) ? null : { modal: MODALS.TEXT, params: { trackId, blockId, voiceId, beatId, beat } },
  addChord: ({ trackId, blockId, voiceId, beatId, beat }) =>
    beat.chord != null ? null : { modal: MODALS.ADD_CHORD, params: { trackId, blockId, voiceId, beatId } },
  addMarker: ({ trackId, blockId, voiceId, measureMeta }) =>
    measureMeta.marker != null ? null : { modal: MODALS.MARKER, params: { trackId, blockId, voiceId } },
  repeatAlternative: ({ trackId, blockId, voiceId, measureMeta }) =>
    measureMeta.repeatAlternative != null
      ? null
      : { modal: MODALS.REPEAT_ALTERNATIVE, params: { trackId, blockId, voiceId } },
  closeBar: ({ trackId, blockId, voiceId, measureMeta }) =>
    measureMeta.repeatClose != null
      ? null
      : { modal: MODALS.REPETITION, params: { trackId, blockId, voiceId, isRepetition: true } },
  timeMeter: ({ trackId, blockId, voiceId, measureMeta }) =>
    blockId !== 0 && measureMeta.timeMeterPresent
      ? null
      : { modal: MODALS.TIME_METER, params: { trackId, blockId, voiceId } },
  bpmMeter: ({ trackId, blockId, voiceId, measureMeta }) =>
    measureMeta.bpm != null ? null : { modal: MODALS.TEMPO, params: { trackId, blockId, voiceId } },
}

type NoteEffectModalBuilder = (
  selection: NoteEffectSelection,
  isVariableSet: boolean | null | undefined,
) => ModalRequest

const NOTE_EFFECT_MODAL_BUILDERS: Partial<Record<string, NoteEffectModalBuilder>> = {
  bend: (selection, isVariableSet) => ({
    modal: MODALS.BEND,
    params: { ...selection, isVariableSet },
  }),
  artificial: (selection) => ({
    modal: MODALS.ARTIFICIAL,
    params: { ...selection },
  }),
  tremoloBar: (selection, isVariableSet) => ({
    modal: MODALS.TREMOLO_BAR,
    params: { ...selection, isVariableSet },
  }),
  tremoloPicking: (selection, isVariableSet) => ({
    modal: MODALS.TREMOLO_PICKING,
    params: { ...selection, isVariableSet },
  }),
  grace: (selection) => ({
    modal: MODALS.GRACE,
    params: { ...selection },
  }),
  stroke: (selection) => ({
    modal: MODALS.STROKE,
    params: { ...selection },
  }),
}

export function getDynamicValue(id: string): string {
  return DYNAMIC_VALUE_BY_ID[id] ?? ''
}

export function findMenuEffectGroup(
  id: string,
  effectGroups: readonly (readonly string[])[],
): string[] | null {
  const effectGroup = effectGroups.find((group) => group.some((effectId) => effectId === id))
  return effectGroup ? [...effectGroup] : null
}

export function resolveNotationModalRequest(
  id: string,
  isRevert: boolean,
  context: NotationModalContext,
): ModalRequest | null {
  if (isRevert) {
    return null
  }

  const buildRequest = NOTATION_MODAL_BUILDERS[id]
  return buildRequest ? buildRequest(context) : null
}

export function resolveNoteEffectModalRequest(
  id: string,
  isVariableSet: boolean | null | undefined,
  isRevert: boolean,
  selection: NoteEffectSelection,
): ModalRequest | null {
  const shouldOpenModal = isRevert === false && (isVariableSet == null || isVariableSet === false)
  if (!shouldOpenModal) {
    return null
  }

  const buildRequest = NOTE_EFFECT_MODAL_BUILDERS[id]
  return buildRequest ? buildRequest(selection, isVariableSet) : null
}

export function findPreviousTimeMeterChange(blockId: number, measureMeta: MeasureMeta[]): number {
  const currentNumerator = measureMeta[blockId].numerator
  const currentDenominator = measureMeta[blockId].denominator
  let foundBlock = 0

  for (let currentBlockId = blockId - 1; currentBlockId >= 0; currentBlockId -= 1) {
    if (
      currentNumerator !== measureMeta[currentBlockId].numerator ||
      currentDenominator !== measureMeta[currentBlockId].denominator
    ) {
      foundBlock = currentBlockId
      break
    }
  }

  return foundBlock
}

export function applyTimeMeterToFollowingBlocks(
  blockId: number,
  measureMeta: MeasureMeta[],
  numerator: number,
  denominator: number,
): void {
  for (let currentBlockId = blockId; currentBlockId < measureMeta.length; currentBlockId += 1) {
    if (measureMeta[currentBlockId].timeMeterPresent) {
      break
    }

    measureMeta[currentBlockId].numerator = numerator
    measureMeta[currentBlockId].denominator = denominator
  }
}
