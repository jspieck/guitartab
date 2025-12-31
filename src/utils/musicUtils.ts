/**
 * Music Theory Utilities
 * 
 * Constants and functions for music theory calculations including:
 * - Duration handling
 * - Note/pitch calculations
 * - Tuning and transposition
 */

// =============================================================================
// Duration Types
// =============================================================================

/** Duration code (w, h, q, e, s, t, z, o) with optional 'r' suffix for rests */
export type DurationCode = 'w' | 'h' | 'q' | 'e' | 's' | 't' | 'z' | 'o' |
                          'wr' | 'hr' | 'qr' | 'er' | 'sr' | 'tr' | 'zr' | 'or'

/** Human-readable duration names */
export type DurationName = 'whole' | 'half' | 'quarter' | 'eighth' | 
                          'sixteenth' | 'thirty-second' | 'sixty-fourth' | 'one-twenty-eighth'

// =============================================================================
// Duration Constants
// =============================================================================

/** Duration codes to tick values (64 ticks = whole note) */
export const DURATION_TICKS: Record<string, number> = {
  'w': 64, 'wr': 64,   // whole
  'h': 32, 'hr': 32,   // half
  'q': 16, 'qr': 16,   // quarter
  'e': 8,  'er': 8,    // eighth
  's': 4,  'sr': 4,    // sixteenth
  't': 2,  'tr': 2,    // thirty-second
  'z': 1,  'zr': 1,    // sixty-fourth
  'o': 0.5, 'or': 0.5  // one-twenty-eighth (grace notes)
}

/** Duration codes to display width (for spacing) */
export const DURATION_WIDTH: Record<string, number> = {
  'w': 8, 'wr': 8,
  'h': 4, 'hr': 4,
  'q': 2, 'qr': 2,
  'e': 1, 'er': 1,
  's': 1, 'sr': 1,
  't': 1, 'tr': 1,
  'z': 1, 'zr': 1,
  'o': 0.5, 'or': 0.5
}

/** Duration codes to beam count */
export const DURATION_BEAMS: Record<string, number> = {
  'w': 0, 'wr': 0,   // no beam
  'h': 0, 'hr': 0,   // no beam
  'q': 0, 'qr': 0,   // no beam
  'e': 1, 'er': 1,   // 1 beam
  's': 2, 'sr': 2,   // 2 beams
  't': 3, 'tr': 3,   // 3 beams
  'z': 4, 'zr': 4,   // 4 beams
  'o': 5, 'or': 5    // 5 beams
}

/** Duration code to human-readable name mapping */
export const DURATION_NAMES: Record<string, DurationName> = {
  'w': 'whole', 'wr': 'whole',
  'h': 'half', 'hr': 'half',
  'q': 'quarter', 'qr': 'quarter',
  'e': 'eighth', 'er': 'eighth',
  's': 'sixteenth', 'sr': 'sixteenth',
  't': 'thirty-second', 'tr': 'thirty-second',
  'z': 'sixty-fourth', 'zr': 'sixty-fourth',
  'o': 'one-twenty-eighth', 'or': 'one-twenty-eighth'
}

/** Human-readable name to code mapping */
export const NAME_TO_CODE: Record<DurationName, DurationCode> = {
  'whole': 'w',
  'half': 'h',
  'quarter': 'q',
  'eighth': 'e',
  'sixteenth': 's',
  'thirty-second': 't',
  'sixty-fourth': 'z',
  'one-twenty-eighth': 'o'
}

/** Rest symbol characters (music font) */
export const REST_SYMBOLS: Record<string, string> = {
  'w': '𝄻',  // whole rest
  'h': '𝄼',  // half rest
  'q': '𝄽',  // quarter rest
  'e': '𝄾',  // eighth rest
  's': '𝄿',  // sixteenth rest
  't': '𝅀',  // thirty-second rest
  'z': '𝅁',  // sixty-fourth rest
  'o': '𝅂'   // one-twenty-eighth rest
}

// =============================================================================
// Duration Functions
// =============================================================================

/**
 * Get the base duration code (without 'r' suffix)
 */
export function getBaseDuration(duration: string): string {
  return duration?.replace('r', '') || 'q'
}

/**
 * Check if a duration code represents a rest
 */
export function isRestDuration(duration: string): boolean {
  return duration?.endsWith('r') ?? false
}

/**
 * Get the tick value for a duration
 */
export function getDurationTicks(duration: string): number {
  return DURATION_TICKS[duration] ?? DURATION_TICKS['q']
}

/**
 * Get the display width for a duration
 */
export function getDurationWidth(duration: string): number {
  return DURATION_WIDTH[duration] ?? DURATION_WIDTH['q']
}

/**
 * Get the beam count for a duration
 */
export function getBeamCount(duration: string): number {
  const baseDuration = getBaseDuration(duration)
  return DURATION_BEAMS[baseDuration] ?? 0
}

/**
 * Get the rest symbol for a duration
 */
export function getRestSymbol(duration: string): string {
  const baseDuration = getBaseDuration(duration)
  return REST_SYMBOLS[baseDuration] ?? REST_SYMBOLS['q']
}

/**
 * Get the human-readable name for a duration
 */
export function getDurationName(duration: string): DurationName {
  const baseDuration = getBaseDuration(duration)
  return DURATION_NAMES[baseDuration] ?? 'quarter'
}

/**
 * Convert duration name to code
 */
export function durationNameToCode(name: DurationName): DurationCode {
  return NAME_TO_CODE[name] ?? 'q'
}

/**
 * Convert tick value to duration code
 */
export function ticksToDurationCode(ticks: number): DurationCode {
  if (ticks >= 64) return 'w'
  if (ticks >= 32) return 'h'
  if (ticks >= 16) return 'q'
  if (ticks >= 8) return 'e'
  if (ticks >= 4) return 's'
  if (ticks >= 2) return 't'
  if (ticks >= 1) return 'z'
  return 'o'
}

/**
 * Calculate duration with dots
 */
export function calculateDottedDuration(
  baseTicks: number,
  dotted: boolean,
  doubleDotted: boolean
): number {
  let ticks = baseTicks
  if (dotted) {
    ticks += baseTicks / 2
  }
  if (doubleDotted) {
    ticks += baseTicks / 2 + baseTicks / 4
  }
  return ticks
}

/**
 * Calculate duration with tuplet
 */
export function calculateTupletDuration(
  baseTicks: number,
  tuplet: number | null | undefined
): number {
  if (!tuplet || tuplet === 0) return baseTicks
  
  const substitutedNotes = getTupletSubstitutedNotes(tuplet)
  if (substitutedNotes === 0) {
    // Fallback for unknown tuplet
    return (baseTicks * 2) / tuplet
  }
  
  return (baseTicks * substitutedNotes) / tuplet
}

/**
 * Get the number of notes a tuplet substitutes for
 * e.g., triplet (3) substitutes for 2
 */
export function getTupletSubstitutedNotes(tuplet: number): number {
  const substitutions: Record<number, number> = {
    3: 2,    // triplet: 3 notes in space of 2
    5: 4, 6: 4, 7: 4,  // quintuplet etc: in space of 4
    9: 8, 10: 8, 11: 8, 12: 8, 13: 8, 14: 8, 15: 8  // in space of 8
  }
  return substitutions[tuplet] ?? 0
}

// =============================================================================
// Note/Pitch Constants
// =============================================================================

/** Note names */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export type NoteName = typeof NOTE_NAMES[number]

/** Standard guitar tuning (MIDI note numbers, low E to high E) */
export const STANDARD_GUITAR_TUNING = [40, 45, 50, 55, 59, 64] // E2, A2, D3, G3, B3, E4

/** Standard bass tuning (MIDI note numbers) */
export const STANDARD_BASS_TUNING = [28, 33, 38, 43] // E1, A1, D2, G2

// =============================================================================
// Note/Pitch Functions
// =============================================================================

/**
 * Convert MIDI note number to note name
 */
export function midiToNoteName(midiNote: number): NoteName {
  return NOTE_NAMES[midiNote % 12]
}

/**
 * Convert MIDI note number to octave
 */
export function midiToOctave(midiNote: number): number {
  return Math.floor(midiNote / 12) - 1
}

/**
 * Convert MIDI note to full note string (e.g., "C4")
 */
export function midiToNoteString(midiNote: number): string {
  return `${midiToNoteName(midiNote)}${midiToOctave(midiNote)}`
}

/**
 * Convert note name and octave to MIDI note number
 */
export function noteToMidi(noteName: NoteName, octave: number): number {
  const noteIndex = NOTE_NAMES.indexOf(noteName)
  return (octave + 1) * 12 + noteIndex
}

/**
 * Calculate MIDI note from string tuning and fret
 */
export function fretToMidi(stringTuning: number, fret: number, capo: number = 0): number {
  return stringTuning + fret + capo
}

/**
 * Calculate frequency from MIDI note (A4 = 440Hz)
 */
export function midiToFrequency(midiNote: number, a4Frequency: number = 440): number {
  return a4Frequency * Math.pow(2, (midiNote - 69) / 12)
}

/**
 * Calculate MIDI note from frequency
 */
export function frequencyToMidi(frequency: number, a4Frequency: number = 440): number {
  return 69 + 12 * Math.log2(frequency / a4Frequency)
}

// =============================================================================
// Time Signature Helpers
// =============================================================================

/**
 * Calculate beats per measure from time signature
 */
export function getBeatsPerMeasure(numerator: number, denominator: number): number {
  // The denominator indicates what note gets one beat
  // We normalize to quarter notes
  return (numerator * 4) / denominator
}

/**
 * Calculate ticks per measure from time signature
 */
export function getTicksPerMeasure(numerator: number, denominator: number): number {
  // 64 ticks = whole note, so quarter = 16 ticks
  return (numerator * 64) / denominator
}

/**
 * Format time signature as string
 */
export function formatTimeSignature(numerator: number, denominator: number): string {
  return `${numerator}/${denominator}`
}

// =============================================================================
// Tempo Helpers
// =============================================================================

/**
 * Calculate duration of a beat in seconds
 */
export function getBeatDuration(bpm: number): number {
  return 60 / bpm
}

/**
 * Calculate duration of a tick in seconds
 */
export function getTickDuration(bpm: number): number {
  // 16 ticks per quarter note
  return getBeatDuration(bpm) / 16
}

/**
 * Convert seconds to measures/beats at a given tempo
 */
export function secondsToPosition(
  seconds: number,
  bpm: number,
  numerator: number = 4,
  denominator: number = 4
): { measures: number; beats: number; ticks: number } {
  const ticksPerSecond = bpm * 16 / 60
  const totalTicks = seconds * ticksPerSecond
  const ticksPerMeasure = getTicksPerMeasure(numerator, denominator)
  
  const measures = Math.floor(totalTicks / ticksPerMeasure)
  const remainingTicks = totalTicks % ticksPerMeasure
  const beats = Math.floor(remainingTicks / 16)
  const ticks = Math.floor(remainingTicks % 16)
  
  return { measures, beats, ticks }
}
