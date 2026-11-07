import { describe, expect, it } from 'vitest'
import { buildPlayOrder, skipAlternative, type PlayOrderBar } from '../src/services/playback/playOrder'
import { BarSequence } from '../src/services/playback/songCursor'
import { jumpRule } from '../src/utils/directions'

/** Bar numbers (0-based) in playing order. */
function order(bars: PlayOrderBar[], start = 0): number[] {
  return buildPlayOrder(bars, start).map((bar) => bar.blockId)
}

const plain = (count: number): PlayOrderBar[] => Array.from({ length: count }, () => ({}))

describe('play order', () => {
  it('plays bars one after another', () => {
    expect(order(plain(3))).toEqual([0, 1, 2])
  })

  it('repeats a section as often as the repeat sign says', () => {
    const bars = plain(4)
    bars[1].repeatOpen = true
    bars[2].repeatClose = 2
    expect(order(bars)).toEqual([0, 1, 2, 1, 2, 1, 2, 3])
  })

  it('jumps back to the song start when a repeat has no open sign', () => {
    const bars = plain(3)
    bars[1].repeatClose = 1
    expect(order(bars)).toEqual([0, 1, 0, 1, 2])
  })

  it('plays first and second endings', () => {
    // |: 0 | 1 |1. 2 :|2. 3 | 4
    const bars = plain(5)
    bars[0].repeatOpen = true
    bars[2].repeatAlternative = 0b01
    bars[2].repeatClose = 1
    bars[3].repeatAlternative = 0b10
    expect(order(bars)).toEqual([0, 1, 2, 0, 1, 3, 4])
  })

  it('plays ordinary bars before an alternative ending instead of jumping to it', () => {
    const bars: PlayOrderBar[] = [{}, {}, {}, { repeatAlternative: 0b01 }]
    expect(skipAlternative(bars, 1, 1)).toBe(1)
    expect(skipAlternative(bars, 2, 1)).toBe(2)
    expect(skipAlternative([{}, { repeatAlternative: 0b10 }, { repeatAlternative: 0b01 }], 1, 1)).toBe(2)
  })

  it('starts mid-song on the first pass', () => {
    const bars = plain(4)
    bars[0].repeatOpen = true
    bars[2].repeatClose = 1
    expect(order(bars, 1)).toEqual([1, 2, 0, 1, 2, 3])
  })

  it('D.C. plays from the start to the end, without the repeats', () => {
    const bars = plain(4)
    bars[0].repeatOpen = true
    bars[1].repeatClose = 1
    bars[3].directionJumps = ['DaCapo']
    expect(order(bars)).toEqual([0, 1, 0, 1, 2, 3, 0, 1, 2, 3])
  })

  it('D.C. al Fine stops at Fine (which is ignored on the first time through)', () => {
    const bars = plain(4)
    bars[1].directionTargets = ['Fine']
    bars[3].directionJumps = ['DaCapoAlFine']
    expect(order(bars)).toEqual([0, 1, 2, 3, 0, 1])
  })

  it('D.S. al Coda: back to the segno, at To Coda on to the coda', () => {
    // 0 | 1 𝄋 | 2 To Coda | 3 D.S. al Coda | 4 𝄌 | 5
    const bars = plain(6)
    bars[1].directionTargets = ['Segno']
    bars[2].directionJumps = ['DaCoda']
    bars[3].directionJumps = ['DaSegnoAlCoda']
    bars[4].directionTargets = ['Coda']
    expect(order(bars)).toEqual([0, 1, 2, 3, 1, 2, 4, 5])
  })

  it('D.S. al Coda with the segno on the first bar', () => {
    const bars = plain(5)
    bars[0].directionTargets = ['Segno']
    bars[1].directionJumps = ['DaCoda']
    bars[2].directionJumps = ['DaSegnoAlCoda']
    bars[3].directionTargets = ['Coda']
    expect(order(bars)).toEqual([0, 1, 2, 0, 1, 3, 4])
  })

  it('takes the last ending after a D.S. jump', () => {
    // 𝄋 |: 0 |1. 1 :|2. 2 | 3 D.S.
    const bars = plain(4)
    bars[0].repeatOpen = true
    bars[0].directionTargets = ['Segno']
    bars[1].repeatAlternative = 0b01
    bars[1].repeatClose = 1
    bars[2].repeatAlternative = 0b10
    bars[3].directionJumps = ['DaSegno']
    expect(order(bars)).toEqual([0, 1, 0, 2, 3, 0, 2, 3])
  })

  it('ignores a jump whose sign is missing, and takes every jump only once', () => {
    const bars = plain(3)
    bars[1].directionJumps = ['DaSegno']
    expect(order(bars)).toEqual([0, 1, 2])
    bars[1].directionJumps = ['DaCapo']
    expect(order(bars)).toEqual([0, 1, 0, 1, 2])
  })

  it('D.S.S. al Double Coda', () => {
    const bars = plain(6)
    bars[1].directionTargets = ['SegnoSegno']
    bars[2].directionJumps = ['DaDoubleCoda']
    bars[3].directionJumps = ['DaSegnoSegnoAlDoubleCoda']
    bars[4].directionTargets = ['DoubleCoda']
    expect(order(bars)).toEqual([0, 1, 2, 3, 1, 2, 4, 5])
  })

  it('stops on malformed input instead of looping forever', () => {
    const bars = plain(2)
    bars[1].repeatClose = 1_000_000
    expect(order(bars).length).toBe(2 * 64 + 64)
  })

  it('reads the jump rules from the names', () => {
    expect(jumpRule('DaSegnoSegnoAlFine')).toEqual({ to: 'SegnoSegno', then: 'alFine' })
    expect(jumpRule('DaCapo')).toEqual({ to: 'start', then: 'toEnd' })
    expect(jumpRule('DaCoda')).toEqual({ to: 'Coda', then: 'toEnd', onlyIn: 'alCoda' })
  })
})

describe('bar sequence', () => {
  function sequenceFrom(
    bars: PlayOrderBar[],
    start: number,
    loop: Parameters<BarSequence['precompute']>[2],
    count: number,
  ) {
    const sequence = new BarSequence()
    sequence.reset(bars)
    sequence.set(0, start)
    sequence.precompute(0, count, loop)
    return Array.from({ length: count + 1 }, (_, i) => sequence.blockAt(i))
  }

  it('follows the play order and ends with the bar count', () => {
    const bars = plain(4)
    bars[3].directionJumps = ['DaCapoAlFine']
    bars[1].directionTargets = ['Fine']
    expect(sequenceFrom(bars, 0, null, 7)).toEqual([0, 1, 2, 3, 0, 1, 4, 4])
  })

  it('goes from the loop end back to the loop start', () => {
    const loop = {
      trackId: 0,
      startBlock: 1,
      startBeat: 0,
      startRatio: 0,
      endBlock: 2,
      endBeat: 0,
      endRatio: 1,
    }
    expect(sequenceFrom(plain(5), 1, loop, 5)).toEqual([1, 2, 1, 2, 1, 2])
  })
})
