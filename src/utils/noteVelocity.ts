import type { Beat, Note } from '../types/song'

/**
 * MIDI velocity of a note from its beat's dynamic: what the SoundFont player picks its
 * velocity layer with and what MIDI export writes, so the two sound alike.
 */

export const DEFAULT_VELOCITY = 100
const GHOST_VELOCITY = 45

export const DYNAMIC_VELOCITY: Record<string, number> = {
  ppp: 16,
  pp: 33,
  p: 49,
  mp: 64,
  mf: 80,
  f: 96,
  ff: 112,
  fff: 127,
}

export function velocityOf(beat: Pick<Beat, 'dynamic'>, note: Pick<Note, 'ghost'> | null): number {
  const velocity = (beat.dynamic != null ? DYNAMIC_VELOCITY[beat.dynamic] : undefined) ?? DEFAULT_VELOCITY
  return note?.ghost ? Math.min(velocity, GHOST_VELOCITY) : velocity
}
