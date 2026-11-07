import type { DirectionJump, DirectionTarget } from '../../types/song'
import { jumpRule, type JumpMode } from '../../utils/directions'

/**
 * The order bars play in: repeats (with how many passes), voltas, and the navigation signs
 * (D.C., D.S., al Coda, al Fine, To Coda). Pure. `nextPlayedBar` is one step, which the
 * scheduler's bar sequence follows (it adds the loop interval on top); `buildPlayOrder`
 * unrolls a whole song from a start bar.
 *
 * Conventions (as printed music is read): each jump is taken once; after a D.C./D.S. jump
 * repeats are not played again and the last volta of a repeat is taken; "To Coda" only
 * jumps after a D.C./D.S. al Coda, Fine only ends the song after a D.C./D.S. al Fine.
 */

export interface PlayOrderBar {
  repeatOpen?: boolean
  repeatClose?: number
  repeatAlternative?: number | null
  directionTargets?: DirectionTarget[]
  directionJumps?: DirectionJump[]
}

export interface PlayedBar {
  blockId: number
  /** pass through the repeat the bar belongs to (1 = first) */
  pass: number
  /** after a D.C./D.S. jump: what playback looks for next; null before any jump */
  mode: JumpMode | null
  /** bars whose jump has been taken */
  taken: readonly number[]
}

/** What the steps need to know about the song, worked out once per song. */
export interface PlayOrderContext {
  bars: readonly PlayOrderBar[]
  /** for each bar with a repeat sign: the bar its repeat jumps back to */
  jumpBack: readonly number[]
  /** the first bar carrying each sign */
  targets: Partial<Record<DirectionTarget, number>>
}

export function playOrderContext(bars: readonly PlayOrderBar[]): PlayOrderContext {
  const jumpBack: number[] = []
  const targets: Partial<Record<DirectionTarget, number>> = {}
  let lastRepeatOpen = 0
  bars.forEach((bar, blockId) => {
    if (bar.repeatOpen) lastRepeatOpen = blockId
    if (bar.repeatClose != null) jumpBack[blockId] = lastRepeatOpen
    bar.directionTargets?.forEach((target) => {
      targets[target] ??= blockId
    })
  })
  return { bars, jumpBack, targets }
}

export function startOfPlayOrder(blockId: number): PlayedBar {
  return { blockId, pass: 1, mode: null, taken: [] }
}

/** A volta that doesn't play on this pass is skipped for the next one that does (if any). */
export function skipAlternative(bars: readonly PlayOrderBar[], blockId: number, pass: number): number {
  const alternative = bars[blockId]?.repeatAlternative
  if (alternative == null || ((alternative >> (pass - 1)) & 1) === 1) return blockId
  for (let j = 1; j < 50 && bars[blockId + j] != null; j += 1) {
    const other = bars[blockId + j].repeatAlternative
    if (other != null && ((other >> (pass - 1)) & 1) === 1) return blockId + j
  }
  return blockId
}

/** The last pass of the repeat a bar starts or sits in (1 when it is in none). */
function lastPassFrom(bars: readonly PlayOrderBar[], blockId: number): number {
  for (let i = blockId; i < bars.length; i += 1) {
    if (i > blockId && bars[i].repeatOpen) return 1
    const close = bars[i].repeatClose
    if (close != null) return close + 1
  }
  return 1
}

/** Entering a bar after a jump: no repeats from here on, so it plays its repeat's last pass. */
function afterJumpTo(
  context: PlayOrderContext,
  blockId: number,
  mode: JumpMode,
  taken: readonly number[],
): PlayedBar {
  const pass = lastPassFrom(context.bars, blockId)
  return { blockId: skipAlternative(context.bars, blockId, pass), pass, mode, taken }
}

function takeJump(context: PlayOrderContext, current: PlayedBar): PlayedBar | null {
  const { blockId, mode, taken } = current
  if (taken.includes(blockId)) return null
  for (const jump of context.bars[blockId]?.directionJumps ?? []) {
    const rule = jumpRule(jump)
    if (rule.onlyIn != null && rule.onlyIn !== mode) continue
    const target = rule.to === 'start' ? 0 : context.targets[rule.to]
    if (target == null) continue
    return afterJumpTo(context, target, rule.then, [...taken, blockId])
  }
  return null
}

/** The bar after `current`; its `blockId` is `bars.length` when the song ends there. */
export function nextPlayedBar(context: PlayOrderContext, current: PlayedBar): PlayedBar {
  const { bars, jumpBack } = context
  const { blockId, pass, mode, taken } = current
  const bar = bars[blockId]
  const end = { blockId: bars.length, pass, mode, taken }
  if (bar == null) return end

  if (mode == null && bar.repeatClose != null && bar.repeatClose >= pass) {
    const back = jumpBack[blockId] ?? 0
    return { blockId: skipAlternative(bars, back, pass + 1), pass: pass + 1, mode, taken }
  }
  if (mode === 'alFine' && bar.directionTargets?.includes('Fine')) return end
  const jumped = takeJump(context, current)
  if (jumped != null) return jumped

  const next = skipAlternative(bars, blockId + 1, pass)
  if (bars[next]?.repeatOpen && blockId < next) {
    return mode == null ? { blockId: next, pass: 1, mode, taken } : afterJumpTo(context, next, mode, taken)
  }
  return { blockId: next, pass, mode, taken }
}

/** Every bar in playing order from `startBlock` to the song end (capped, against malformed repeats). */
export function buildPlayOrder(bars: readonly PlayOrderBar[], startBlock = 0): PlayedBar[] {
  const context = playOrderContext(bars)
  const limit = bars.length * 64 + 64
  const order: PlayedBar[] = []
  let current = startOfPlayOrder(startBlock)
  while (current.blockId < bars.length && order.length < limit) {
    order.push(current)
    current = nextPlayedBar(context, current)
  }
  return order
}
