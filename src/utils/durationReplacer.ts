/**
 * DurationReplacer — Pure-logic class for handling duration changes in a measure.
 *
 * When a beat's duration changes (e.g. quarter → eighth), the freed or consumed
 * space must be compensated by inserting or removing rests so the measure still
 * sums to the correct total.
 *
 * This class operates on a lightweight Beat interface and has zero coupling to
 * Song, DOM, or any rendering layer.
 */

// ─── Duration constants (ticks, where whole = 64) ───────────────────────────

export const DURATION_TICKS: Record<string, number> = {
  w: 64, wr: 64,
  h: 32, hr: 32,
  q: 16, qr: 16,
  e: 8,  er: 8,
  s: 4,  sr: 4,
  t: 2,  tr: 2,
  z: 1,  zr: 1,
  o: 0.5, or: 0.5,
}

const TICKS_TO_CODE: [number, string][] = [
  [64, 'w'],
  [32, 'h'],
  [16, 'q'],
  [8, 'e'],
  [4, 's'],
  [2, 't'],
  [1, 'z'],
  [0.5, 'o'],
]

// ─── Lightweight beat representation ────────────────────────────────────────

export interface Beat {
  duration: string
  dotted: boolean
  doubleDotted: boolean
  tuplet: number | null
  tupletId: number
  hasNotes: boolean
}

export interface RestBeat extends Beat {
  hasNotes: false
}

// ─── Result types ───────────────────────────────────────────────────────────

export interface DecomposedNote {
  duration: string
  dotted: boolean
  doubleDotted: boolean
  ticks: number
}

export interface ShrinkResult {
  beats: Beat[]
  insertedRests: DecomposedNote[]
  rescaleNeeded: boolean
}

export interface GrowResult {
  beats: Beat[]
  removedCount: number
  insertedRests: DecomposedNote[]
  rescaleNeeded: boolean
  success: boolean
}

// ─── Core class ─────────────────────────────────────────────────────────────

export class DurationReplacer {

  // ── Duration helpers (static, pure) ─────────────────────────────────────

  static baseDuration(code: string): string {
    return code.replace('r', '')
  }

  static isRest(code: string): boolean {
    return code.endsWith('r')
  }

  static ticksOf(code: string): number {
    return DURATION_TICKS[code] ?? DURATION_TICKS[DurationReplacer.baseDuration(code)] ?? 0
  }

  static codeFromTicks(ticks: number): string {
    for (const [t, c] of TICKS_TO_CODE) {
      if (t === ticks) return c
    }
    return ''
  }

  static beatTicks(beat: Beat, ignoreTuplet = false): number {
    let base = DurationReplacer.ticksOf(beat.duration)
    if (beat.dotted) base += base / 2
    if (beat.doubleDotted) base += base / 2 + base / 4
    if (!ignoreTuplet && beat.tuplet != null && beat.tuplet !== 0) {
      const numSubs = DurationReplacer.tupletSubstitutedNotes(beat.tuplet)
      if (numSubs === 0) {
        base *= 2
        return base / beat.tuplet
      }
      base *= numSubs / beat.tuplet
    }
    return base
  }

  static tupletSubstitutedNotes(tuplet: number): number {
    const table = [0, 0, 0, 2, 0, 4, 4, 4, 0, 8, 8, 8, 8, 8, 8, 8, 0]
    return table[tuplet] ?? 0
  }

  /**
   * Find the largest power-of-2 note duration (in ticks) that fits
   * within `space` ticks.  Max = 64 (whole note).
   */
  static greatestPow2Fit(space: number): number {
    if (space <= 0) return 0
    return 2 ** Math.min(6, Math.floor(Math.log2(space)))
  }

  // ── Core algorithm: decompose a tick amount into minimal rest notes ─────

  /**
   * Given a number of ticks, decompose into the minimal set of
   * (possibly dotted) rest durations that sum exactly to that amount.
   *
   * Uses a greedy approach: try dotted first (base + base/2), then plain
   * power-of-2.  This avoids the fragile fractional-remainder checks in
   * the original code and is provably correct for any positive tick value
   * that can be expressed as a sum of standard durations.
   *
   * EPSILON-based comparisons are used throughout to avoid IEEE-754 issues
   * that caused bugs in the original code.
   */
  static decompose(ticks: number): DecomposedNote[] {
    const EPS = 1e-9
    const result: DecomposedNote[] = []
    let remaining = ticks

    while (remaining > EPS) {
      const base = DurationReplacer.greatestPow2Fit(remaining)
      if (base === 0) break

      const dotted = base + base / 2
      const doubleDotted = base + base / 2 + base / 4
      const code = DurationReplacer.codeFromTicks(base)

      if (doubleDotted <= remaining + EPS && doubleDotted - remaining > -EPS) {
        result.push({ duration: code, dotted: false, doubleDotted: true, ticks: doubleDotted })
        remaining -= doubleDotted
      } else if (dotted <= remaining + EPS) {
        result.push({ duration: code, dotted: true, doubleDotted: false, ticks: dotted })
        remaining -= dotted
      } else {
        result.push({ duration: code, dotted: false, doubleDotted: false, ticks: base })
        remaining -= base
      }

      if (remaining < EPS) remaining = 0
    }

    return result
  }

  // ── Shrink: note gets shorter, fill freed space with rests ──────────────

  /**
   * When a beat's duration shrinks (e.g. quarter→eighth), the freed ticks
   * must be filled with rests.
   *
   * @param beats       The full measure's beat array (will NOT be mutated)
   * @param beatIndex   Index of the beat being changed
   * @param newDuration New duration code (e.g. 'e', 'sr')
   * @returns           A ShrinkResult with the new beats array
   */
  static shrink(beats: Beat[], beatIndex: number, newDuration: string): ShrinkResult {
    const beat = beats[beatIndex]
    const oldTicks = DurationReplacer.beatTicks(beat, true)
    const newTicks = DurationReplacer.ticksOf(newDuration)

    if (newTicks >= oldTicks) {
      return { beats: [...beats], insertedRests: [], rescaleNeeded: false }
    }

    const freedTicks = oldTicks - newTicks
    const rests = DurationReplacer.decompose(freedTicks)

    const result = [...beats]

    // Update the beat's duration
    const updatedBeat = { ...beat, duration: newDuration, dotted: false, doubleDotted: false }
    // Preserve rest status
    if (!updatedBeat.hasNotes && !DurationReplacer.isRest(updatedBeat.duration)) {
      updatedBeat.duration += 'r'
    }
    result[beatIndex] = updatedBeat

    // Insert rests after the beat
    const restBeats: Beat[] = rests.map(r => ({
      duration: r.duration + 'r',
      dotted: r.dotted,
      doubleDotted: r.doubleDotted,
      tuplet: beat.tuplet,
      tupletId: beat.tupletId,
      hasNotes: false,
    }))

    result.splice(beatIndex + 1, 0, ...restBeats)

    const rescaleNeeded = rests.some(r => DurationReplacer.ticksOf(r.duration) <= 4)

    return { beats: result, insertedRests: rests, rescaleNeeded }
  }

  // ── Grow: note gets longer, consume adjacent rests ──────────────────────

  /**
   * When a beat's duration grows (e.g. eighth→quarter), adjacent rests
   * must be consumed to make room.
   *
   * @param beats       The full measure's beat array (will NOT be mutated)
   * @param beatIndex   Index of the beat being changed
   * @param newDuration New duration code (e.g. 'q', 'h')
   * @returns           A GrowResult with the new beats array
   */
  static grow(beats: Beat[], beatIndex: number, newDuration: string): GrowResult {
    const EPS = 1e-9
    const beat = beats[beatIndex]
    const oldTicks = DurationReplacer.beatTicks(beat, true)
    const newTicks = DurationReplacer.ticksOf(newDuration)

    if (newTicks <= oldTicks) {
      return {
        beats: [...beats], removedCount: 0, insertedRests: [],
        rescaleNeeded: false, success: true,
      }
    }

    const neededTicks = newTicks - oldTicks
    const isTuplet = beat.tuplet != null
    const tupletId = beat.tupletId

    // Scan forward and collect available rest ticks
    let availableTicks = 0
    let endScan = beatIndex + 1

    for (let i = beatIndex + 1; i < beats.length; i++) {
      if (availableTicks >= neededTicks - EPS) break

      const candidate = beats[i]

      if (isTuplet) {
        // For tuplets, only consume rests within the same tuplet group
        if (candidate.tuplet == null || candidate.tupletId !== tupletId) break
        if (!candidate.hasNotes && DurationReplacer.isRest(candidate.duration)) {
          availableTicks += DurationReplacer.beatTicks(candidate, true)
          endScan = i + 1
        }
      } else {
        // For non-tuplet, stop at tuplet boundaries
        if (candidate.tuplet != null) break
        if (!candidate.hasNotes) {
          availableTicks += DurationReplacer.beatTicks(candidate, false)
          endScan = i + 1
        } else {
          break // Stop at first non-rest
        }
      }
    }

    if (availableTicks < neededTicks - EPS) {
      return {
        beats: [...beats], removedCount: 0, insertedRests: [],
        rescaleNeeded: false, success: false,
      }
    }

    // Build new array: remove consumed rests, insert back any excess
    const result = [...beats]

    // Update the target beat
    const updatedBeat = { ...beat, duration: newDuration, dotted: false, doubleDotted: false }
    if (!updatedBeat.hasNotes && !DurationReplacer.isRest(updatedBeat.duration)) {
      updatedBeat.duration += 'r'
    }
    result[beatIndex] = updatedBeat

    // Remove all rests we scanned
    const removedCount = endScan - (beatIndex + 1)
    result.splice(beatIndex + 1, removedCount)

    // If we over-consumed, insert back the excess as rests
    const excessTicks = availableTicks - neededTicks
    const excessRests = excessTicks > EPS ? DurationReplacer.decompose(excessTicks) : []

    const excessBeats: Beat[] = excessRests.map(r => ({
      duration: r.duration + 'r',
      dotted: r.dotted,
      doubleDotted: r.doubleDotted,
      tuplet: isTuplet ? beat.tuplet : null,
      tupletId: isTuplet ? beat.tupletId : 0,
      hasNotes: false,
    }))

    result.splice(beatIndex + 1, 0, ...excessBeats)

    const rescaleNeeded = oldTicks <= 4 && newTicks > 4

    return {
      beats: result,
      removedCount,
      insertedRests: excessRests,
      rescaleNeeded,
      success: true,
    }
  }

  // ── High-level: change a beat's duration ────────────────────────────────

  /**
   * Change the duration of a beat in a measure and return the adjusted
   * beat array with rests properly managed.
   */
  static changeDuration(
    beats: Beat[],
    beatIndex: number,
    newDurationCode: string,
  ): { beats: Beat[]; rescaleNeeded: boolean; success: boolean } {
    const beat = beats[beatIndex]
    const oldTicks = DurationReplacer.beatTicks(beat, true)
    const newTicks = DurationReplacer.ticksOf(newDurationCode)
    const EPS = 1e-9

    if (Math.abs(newTicks - oldTicks) < EPS) {
      // Same duration — just swap the code
      const result = [...beats]
      result[beatIndex] = { ...beat, duration: newDurationCode }
      return { beats: result, rescaleNeeded: false, success: true }
    }

    if (newTicks < oldTicks) {
      const { beats: newBeats, rescaleNeeded } = DurationReplacer.shrink(beats, beatIndex, newDurationCode)
      return { beats: newBeats, rescaleNeeded, success: true }
    }

    const { beats: newBeats, rescaleNeeded, success } = DurationReplacer.grow(beats, beatIndex, newDurationCode)
    return { beats: newBeats, rescaleNeeded, success }
  }

  // ── Utility: verify measure integrity ───────────────────────────────────

  /**
   * Sum all beat ticks in a measure.  Useful for verifying that
   * operations preserve the total duration.
   */
  static measureTotalTicks(beats: Beat[], ignoreTuplet = false): number {
    return beats.reduce((sum, b) => sum + DurationReplacer.beatTicks(b, ignoreTuplet), 0)
  }
}
