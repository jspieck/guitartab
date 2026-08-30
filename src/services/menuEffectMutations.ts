import type { Measure, MeasureMeta, Note } from '../types/tab'
import { MENU_EFFECT_GROUPS, MENU_NOTE_PROPERTY_BY_BUTTON_ID } from '../utils/menuUiState'

export interface MenuEffectNoteRef {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
  string: number
}

export interface MenuEffectBeatRef {
  trackId: number
  blockId: number
  voiceId: number
  beatId: number
}

export function getMenuEffectVariable(
  beat: Measure,
  note: Note | null,
  effectId: string,
  measureMeta: MeasureMeta,
): boolean {
  const noteProperty = MENU_NOTE_PROPERTY_BY_BUTTON_ID[effectId]
  if (note != null && noteProperty) {
    return Boolean(note[noteProperty])
  }

  switch (effectId) {
    case 'tremoloBar':
      return beat.effects.tremoloBarPresent
    case 'stroke':
      return beat.effects.strokePresent
    case 'addText':
      return beat.textPresent
    case 'addChord':
      return beat.chordPresent
    case 'addMarker':
      return measureMeta.markerPresent
    case 'repeatAlternative':
      return measureMeta.repeatAlternativePresent
    case 'closeBar':
      return measureMeta.repeatClosePresent
    case 'timeMeter':
      return measureMeta.timeMeterPresent
    case 'bpmMeter':
      return measureMeta.bpmPresent
    case 'openBar':
      return measureMeta.repeatOpen
    default:
      if (effectId.endsWith('Dynamic')) {
        return beat.dynamicPresent
      }
      return false
  }
}

export function setMenuEffectVariable(
  beat: Measure,
  note: Note | null,
  effectId: string,
  value: boolean,
  measureMeta: MeasureMeta,
): void {
  const noteProperty = MENU_NOTE_PROPERTY_BY_BUTTON_ID[effectId]
  if (note != null && noteProperty) {
    note[noteProperty] = value as never
    return
  }

  switch (effectId) {
    case 'stroke':
      beat.effects.strokePresent = value
      break
    case 'tremoloBar':
      beat.effects.tremoloBarPresent = value
      break
    case 'addText':
      beat.textPresent = value
      break
    case 'addChord':
      beat.chordPresent = value
      break
    case 'addMarker':
      measureMeta.markerPresent = value
      break
    case 'repeatAlternative':
      measureMeta.repeatAlternativePresent = value
      break
    case 'closeBar':
      measureMeta.repeatClosePresent = value
      break
    case 'timeMeter':
      measureMeta.timeMeterPresent = value
      break
    case 'bpmMeter':
      measureMeta.bpmPresent = value
      break
    case 'openBar':
      measureMeta.repeatOpen = value
      break
    default:
      if (effectId.endsWith('Dynamic')) {
        beat.dynamicPresent = value
      }
      break
  }
}

export function deactivateMenuEffectsInGroup(
  beat: Measure,
  note: Note | null,
  effectIds: readonly string[],
  measureMeta: MeasureMeta,
): void {
  effectIds.forEach((effectId) => {
    setMenuEffectVariable(beat, note, effectId, false, measureMeta)
  })
}

export function applyMenuEffectCollision(
  beat: Measure,
  note: Note | null,
  effectGroupIndex: number,
  effectId: string,
  isVariableSet: boolean,
  measureMeta: MeasureMeta,
): Record<string, boolean> {
  const effectGroup = MENU_EFFECT_GROUPS[effectGroupIndex]
  const previousValues: Record<string, boolean> = {}

  effectGroup.forEach((groupEffectId) => {
    previousValues[groupEffectId] = getMenuEffectVariable(beat, note, groupEffectId, measureMeta)
  })

  if (isVariableSet == null || isVariableSet === false) {
    deactivateMenuEffectsInGroup(beat, note, effectGroup, measureMeta)
    setMenuEffectVariable(beat, note, effectId, true, measureMeta)
  } else {
    setMenuEffectVariable(beat, note, effectId, false, measureMeta)
  }

  return previousValues
}

function findEffectGroupIndex(effectId: string): number {
  return MENU_EFFECT_GROUPS.findIndex((group) => group.some((candidate) => candidate === effectId))
}

export function handleMenuEffectGroupCollision(
  notes: MenuEffectNoteRef[],
  effectId: string,
  isVariableSet: boolean,
  getBeat: (noteRef: MenuEffectNoteRef) => Measure,
  getMeasureMeta: (blockId: number) => MeasureMeta,
): Record<string, Record<string, boolean>> {
  const changes: Record<string, Record<string, boolean>> = {}
  const effectGroupIndex = findEffectGroupIndex(effectId)
  if (effectGroupIndex < 0) {
    return changes
  }

  for (const noteRef of notes) {
    const beat = getBeat(noteRef)
    const note = beat.notes[noteRef.string] ?? null
    const measureMeta = getMeasureMeta(noteRef.blockId)
    const noteKey = `${noteRef.trackId}_${noteRef.blockId}_${noteRef.voiceId}_${noteRef.beatId}_${noteRef.string}`

    changes[noteKey] = applyMenuEffectCollision(
      beat,
      note,
      effectGroupIndex,
      effectId,
      isVariableSet,
      measureMeta,
    )
  }

  return changes
}

export function handleMenuEffectGroupCollisionBeat(
  beats: MenuEffectBeatRef[],
  effectId: string,
  isVariableSet: boolean,
  getBeat: (beatRef: MenuEffectBeatRef) => Measure,
  getMeasureMeta: (blockId: number) => MeasureMeta,
): Record<string, { string: number; effects: Record<string, boolean> }[]> {
  const changes: Record<string, { string: number; effects: Record<string, boolean> }[]> = {}
  const effectGroupIndex = findEffectGroupIndex(effectId)
  if (effectGroupIndex < 0) {
    return changes
  }

  for (const beatRef of beats) {
    const beat = getBeat(beatRef)
    const measureMeta = getMeasureMeta(beatRef.blockId)
    const beatKey = `${beatRef.trackId}_${beatRef.blockId}_${beatRef.voiceId}_${beatRef.beatId}`
    const changedEffects: { string: number; effects: Record<string, boolean> }[] = []

    for (let string = 0; string < beat.notes.length; string += 1) {
      const note = beat.notes[string]
      if (note == null) {
        continue
      }

      changedEffects.push({
        string,
        effects: applyMenuEffectCollision(
          beat,
          note,
          effectGroupIndex,
          effectId,
          isVariableSet,
          measureMeta,
        ),
      })
    }

    changes[beatKey] = changedEffects
  }

  return changes
}

export { MENU_EFFECT_GROUPS as menuEffectGroups }
