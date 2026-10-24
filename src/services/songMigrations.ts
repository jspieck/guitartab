import type { Beat } from '../stores/song'

/**
 * Upgrades song data loaded from older .gt files (and autosave drafts) to the
 * current model. Each step is idempotent, so running it on current data is a
 * no-op. Add a step whenever a `fooPresent + foo` pair becomes an optional `foo`.
 */

type LegacyBeat = Beat & Record<string, unknown>

/** `textPresent: boolean` + `text: string` became `text?: string`. */
function migrateBeatText(beat: LegacyBeat): void {
  if ('textPresent' in beat) {
    const keep = beat.textPresent === true && typeof beat.text === 'string' && beat.text !== ''
    if (!keep) delete beat.text
    delete beat.textPresent
  }
}

/** `chordPresent: boolean` + `chord: Chord | null` became `chord?: Chord`. */
function migrateBeatChord(beat: LegacyBeat): void {
  if ('chordPresent' in beat) {
    if (beat.chordPresent !== true || beat.chord == null) delete beat.chord
    delete beat.chordPresent
  } else if (beat.chord === null) {
    delete beat.chord
  }
}

/** `effects.strokePresent/stroke` and `effects.tremoloBarPresent/tremoloBar` became optional fields. */
function migrateBeatEffects(beat: LegacyBeat): void {
  const effects = beat.effects as unknown as Record<string, unknown> | undefined
  if (effects == null) return
  if ('strokePresent' in effects) {
    if (effects.strokePresent !== true || effects.stroke == null) delete effects.stroke
    delete effects.strokePresent
  }
  if ('tremoloBarPresent' in effects) {
    if (effects.tremoloBarPresent !== true || !Array.isArray(effects.tremoloBar)) delete effects.tremoloBar
    delete effects.tremoloBarPresent
  }
}

// Note flag → optional data field it guards, and the type the data must have.
const NOTE_FLAGS: [flag: string, field: string, valid: (value: unknown) => boolean][] = [
  ['bendPresent', 'bendObj', (value) => Array.isArray(value) && value.length > 0],
  ['gracePresent', 'graceObj', (value) => value != null && typeof value === 'object'],
  ['trillPresent', 'trill', (value) => value != null && typeof value === 'object'],
  ['artificialPresent', 'artificialStyle', (value) => typeof value === 'string' && value !== ''],
]

/** Note `bendPresent/bendObj`, `gracePresent/graceObj`, `trillPresent/trill` and
 * `artificialPresent/artificialStyle` became optional fields. Old files also stored
 * default data on every note, which the flag then ignored. */
function migrateNoteEffects(beat: LegacyBeat): void {
  // Beats used to carry GPX-import helpers that were never read afterwards.
  delete beat.gracePresent
  delete beat.graceObj
  for (const note of (beat.notes ?? []) as (Record<string, unknown> | null)[]) {
    if (note == null) continue
    for (const [flag, field, valid] of NOTE_FLAGS) {
      if (!(flag in note)) continue
      if (note[flag] !== true || !valid(note[field])) delete note[field]
      delete note[flag]
    }
  }
}

const BEAT_STEPS: ((beat: LegacyBeat) => void)[] = [
  migrateBeatText,
  migrateBeatChord,
  migrateBeatEffects,
  migrateNoteEffects,
]

// Bar flag → optional field it guards.
const META_FLAGS: [flag: string, field: string][] = [
  ['bpmPresent', 'bpm'],
  ['markerPresent', 'marker'],
  ['repeatAlternativePresent', 'repeatAlternative'],
  ['repeatClosePresent', 'repeatClose'],
]

/**
 * `bpmPresent/bpm`, `markerPresent/marker`, `repeatAlternativePresent/repeatAlternative`
 * and `repeatClosePresent/repeatClose` became optional fields. Bar 0 always keeps a tempo.
 */
export function migrateMeasureMeta(measureMeta: unknown): void {
  if (!Array.isArray(measureMeta)) return
  measureMeta.forEach((meta: Record<string, unknown> | null, blockId) => {
    if (meta == null || typeof meta !== 'object') return
    for (const [flag, field] of META_FLAGS) {
      if (!(flag in meta)) continue
      const keep = meta[flag] === true || (field === 'bpm' && blockId === 0)
      if (!keep || meta[field] == null) delete meta[field]
      delete meta[flag]
    }
  })
}

/** Migrates `Song.measures` (track → block → voice → beat) in place. */
export function migrateSongMeasures(measures: unknown): void {
  if (!Array.isArray(measures)) return
  for (const track of measures) {
    for (const block of track ?? []) {
      for (const voice of block ?? []) {
        for (const beat of voice ?? []) {
          if (beat == null || typeof beat !== 'object') continue
          for (const step of BEAT_STEPS) step(beat as LegacyBeat)
        }
      }
    }
  }
}

/** True when the beat shows a text annotation. */
export function beatHasText<T extends Pick<Beat, 'text'>>(
  beat: T | null | undefined,
): beat is T & { text: string } {
  return typeof beat?.text === 'string' && beat.text !== ''
}
