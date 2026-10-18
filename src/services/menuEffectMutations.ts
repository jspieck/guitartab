import type { Beat, MeasureMeta, Note } from '../types/tab'
import { MENU_EFFECT_GROUPS, MENU_NOTE_PROPERTY_BY_BUTTON_ID } from '../utils/menuUiState'
import { beatHasText } from './songMigrations'

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

/**
 * One effect's state as recorded for undo: true/false for plain toggles, the
 * effect's data (or undefined when absent) for effects that carry data.
 */
export type MenuEffectState = boolean | string | number | object | undefined

interface OptionalEffect {
  /** The effect's data, or undefined when it is off. */
  get(beat: Beat, note: Note | null, measureMeta: MeasureMeta): unknown
  set(beat: Beat, note: Note | null, measureMeta: MeasureMeta, value: unknown): void
  remove(beat: Beat, note: Note | null, measureMeta: MeasureMeta): void
  /** Data used when the effect is switched on without its modal (and on redo). */
  create?(beat: Beat, note: Note | null): unknown
  /** Overrides `get() != null` as the on/off test. */
  isOn?(beat: Beat, note: Note | null, measureMeta: MeasureMeta): boolean
}

type OptionalNoteKey = 'bendObj' | 'trill' | 'graceObj' | 'artificialStyle'

function noteEffect<K extends OptionalNoteKey>(
  key: K,
  create: (note: Note) => NonNullable<Note[K]>,
): OptionalEffect {
  return {
    get: (_beat, note) => note?.[key],
    set: (_beat, note, _meta, value) => {
      if (note) note[key] = value as Note[K]
    },
    remove: (_beat, note) => {
      if (note) delete note[key]
    },
    create: (_beat, note) => (note ? create(note) : undefined),
  }
}

// Data-carrying effects. Most are added through a modal, which sets the data;
// the menu switches them off by removing it.
const OPTIONAL_EFFECTS: Partial<Record<string, OptionalEffect>> = {
  bend: noteEffect('bendObj', () => [
    { bendPosition: 0, bendValue: 0, vibrato: 0 },
    { bendPosition: 60, bendValue: 4, vibrato: 0 },
  ]),
  trill: noteEffect('trill', (note) => ({ fret: note.fret + 1, period: 4 })),
  grace: noteEffect('graceObj', () => ({
    duration: 's',
    setOnBeat: 'before',
    dynamic: 'f',
    transition: 'none',
    fret: 0,
    string: 0,
    height: 0,
    dead: false,
  })),
  artificial: noteEffect('artificialStyle', () => 'N.H.'),
  stroke: {
    get: (beat) => beat.effects.stroke,
    set: (beat, _note, _meta, value) => {
      beat.effects.stroke = value as Beat['effects']['stroke']
    },
    remove: (beat) => {
      delete beat.effects.stroke
    },
    create: () => ({ strokeLength: 8, strokeType: 'down' }),
  },
  tremoloBar: {
    get: (beat) => beat.effects.tremoloBar,
    set: (beat, _note, _meta, value) => {
      beat.effects.tremoloBar = value as Beat['effects']['tremoloBar']
    },
    remove: (beat) => {
      delete beat.effects.tremoloBar
    },
  },
  addText: {
    get: (beat) => beat.text,
    set: (beat, _note, _meta, value) => {
      beat.text = value as string
    },
    remove: (beat) => {
      delete beat.text
    },
    isOn: (beat) => beatHasText(beat),
  },
  addChord: {
    get: (beat) => beat.chord,
    set: (beat, _note, _meta, value) => {
      beat.chord = value as Beat['chord']
    },
    remove: (beat) => {
      delete beat.chord
    },
  },
  addMarker: {
    get: (_beat, _note, meta) => meta.marker,
    set: (_beat, _note, meta, value) => {
      meta.marker = value as MeasureMeta['marker']
    },
    remove: (_beat, _note, meta) => {
      delete meta.marker
    },
  },
  repeatAlternative: {
    get: (_beat, _note, meta) => meta.repeatAlternative,
    set: (_beat, _note, meta, value) => {
      meta.repeatAlternative = value as number
    },
    remove: (_beat, _note, meta) => {
      delete meta.repeatAlternative
    },
  },
  closeBar: {
    get: (_beat, _note, meta) => meta.repeatClose,
    set: (_beat, _note, meta, value) => {
      meta.repeatClose = value as number
    },
    remove: (_beat, _note, meta) => {
      delete meta.repeatClose
    },
    create: () => 1,
  },
  bpmMeter: {
    get: (_beat, _note, meta) => meta.bpm,
    set: (_beat, _note, meta, value) => {
      meta.bpm = value as number
    },
    remove: (_beat, _note, meta) => {
      delete meta.bpm
    },
  },
}

function isNoteLevel(effectId: string): boolean {
  return effectId === 'bend' || effectId === 'trill' || effectId === 'grace' || effectId === 'artificial'
}

function copyState(value: unknown): MenuEffectState {
  // Song data is reactive; a JSON round trip gives a plain, detached copy.
  return value != null && typeof value === 'object'
    ? JSON.parse(JSON.stringify(value))
    : (value as MenuEffectState)
}

export function getMenuEffectVariable(
  beat: Beat,
  note: Note | null,
  effectId: string,
  measureMeta: MeasureMeta,
): boolean {
  const noteProperty = MENU_NOTE_PROPERTY_BY_BUTTON_ID[effectId]
  if (note != null && noteProperty) {
    return Boolean(note[noteProperty])
  }

  const optional = OPTIONAL_EFFECTS[effectId]
  if (optional) {
    if (isNoteLevel(effectId) && note == null) return false
    return optional.isOn
      ? optional.isOn(beat, note, measureMeta)
      : optional.get(beat, note, measureMeta) != null
  }

  switch (effectId) {
    case 'timeMeter':
      return measureMeta.timeMeterPresent
    case 'openBar':
      return measureMeta.repeatOpen
    default:
      if (effectId.endsWith('Dynamic')) {
        return beat.dynamicPresent
      }
      return false
  }
}

/** The effect's current state, detached from the song, for undo. */
export function captureMenuEffectState(
  beat: Beat,
  note: Note | null,
  effectId: string,
  measureMeta: MeasureMeta,
): MenuEffectState {
  const optional = OPTIONAL_EFFECTS[effectId]
  if (optional && !(isNoteLevel(effectId) && note == null)) {
    return copyState(optional.get(beat, note, measureMeta))
  }
  return getMenuEffectVariable(beat, note, effectId, measureMeta)
}

/**
 * Switches an effect on (`true`), off (`false`/`undefined`) or restores a state
 * captured with `captureMenuEffectState`.
 */
export function setMenuEffectVariable(
  beat: Beat,
  note: Note | null,
  effectId: string,
  value: MenuEffectState,
  measureMeta: MeasureMeta,
): void {
  const noteProperty = MENU_NOTE_PROPERTY_BY_BUTTON_ID[effectId]
  if (note != null && noteProperty) {
    note[noteProperty] = Boolean(value) as never
    return
  }

  const optional = OPTIONAL_EFFECTS[effectId]
  if (optional) {
    if (value === false || value == null) {
      optional.remove(beat, note, measureMeta)
    } else if (value === true) {
      if (optional.get(beat, note, measureMeta) == null && optional.create) {
        const created = optional.create(beat, note)
        if (created != null) optional.set(beat, note, measureMeta, created)
      }
    } else {
      optional.set(beat, note, measureMeta, copyState(value))
    }
    return
  }

  const on = Boolean(value)
  switch (effectId) {
    case 'timeMeter':
      measureMeta.timeMeterPresent = on
      break
    case 'openBar':
      measureMeta.repeatOpen = on
      break
    default:
      if (effectId.endsWith('Dynamic')) {
        beat.dynamicPresent = on
      }
      break
  }
}

export function deactivateMenuEffectsInGroup(
  beat: Beat,
  note: Note | null,
  effectIds: readonly string[],
  measureMeta: MeasureMeta,
): void {
  effectIds.forEach((effectId) => {
    setMenuEffectVariable(beat, note, effectId, false, measureMeta)
  })
}

export function applyMenuEffectCollision(
  beat: Beat,
  note: Note | null,
  effectGroupIndex: number,
  effectId: string,
  isVariableSet: boolean,
  measureMeta: MeasureMeta,
): Record<string, MenuEffectState> {
  const effectGroup = MENU_EFFECT_GROUPS[effectGroupIndex]
  const previousValues: Record<string, MenuEffectState> = {}

  effectGroup.forEach((groupEffectId) => {
    previousValues[groupEffectId] = captureMenuEffectState(beat, note, groupEffectId, measureMeta)
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
  getBeat: (noteRef: MenuEffectNoteRef) => Beat,
  getMeasureMeta: (blockId: number) => MeasureMeta,
): Record<string, Record<string, MenuEffectState>> {
  const changes: Record<string, Record<string, MenuEffectState>> = {}
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
  getBeat: (beatRef: MenuEffectBeatRef) => Beat,
  getMeasureMeta: (blockId: number) => MeasureMeta,
): Record<string, { string: number; effects: Record<string, MenuEffectState> }[]> {
  const changes: Record<string, { string: number; effects: Record<string, MenuEffectState> }[]> = {}
  const effectGroupIndex = findEffectGroupIndex(effectId)
  if (effectGroupIndex < 0) {
    return changes
  }

  for (const beatRef of beats) {
    const beat = getBeat(beatRef)
    const measureMeta = getMeasureMeta(beatRef.blockId)
    const beatKey = `${beatRef.trackId}_${beatRef.blockId}_${beatRef.voiceId}_${beatRef.beatId}`
    const changedEffects: { string: number; effects: Record<string, MenuEffectState> }[] = []

    for (let string = 0; string < beat.notes.length; string += 1) {
      const note = beat.notes[string]
      if (note == null) {
        continue
      }

      changedEffects.push({
        string,
        effects: applyMenuEffectCollision(beat, note, effectGroupIndex, effectId, isVariableSet, measureMeta),
      })
    }

    changes[beatKey] = changedEffects
  }

  return changes
}

export { MENU_EFFECT_GROUPS as menuEffectGroups }
