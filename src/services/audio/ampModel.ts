import Song from '../../stores/song'
import type { Track, TrackAmp } from '../../types/song'

/**
 * Which tracks play through the amp simulation, and with what settings. GeneralUser GS's
 * overdrive and distortion guitars (GM 29/30) are pre-distorted samples that sound thin; with
 * the amp on, those tracks play the clean guitar instead and the amp distorts it
 * (`ampSimulator.ts`, a lazy chunk). Kept small: it is part of editor-core.
 */

const CLEAN_GUITAR = 27
const OVERDRIVE_GUITAR = 29
const DISTORTION_GUITAR = 30

const CRUNCH: TrackAmp = { enabled: true, drive: 0.45, tone: 0.55, cabinet: 'medium' }
const HIGH_GAIN: TrackAmp = { enabled: true, drive: 0.75, tone: 0.5, cabinet: 'large' }
const OFF: TrackAmp = { ...HIGH_GAIN, enabled: false }

/** The amp a track has without settings of its own: on for the overdrive and distortion programs. */
export function defaultAmp(program: number): TrackAmp {
  if (program === OVERDRIVE_GUITAR) return { ...CRUNCH }
  if (program === DISTORTION_GUITAR) return { ...HIGH_GAIN }
  return { ...OFF }
}

export function ampOf(track: Pick<Track, 'amp'>, program: number): TrackAmp {
  return track.amp ?? defaultAmp(program)
}

const DRUM_CHANNEL = 9

/** A track's GM program (9 = drums): GP3–5 tracks keep it on their channel, the rest on the track. */
export function soundingProgram(trackId: number): number {
  const track = Song.tracks[trackId]
  if (track.channel == null) return track.primaryChannel === DRUM_CHANNEL ? DRUM_CHANNEL : track.program
  if (track.channel.index === DRUM_CHANNEL) return DRUM_CHANNEL
  return Song.allChannels[track.channel.index]?.cInstrument ?? track.program
}

/** The amp a track plays through; drums never get one. */
export function trackAmp(trackId: number): TrackAmp {
  const program = soundingProgram(trackId)
  return program === DRUM_CHANNEL ? { ...OFF } : ampOf(Song.tracks[trackId], program)
}

/** The program whose samples a note plays: the amp makes the distortion itself. */
export function sampleProgram(program: number, amp: TrackAmp): number {
  return amp.enabled && (program === OVERDRIVE_GUITAR || program === DISTORTION_GUITAR)
    ? CLEAN_GUITAR
    : program
}

const HIGH_GAIN_WORDS = /metal|hi(gh)?[ -]?gain|distort|fuzz|lead|heavy|hard rock|grunge|insane|djent|dist\b/i
const CRUNCH_WORDS = /overdrive|drive|crunch|blues|rock|brit|plexi|\bod\b/i

/**
 * An amp from a Guitar Pro tone's names (GP5 RSE preset name and category such as
 * "Hard Rock - Default" / "Distortion Tones"; GP6–8 sound names, paths and effect ids).
 * Null when nothing in them sounds distorted.
 */
export function ampFromToneNames(names: (string | null | undefined)[]): TrackAmp | null {
  const text = names.filter((name) => name != null && name !== '').join(' ')
  if (/clean|acoustic|jazz/i.test(text) && !HIGH_GAIN_WORDS.test(text) && !/overdrive|crunch/i.test(text)) {
    return null
  }
  if (HIGH_GAIN_WORDS.test(text)) return { ...HIGH_GAIN }
  if (CRUNCH_WORDS.test(text)) return { ...CRUNCH }
  return null
}
