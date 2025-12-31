/**
 * Utilities for handling note/rest durations
 */

/**
 * Duration values in beats (quarter note = 1 beat in 4/4)
 */
export const DURATION_BEATS: Record<string, number> = {
  // Notes
  'w': 4, 'whole': 4,
  'h': 2, 'half': 2,
  'q': 1, 'quarter': 1,
  'e': 0.5, 'eighth': 0.5,
  's': 0.25, 'sixteenth': 0.25,
  't': 0.125, 'thirty-second': 0.125,
  'z': 0.0625, 'sixty-fourth': 0.0625,
  // Rests (same values)
  'wr': 4, 'hr': 2, 'qr': 1, 'er': 0.5, 'sr': 0.25, 'tr': 0.125, 'zr': 0.0625
}

/**
 * Number of beams for each duration (for eighth notes and shorter)
 */
export const BEAM_COUNTS: Record<string, number> = {
  'eighth': 1, 'e': 1,
  'sixteenth': 2, 's': 2,
  'thirty-second': 3, 't': 3,
  'sixty-fourth': 4, 'z': 4
}

/**
 * Rest symbols for music notation
 */
export const REST_SYMBOLS: Record<string, string> = {
  'w': '𝄻', 'wr': '𝄻', 'whole': '𝄻',           // Whole rest
  'h': '𝄼', 'hr': '𝄼', 'half': '𝄼',             // Half rest
  'q': '𝄽', 'qr': '𝄽', 'quarter': '𝄽',          // Quarter rest
  'e': '𝄾', 'er': '𝄾', 'eighth': '𝄾',           // Eighth rest
  's': '𝄿', 'sr': '𝄿', 'sixteenth': '𝄿',        // Sixteenth rest
  't': '𝅀', 'tr': '𝅀', 'thirty-second': '𝅀',   // 32nd rest
  'z': '𝅁', 'zr': '𝅁', 'sixty-fourth': '𝅁'     // 64th rest
}

/**
 * Check if a duration string represents a rest
 */
export function isRestDuration(duration: string | undefined): boolean {
  if (!duration) return false
  return duration.endsWith('r')
}

/**
 * Get the base duration without the rest indicator
 */
export function getBaseDuration(duration: string): string {
  if (!duration) return 'q'
  return duration.replace('r', '')
}

/**
 * Get the duration in beats
 */
export function getDurationBeats(duration: string | undefined): number {
  if (!duration) return 1 // default to quarter
  return DURATION_BEATS[duration] ?? DURATION_BEATS[getBaseDuration(duration)] ?? 1
}

/**
 * Get the rest symbol for a duration
 */
export function getRestSymbol(duration: string | undefined): string {
  if (!duration) return REST_SYMBOLS['q']
  return REST_SYMBOLS[duration] ?? REST_SYMBOLS[getBaseDuration(duration)] ?? REST_SYMBOLS['q']
}

/**
 * Get beam count for a duration (0 for quarter notes and longer)
 */
export function getBeamCount(duration: string | undefined): number {
  if (!duration) return 0
  const baseDuration = getBaseDuration(duration)
  return BEAM_COUNTS[baseDuration] ?? 0
}

/**
 * Check if a beat has any actual notes (not all null/undefined/empty)
 * This is critical for determining whether to show rests
 */
export function beatHasNotes(beat: any): boolean {
  if (!beat) return false
  if (!beat.notes) return false
  if (!Array.isArray(beat.notes)) return false
  if (beat.notes.length === 0) return false
  
  // Check each position in the notes array
  for (let i = 0; i < beat.notes.length; i++) {
    const note = beat.notes[i]
    // Skip null/undefined
    if (note === null || note === undefined) continue
    // Check if it's an actual note object with a fret
    if (typeof note === 'object' && note.fret !== undefined) {
      return true
    }
  }
  
  return false
}

/**
 * Check if a beat should display as a rest
 * A beat is a rest if:
 * 1. Duration explicitly ends with 'r' (rest), OR
 * 2. Beat has no notes AND has a valid duration set
 */
export function isRest(beat: any): boolean {
  if (!beat) return false
  
  // Explicit rest duration
  if (isRestDuration(beat.duration)) return true
  
  // Beat with duration but no notes = rest
  if (beat.duration && !beatHasNotes(beat)) return true
  
  return false
}

/**
 * Determine if a beat needs a stem (for beamed notes)
 */
export function needsStem(beat: any): boolean {
  if (!beat?.duration) return false
  if (!beatHasNotes(beat)) return false
  
  const beamCount = getBeamCount(beat.duration)
  return beamCount > 0
}

/**
 * Get string positions of notes in a beat (for stem positioning)
 */
export function getNoteStringPositions(beat: any): { highest: number; lowest: number } | null {
  if (!beat?.notes) return null
  
  let highest = -1
  let lowest = -1
  
  beat.notes.forEach((note: any, stringIndex: number) => {
    if (note !== null) {
      if (highest === -1 || stringIndex < highest) highest = stringIndex
      if (lowest === -1 || stringIndex > lowest) lowest = stringIndex
    }
  })
  
  if (highest === -1) return null
  return { highest, lowest }
}
