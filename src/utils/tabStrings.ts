/**
 * Song data stores strings lowest first: index 0 is the low E, and pitch is
 * `tuning[string] + fret`. Tablature draws the highest string on the top line,
 * so string index and line (row from the top) run in opposite directions.
 *
 * The mapping is its own inverse: use it for string → line and for line → string.
 */
export function stringLine(stringOrLine: number, numStrings: number): number {
  return numStrings - 1 - stringOrLine
}
