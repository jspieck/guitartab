import type { DirectionJump, DirectionTarget } from '../types/song'

/**
 * Navigation signs (Guitar Pro's "directions"): targets (Segno, Coda, Fine) sit on a bar,
 * jumps (D.C., D.S., To Coda) are taken at the end of a bar. Both lists are in the order
 * Guitar Pro 5 stores them in its header.
 */

export const DIRECTION_TARGETS: readonly DirectionTarget[] = [
  'Coda',
  'DoubleCoda',
  'Segno',
  'SegnoSegno',
  'Fine',
]

export const DIRECTION_JUMPS: readonly DirectionJump[] = [
  'DaCapo',
  'DaCapoAlCoda',
  'DaCapoAlDoubleCoda',
  'DaCapoAlFine',
  'DaSegno',
  'DaSegnoAlCoda',
  'DaSegnoAlDoubleCoda',
  'DaSegnoAlFine',
  'DaSegnoSegno',
  'DaSegnoSegnoAlCoda',
  'DaSegnoSegnoAlDoubleCoda',
  'DaSegnoSegnoAlFine',
  'DaCoda',
  'DaDoubleCoda',
]

export const DIRECTION_LABELS: Record<DirectionTarget | DirectionJump, string> = {
  Segno: 'Segno',
  SegnoSegno: 'Segno Segno',
  Coda: 'Coda',
  DoubleCoda: 'Double Coda',
  Fine: 'Fine',
  DaCapo: 'D.C.',
  DaCapoAlCoda: 'D.C. al Coda',
  DaCapoAlDoubleCoda: 'D.C. al Double Coda',
  DaCapoAlFine: 'D.C. al Fine',
  DaSegno: 'D.S.',
  DaSegnoAlCoda: 'D.S. al Coda',
  DaSegnoAlDoubleCoda: 'D.S. al Double Coda',
  DaSegnoAlFine: 'D.S. al Fine',
  DaSegnoSegno: 'D.S.S.',
  DaSegnoSegnoAlCoda: 'D.S.S. al Coda',
  DaSegnoSegnoAlDoubleCoda: 'D.S.S. al Double Coda',
  DaSegnoSegnoAlFine: 'D.S.S. al Fine',
  DaCoda: 'To Coda',
  DaDoubleCoda: 'To Double Coda',
}

/** What playback does after a D.C./D.S. jump. */
export type JumpMode = 'toEnd' | 'alCoda' | 'alDoubleCoda' | 'alFine'

export interface JumpRule {
  /** where the jump goes: the song start or the bar with that sign */
  to: 'start' | DirectionTarget
  /** what playback looks for afterwards */
  then: JumpMode
  /** "To Coda" only jumps after a D.C./D.S. … al Coda */
  onlyIn?: JumpMode
}

const AFTER: Record<string, JumpMode> = {
  '': 'toEnd',
  AlCoda: 'alCoda',
  AlDoubleCoda: 'alDoubleCoda',
  AlFine: 'alFine',
}

export function jumpRule(jump: DirectionJump): JumpRule {
  if (jump === 'DaCoda') return { to: 'Coda', then: 'toEnd', onlyIn: 'alCoda' }
  if (jump === 'DaDoubleCoda') return { to: 'DoubleCoda', then: 'toEnd', onlyIn: 'alDoubleCoda' }
  const match = /^(DaCapo|DaSegnoSegno|DaSegno)(.*)$/.exec(jump)!
  const to = match[1] === 'DaCapo' ? 'start' : match[1] === 'DaSegno' ? 'Segno' : 'SegnoSegno'
  return { to, then: AFTER[match[2]] }
}

export function isDirectionTarget(value: string): value is DirectionTarget {
  return (DIRECTION_TARGETS as readonly string[]).includes(value)
}

export function isDirectionJump(value: string): value is DirectionJump {
  return (DIRECTION_JUMPS as readonly string[]).includes(value)
}
