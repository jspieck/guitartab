/**
 * Drum tracks store the General MIDI drum note as the fret; the tab line is free. Giving each
 * kind of drum its own line reads like drum notation: kick at the bottom, crash on top.
 * Lines count from the bottom (string 0) of a 6-line drum tab.
 */
export function drumLine(midi: number): number {
  if (midi <= 36) return 0 // kicks
  if (midi <= 40) return 1 // snares, side stick, clap
  if ([41, 43, 45, 47, 48, 50].includes(midi)) return 2 // toms
  if (midi === 42 || midi === 44 || midi === 46) return 3 // hi-hat
  if (midi === 51 || midi === 53 || midi === 59) return 4 // rides
  return 5 // crashes, other cymbals and percussion
}

/** Lines for the hits of one beat: each on its drum's line, or the nearest free one when two collide. */
export function assignDrumLines(midiNotes: number[], lineCount: number): number[] {
  const used = new Set<number>()
  return midiNotes.map((midi) => {
    const wanted = Math.min(drumLine(midi), lineCount - 1)
    for (let distance = 0; distance < lineCount; distance += 1) {
      for (const line of [wanted + distance, wanted - distance]) {
        if (line >= 0 && line < lineCount && !used.has(line)) {
          used.add(line)
          return line
        }
      }
    }
    return -1
  })
}
