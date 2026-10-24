import type { BeatDuration } from '../types/tab'

/**
 * Tuplet bookkeeping: each tuplet group has an id (`beat.tupletId`) and the
 * plain length it replaces (a triplet of eighths replaces a quarter), which
 * duration changes, removing the tuplet and classical notation need.
 */
export const tupletState = {
  /** The replaced length per tuplet id; '' for a removed tuplet. */
  groups: [] as { originalDuration: BeatDuration | '' }[],
  /** Id for the next tuplet the user creates. */
  nextId: 0,
  /** Numbering while bars are filled (`fillBeat`): last id handed out, beats left in the group. */
  fillId: 0,
  fillRemaining: 0,
}
