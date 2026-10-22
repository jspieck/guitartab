import { computed, reactive } from 'vue'

/** A note the virtual piano and guitar show as pressed. */
export interface SoundingNote {
  /** MIDI pitch, which is also the piano key number. */
  pitch: number
  /** Data string (0 = lowest), or -1 when it has no place on the guitar. */
  string: number
  /** Fret counted from the nut, capo included. */
  fret: number
}

export const soundingNotes = reactive({
  /** Playback: what the current track plays now, one entry per string. */
  playback: [] as (SoundingNote | null)[],
  /** Live input (MIDI keyboard, piano clicks), by pitch. */
  live: {} as Record<number, SoundingNote>,
})

/** The fret-relevant part of a played note. */
interface PlayedNote {
  fret: number
  tied?: boolean
}

/**
 * Shows the notes of the beat playback has reached. A tied note keeps the
 * note before it; an empty string stops sounding.
 */
export function showPlaybackBeat(
  notes: readonly (PlayedNote | null | undefined)[],
  tuning: readonly number[],
  capo: number,
): void {
  const next = tuning.map((open, string) => {
    const note = notes[string]
    if (note == null) return null
    if (note.tied) return soundingNotes.playback[string] ?? null
    const fret = note.fret + capo
    return { pitch: open + fret, string, fret }
  })
  // Most beats change only a few strings; skip the write when nothing changed.
  const same =
    next.length === soundingNotes.playback.length &&
    next.every((note, i) => sameNote(note, soundingNotes.playback[i] ?? null))
  if (!same) soundingNotes.playback = next
}

export function clearPlaybackNotes(): void {
  if (soundingNotes.playback.length > 0) soundingNotes.playback = []
}

export function pressLiveNote(pitch: number, string = -1, fret = -1): void {
  soundingNotes.live[pitch] = { pitch, string, fret }
}

export function releaseLiveNote(pitch: number): void {
  delete soundingNotes.live[pitch]
}

function sameNote(a: SoundingNote | null, b: SoundingNote | null): boolean {
  return (
    a === b || (a != null && b != null && a.pitch === b.pitch && a.string === b.string && a.fret === b.fret)
  )
}

function allSounding(): SoundingNote[] {
  const playing = soundingNotes.playback.filter((note): note is SoundingNote => note != null)
  return [...playing, ...Object.values(soundingNotes.live)]
}

/** Piano keys to light up. */
export const soundingPitches = computed(() => new Set(allSounding().map((note) => note.pitch)))

/** Guitar positions to mark (notes without a string are left out). */
export const soundingFrets = computed(() => allSounding().filter((note) => note.string >= 0))
