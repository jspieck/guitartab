/** A pitch placed on the guitar; `string` is -1 when it has no free string. */
export interface ArrangedNote {
  pitch: number
  string: number
  /** Fret above the capo. */
  fret: number
}

/**
 * Places pitches (MIDI keyboard input) on strings: the lowest pitch on the
 * lowest possible string, each further pitch on a higher string, every one
 * on the string where its fret is smallest. Strings in `usedStrings` are
 * skipped; each pitch leaves enough strings above it for the ones still to
 * place.
 */
export function arrangeOnStrings(
  pitches: readonly number[],
  tuning: readonly number[],
  capo: number,
  usedStrings: ReadonlySet<number> = new Set(),
): ArrangedNote[] {
  const sorted = [...pitches].sort((a, b) => a - b)
  const arranged: ArrangedNote[] = []
  let lastString = -1
  sorted.forEach((pitch, i) => {
    let best = -1
    let bestFret = Infinity
    const lastAllowed = tuning.length - sorted.length + i
    for (let string = lastString + 1; string <= lastAllowed; string += 1) {
      if (usedStrings.has(string)) continue
      const fret = pitch - tuning[string] - capo
      if (fret >= 0 && fret < bestFret) {
        best = string
        bestFret = fret
      }
    }
    if (best === -1) {
      arranged.push({ pitch, string: -1, fret: -1 })
    } else {
      lastString = best
      arranged.push({ pitch, string: best, fret: bestFret })
    }
  })
  return arranged
}
