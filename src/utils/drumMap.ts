import type { Beat, Note, Track } from '../types/song'

/**
 * Drum tracks: the fret of a note is its General MIDI drum note, and each drum has a tab
 * line of its own. The track's drum map (`track.drumMap`) lists the drums from the bottom
 * line up, so a note of drum `m` sits on string `drumMap.indexOf(m)` and the track has one
 * string per drum. The tab names the lines (BD, SD, HH…) and draws hits as `x` and `o`.
 */

/** The kit a new drum track starts with, bottom line first: kick, toms, snare, hi-hat, ride, crash. */
export const DEFAULT_DRUM_MAP: readonly number[] = [36, 43, 45, 48, 38, 42, 51, 49]

/**
 * Where drums go when a map is built from the notes a track uses, bottom first: the
 * order of drum tabs (kick, toms, snare, hi-hats, ride, cymbals), then hand percussion.
 */
const LINE_ORDER = [
  35, 36, 41, 43, 45, 47, 48, 50, 37, 38, 40, 39, 44, 42, 46, 53, 51, 59, 55, 52, 57, 49,
  // percussion, low to high
  54, 56, 58, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
]

interface DrumPiece {
  /** Line label in the tab and the step grid. */
  label: string
  /** Full name. */
  name: string
  /** Cymbals, hi-hats and the side stick are drawn as `x`, drums and percussion as `o`. */
  cymbal?: boolean
}

const PIECES: Record<number, DrumPiece> = {
  35: { label: 'BD2', name: 'Kick 2' },
  36: { label: 'BD', name: 'Kick' },
  37: { label: 'SS', name: 'Side stick', cymbal: true },
  38: { label: 'SD', name: 'Snare' },
  39: { label: 'CP', name: 'Clap' },
  40: { label: 'SD2', name: 'Snare 2' },
  41: { label: 'FT2', name: 'Low floor tom' },
  42: { label: 'HH', name: 'Hi-hat (closed)', cymbal: true },
  43: { label: 'FT', name: 'Floor tom' },
  44: { label: 'PH', name: 'Hi-hat (pedal)', cymbal: true },
  45: { label: 'LT', name: 'Low tom' },
  46: { label: 'OH', name: 'Hi-hat (open)', cymbal: true },
  47: { label: 'MT', name: 'Mid tom' },
  48: { label: 'HT', name: 'High tom' },
  49: { label: 'CR', name: 'Crash', cymbal: true },
  50: { label: 'HT2', name: 'High tom 2' },
  51: { label: 'RD', name: 'Ride', cymbal: true },
  52: { label: 'CN', name: 'China', cymbal: true },
  53: { label: 'RB', name: 'Ride bell', cymbal: true },
  54: { label: 'TB', name: 'Tambourine' },
  55: { label: 'SP', name: 'Splash', cymbal: true },
  56: { label: 'CB', name: 'Cowbell' },
  57: { label: 'CR2', name: 'Crash 2', cymbal: true },
  58: { label: 'VS', name: 'Vibraslap' },
  59: { label: 'RD2', name: 'Ride 2', cymbal: true },
  60: { label: 'BH', name: 'High bongo' },
  61: { label: 'BL', name: 'Low bongo' },
  62: { label: 'CMH', name: 'Mute high conga' },
  63: { label: 'COH', name: 'Open high conga' },
  64: { label: 'CL', name: 'Low conga' },
  65: { label: 'TiH', name: 'High timbale' },
  66: { label: 'TiL', name: 'Low timbale' },
  67: { label: 'AgH', name: 'High agogo' },
  68: { label: 'AgL', name: 'Low agogo' },
  69: { label: 'Cab', name: 'Cabasa' },
  70: { label: 'Mar', name: 'Maracas' },
  71: { label: 'WhS', name: 'Short whistle' },
  72: { label: 'WhL', name: 'Long whistle' },
  73: { label: 'GuS', name: 'Short guiro' },
  74: { label: 'GuL', name: 'Long guiro' },
  75: { label: 'Clv', name: 'Claves' },
  76: { label: 'WbH', name: 'High wood block' },
  77: { label: 'WbL', name: 'Low wood block' },
  78: { label: 'CuM', name: 'Mute cuica' },
  79: { label: 'CuO', name: 'Open cuica' },
  80: { label: 'TrM', name: 'Mute triangle' },
  81: { label: 'TrO', name: 'Open triangle' },
}

/** General MIDI drums (35–81), for pickers. */
export const GM_DRUMS: readonly number[] = Object.keys(PIECES).map(Number)

/** Short line label: BD, SD, HH…; other notes by number. */
export function drumLabel(midi: number): string {
  return PIECES[midi]?.label ?? String(midi)
}

export function drumName(midi: number): string {
  return PIECES[midi]?.name ?? `Drum ${midi}`
}

/** Drum-tab symbol of a hit: `x` for cymbals and hi-hats, `o` otherwise; capital when accented. */
export function drumSymbol(
  midi: number,
  note?: Pick<Note, 'ghost' | 'accentuated' | 'heavyAccentuated'>,
): string {
  const symbol = PIECES[midi]?.cymbal ? 'x' : 'o'
  if (note?.ghost) return `(${symbol})`
  return note?.accentuated || note?.heavyAccentuated ? symbol.toUpperCase() : symbol
}

function lineRank(midi: number): number {
  const rank = LINE_ORDER.indexOf(midi)
  // drums outside the General MIDI kit go above it, by number
  return rank >= 0 ? rank : LINE_ORDER.length + midi
}

/** Sorts drums into tab order, bottom line first. */
export function sortDrums(midiNotes: Iterable<number>): number[] {
  return [...new Set(midiNotes)].sort((a, b) => lineRank(a) - lineRank(b))
}

/** Every drum note used in a track's bars (raw data). */
export function usedDrumNotes(bars: readonly (readonly (readonly Beat[])[])[] | undefined): Set<number> {
  const used = new Set<number>()
  for (const bar of bars ?? []) {
    for (const voice of bar ?? []) {
      for (const beat of voice ?? []) {
        for (const note of beat?.notes ?? []) {
          if (note != null && Number.isFinite(note.fret)) used.add(note.fret)
        }
      }
    }
  }
  return used
}

/**
 * A track's drum map that holds every drum it uses: its own map with missing drums put in
 * at their place in tab order, or (without one) the used drums in tab order; the default
 * kit for a track without notes.
 */
export function completeDrumMap(map: readonly number[] | undefined, used: Iterable<number>): number[] {
  const usedNotes = [...used]
  if (map == null || map.length === 0) {
    return usedNotes.length > 0 ? sortDrums(usedNotes) : [...DEFAULT_DRUM_MAP]
  }
  const result = [...new Set(map)]
  for (const midi of sortDrums(usedNotes)) {
    if (!result.includes(midi)) insertDrum(result, midi)
  }
  return result
}

/** Puts a drum into a map below the first line that comes after it in tab order. */
export function insertDrum(map: number[], midi: number): number {
  const at = map.findIndex((line) => lineRank(line) > lineRank(midi))
  const index = at < 0 ? map.length : at
  map.splice(index, 0, midi)
  return index
}

/**
 * A beat's notes on the lines of `map` (each note on its drum's line, its `string` set to
 * it); drums not in the map are dropped. The notes stay the same objects.
 */
export function notesOnDrumLines(notes: readonly (Note | null)[], map: readonly number[]): (Note | null)[] {
  const placed: (Note | null)[] = new Array(map.length).fill(null)
  for (const note of notes) {
    if (note == null) continue
    const line = map.indexOf(note.fret)
    if (line >= 0 && placed[line] == null) placed[line] = Object.assign(note, { string: line })
  }
  return placed
}

/**
 * Makes a drum track follow its map: the map holds every drum used, there is one string
 * per line (tuned to 0, no capo) and every note sits on its drum's line. Works on raw
 * data, in place. True when anything changed.
 */
export function applyDrumMap(track: Track, bars: Beat[][][] | undefined, map?: readonly number[]): boolean {
  const before = JSON.stringify([track.drumMap, track.numStrings, track.strings, track.capo])
  const drumMap = completeDrumMap(map ?? track.drumMap, usedDrumNotes(bars))
  track.drumMap = drumMap
  track.numStrings = drumMap.length
  track.strings = new Array(drumMap.length).fill(0)
  track.capo = 0
  let changed = before !== JSON.stringify([track.drumMap, track.numStrings, track.strings, track.capo])
  for (const bar of bars ?? []) {
    for (const voice of bar ?? []) {
      for (const beat of voice ?? []) {
        // rests keep their (empty) notes
        if (beat == null || !(beat.notes ?? []).some((note) => note != null)) continue
        const placed = notesOnDrumLines(beat.notes ?? [], drumMap)
        if (!sameLines(beat.notes ?? [], placed)) {
          beat.notes = placed
          changed = true
        }
      }
    }
  }
  return changed
}

function sameLines(current: readonly (Note | null)[], placed: readonly (Note | null)[]): boolean {
  if (current.length !== placed.length) return false
  return placed.every(
    (note, line) => (current[line] ?? null) === note && (note == null || note.string === line),
  )
}
