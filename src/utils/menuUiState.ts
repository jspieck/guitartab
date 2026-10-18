import Duration from '../assets/js/duration'
import type { Beat, MeasureMeta, Note, NoteLengthCode } from '../types/tab'
import { beatHasText } from '../services/songMigrations'

export const MENU_EFFECT_GROUPS = [
  ['pullDown', 'slide', 'bend'],
  ['trill'],
  ['tremoloPicking'],
  ['tremoloBar'],
  ['dead'],
  ['stacatto', 'palmMute'],
  ['tap', 'slap', 'pop'],
  ['fadeIn'],
  ['grace'],
  ['vibrato'],
  ['artificial'],
  ['accentuated', 'heavyAccentuated', 'ghost'],
  ['stroke'],
  ['addChord'],
  ['addText'],
  ['addMarker'],
  ['repeatAlternative'],
  ['pppDynamic', 'ppDynamic', 'pDynamic', 'mpDynamic', 'mfDynamic', 'fDynamic', 'ffDynamic', 'fffDynamic'],
  ['openBar'],
  ['closeBar'],
  ['timeMeter'],
  ['bpmMeter'],
  ['letRing'],
] as const

export const MENU_NOTE_EFFECT_BUTTON_IDS = [
  'pullDown',
  'ghost',
  'stacatto',
  'accentuated',
  'heavyAccentuated',
  'palmMute',
  'vibrato',
  'tremoloBar',
  'artificial',
  'trill',
  'bend',
  'slide',
  'tap',
  'fadeIn',
  'grace',
  'slap',
  'pop',
  'dead',
  'tremoloPicking',
  'stroke',
  'letRing',
] as const

/** Note effects stored as plain booleans. Data-carrying ones live in menuEffectMutations. */
export const MENU_NOTE_PROPERTY_BY_BUTTON_ID: Record<string, keyof Note> = {
  tap: 'tap',
  slide: 'slide',
  fadeIn: 'fadeIn',
  pullDown: 'pullDown',
  stacatto: 'stacatto',
  accentuated: 'accentuated',
  dead: 'dead',
  heavyAccentuated: 'heavyAccentuated',
  palmMute: 'palmMute',
  vibrato: 'vibrato',
  slap: 'slap',
  pop: 'pop',
  tremoloPicking: 'tremoloPicking',
  letRing: 'letRing',
  ghost: 'ghost',
}

export const NOTE_LENGTH_BUTTON_BY_CODE: Record<NoteLengthCode, string> = {
  w: 'wholeNote',
  h: 'halfNote',
  q: 'quarterNote',
  e: '8thNote',
  s: '16thNote',
  t: '32ndNote',
  z: '64thNote',
  o: '128thNote',
}

export const DEFAULT_TUPLET_OPTIONS = [3, 5, 6, 7, 9, 11]

export interface DerivedMenuSelectionState {
  pressedButtonIds: string[]
  disabledButtonIds: string[]
  noteLengthButtonId: string
  availableTuplets: number[]
  selectedTuplet: string
}

const NOTE_BEAT_EFFECT_LABELS: Array<{ property: keyof Note; buttonId: string }> = [
  { property: 'bendObj', buttonId: 'bend' },
  { property: 'artificialStyle', buttonId: 'artificial' },
  { property: 'tap', buttonId: 'tap' },
  { property: 'slide', buttonId: 'slide' },
  { property: 'fadeIn', buttonId: 'fadeIn' },
  { property: 'graceObj', buttonId: 'grace' },
  { property: 'pullDown', buttonId: 'pullDown' },
  { property: 'stacatto', buttonId: 'stacatto' },
  { property: 'accentuated', buttonId: 'accentuated' },
  { property: 'trill', buttonId: 'trill' },
  { property: 'dead', buttonId: 'dead' },
  { property: 'heavyAccentuated', buttonId: 'heavyAccentuated' },
  { property: 'palmMute', buttonId: 'palmMute' },
  { property: 'vibrato', buttonId: 'vibrato' },
  { property: 'slap', buttonId: 'slap' },
  { property: 'pop', buttonId: 'pop' },
  { property: 'tremoloPicking', buttonId: 'tremoloPicking' },
  { property: 'letRing', buttonId: 'letRing' },
  { property: 'ghost', buttonId: 'ghost' },
]

function getDynamicButtonId(beat: Beat): string | null {
  return beat.dynamicPresent && beat.dynamic ? `${beat.dynamic}Dynamic` : null
}

export function getNoteLengthButtonId(duration: string): string {
  return NOTE_LENGTH_BUTTON_BY_CODE[duration[0] as NoteLengthCode] ?? NOTE_LENGTH_BUTTON_BY_CODE.e
}

export function getAvailableTupletOptions(duration: string): number[] {
  const noteDuration = Duration.getDurationOfType(duration)
  const tuplets: number[] = []

  if (noteDuration >= 2) {
    tuplets.push(3)
  }
  if (noteDuration >= 4) {
    tuplets.push(5, 6, 7)
  }
  if (noteDuration >= 8) {
    tuplets.push(9, 10, 11, 12, 13)
  }

  return tuplets
}

function collectPressedModifierButtons(beat: Beat, note: Note | null | undefined, pressedButtonIds: Set<string>): void {
  if (beat.dotted) pressedButtonIds.add('dotted')
  if (beat.doubleDotted) pressedButtonIds.add('doubleDotted')
  if (beat.tuplet != null) pressedButtonIds.add('tuplet')
  if (note?.tied) pressedButtonIds.add('tied')
}

function collectPressedNoteButtons(note: Note | null | undefined, pressedButtonIds: Set<string>): void {
  if (!note) {
    return
  }

  NOTE_BEAT_EFFECT_LABELS.forEach(({ property, buttonId }) => {
    const value = note[property]
    if (value != null && value !== false) {
      pressedButtonIds.add(buttonId)
    }
  })
}

function collectPressedBeatButtons(beat: Beat, pressedButtonIds: Set<string>): void {
  if (beat.effects.stroke != null) pressedButtonIds.add('stroke')
  if (beat.effects.tremoloBar != null) pressedButtonIds.add('tremoloBar')
  if (beatHasText(beat)) pressedButtonIds.add('addText')
  if (beat.chord != null) pressedButtonIds.add('addChord')

  const dynamicButtonId = getDynamicButtonId(beat)
  if (dynamicButtonId) {
    pressedButtonIds.add(dynamicButtonId)
  }
}

function collectPressedMeasureButtons(measureMeta: MeasureMeta, pressedButtonIds: Set<string>): void {
  if (measureMeta.marker != null) pressedButtonIds.add('addMarker')
  if (measureMeta.repeatAlternative != null) pressedButtonIds.add('repeatAlternative')
  if (measureMeta.repeatClose != null) pressedButtonIds.add('closeBar')
  if (measureMeta.repeatOpen) pressedButtonIds.add('openBar')
  if (measureMeta.timeMeterPresent) pressedButtonIds.add('timeMeter')
  if (measureMeta.bpm != null) pressedButtonIds.add('bpmMeter')
}

function collectDisabledButtons(
  beat: Beat,
  note: Note | null | undefined,
  options: { canTie: boolean; hasOverlaySelection: boolean },
): string[] {
  const disabledButtonIds = new Set<string>()

  if (!note && !options.hasOverlaySelection) {
    MENU_NOTE_EFFECT_BUTTON_IDS.forEach((buttonId) => {
      disabledButtonIds.add(buttonId)
    })
  }

  if (!note?.tied && !options.canTie) {
    disabledButtonIds.add('tied')
  }

  if (beat.duration[0] === 'z' && beat.tuplet == null) {
    disabledButtonIds.add('tuplet')
  }

  return [...disabledButtonIds]
}

export function deriveMenuSelectionState(
  beat: Beat,
  note: Note | null | undefined,
  measureMeta: MeasureMeta,
  options: { canTie: boolean; hasOverlaySelection: boolean },
): DerivedMenuSelectionState {
  const pressedButtonIds = new Set<string>()
  const noteLengthButtonId = getNoteLengthButtonId(beat.duration)
  const availableTuplets = getAvailableTupletOptions(beat.duration)

  pressedButtonIds.add(noteLengthButtonId)

  collectPressedModifierButtons(beat, note, pressedButtonIds)
  collectPressedNoteButtons(note, pressedButtonIds)
  collectPressedBeatButtons(beat, pressedButtonIds)
  collectPressedMeasureButtons(measureMeta, pressedButtonIds)

  return {
    pressedButtonIds: [...pressedButtonIds],
    disabledButtonIds: collectDisabledButtons(beat, note, options),
    noteLengthButtonId,
    availableTuplets,
    selectedTuplet: (beat.tuplet ?? availableTuplets[0] ?? DEFAULT_TUPLET_OPTIONS[0]).toString(),
  }
}