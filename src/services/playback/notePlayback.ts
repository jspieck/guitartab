import Song, { type Beat, type Note } from '../../stores/song'
import Duration from '../../utils/duration'
import { samplePlayer, type SamplePlayer } from '../audio/samplePlayer'
import { nextBeatRef } from './songCursor'
import { spw } from './tempo'

/**
 * How a scheduled beat sounds: which of its notes play (mute/solo, ties), how long (a tie
 * chain into the following beats adds their lengths), strums, grace notes and ghost notes,
 * handed to the sample player with their start on the audio clock.
 */

/** A beat in a voice; `sequenceIndex` places it in the scheduler's bar sequence (or a render's bar list). */
export interface BeatRef {
  blockId: number
  beatId: number
  sequenceIndex?: number
}

/** Where and how a beat plays: the live sample player, or an audio render's. */
export interface PlayTarget {
  player: SamplePlayer
  /** seconds per whole note (tempo and practice speed): strums, grace notes, ties */
  secondsPerWhole: number
  /** the beat played after `ref` in this voice, for tie chains (null: none); default: bar order */
  after?: (ref: BeatRef) => BeatRef | null
}

/** A tie chain longer than this many beats stops growing (a malformed song or a loop of ties). */
const MAX_TIE_CHAIN = 64

function isAudible(trackId: number): boolean {
  const instruments = Song.playBackInstrument
  const anySolo = instruments.some((instrument) => instrument.solo)
  const own = instruments[trackId]
  return !own.mute && (!anySolo || own.solo) && own.volume >= 5
}

/**
 * Ghost notes play softer (only themselves, not the other notes of the chord); the sample
 * player also makes them short and percussive (`ghostShape`), which is what keeps them audible.
 */
function volumeOf(note: Note): number {
  return note.ghost ? 0.6 : 1.0
}

/** One note of a beat, at `start` (audio clock) for `duration` seconds; `nextBeat` is the beat played after it. */
function playNote(
  target: PlayTarget,
  trackId: number,
  voiceId: number,
  string: number,
  beat: Beat,
  note: Note,
  startIn: number,
  durationIn: number,
  volume: number,
  nextBeat: Beat | null,
): void {
  const { player, secondsPerWhole } = target
  let start = startIn
  let duration = durationIn
  const stroke = beat.effects?.stroke
  if (string !== -1 && stroke != null) {
    // strokeLength is 128 for 1/128 and 8 for an eighth; spread over the strings
    const delay = (1 / stroke.strokeLength / (2 * 6)) * secondsPerWhole
    // Strings are stored lowest first: a down strum reaches string 0 first, an up strum last.
    const order = stroke.strokeType === 'down' ? string : Song.tracks[trackId].numStrings - 1 - string
    start += delay * order
    duration -= delay * order
  }

  // where a slide goes
  const nextFret = nextBeat?.notes?.[string]?.fret ?? null
  const instr = Song.playBackInstrument[trackId].instrument
  const { fret } = note
  const play = (playFret: number, at: number, length: number, effects: Note | null) =>
    player.playFret(trackId, voiceId, string, playFret, volume, at, length, beat, effects, instr, nextFret)
  if (instr === 'drums') {
    player.playFret(trackId, voiceId, 0, fret, volume, start, duration, beat, null, instr, nextFret)
    return
  }
  if (note.graceObj == null) {
    play(fret, start, duration, note)
    return
  }
  // the grace note sounds for its own length, then the note itself with its effects
  const graceLength = (Duration.getDurationOfType(note.graceObj.duration) / 64) * secondsPerWhole
  play(note.graceObj.fret, start, graceLength, null)
  play(fret, start + graceLength, duration, note)
}

function beatAt(trackId: number, voiceId: number, ref: BeatRef | null): Beat | null {
  if (ref == null) return null
  return Song.measures[trackId][ref.blockId]?.[voiceId]?.[ref.beatId] ?? null
}

/**
 * How long a note on `string` sounds when the beats after it tie it on: its own `duration`
 * plus every following beat whose note on that string is tied, across bars and in playing
 * order (`after`). Stops at the first beat without a tied note there.
 */
export function tiedLength(
  trackId: number,
  voiceId: number,
  string: number,
  duration: number,
  next: BeatRef | null,
  target: PlayTarget,
  after: (ref: BeatRef) => BeatRef | null,
): number {
  let length = duration
  let ref = next
  let beat = beatAt(trackId, voiceId, ref)
  for (let step = 0; step < MAX_TIE_CHAIN && ref != null && beat?.notes[string]?.tied; step += 1) {
    length += (Duration.getDurationOfNote(beat, false) / 64) * target.secondsPerWhole
    ref = after(ref)
    beat = beatAt(trackId, voiceId, ref)
  }
  return length
}

/** An object, so tests can spy on what gets scheduled. */
export const notePlayback = {
  /**
   * Plays the notes of a beat at `start` (audio clock) for `duration` seconds. `following` is
   * the beat played after it (after a repeat or D.S. not the next one in the bar order; null
   * when none follows); without it, the next beat in bar order. `target` is where it plays
   * (default: the app's sample player at the song's tempo now).
   */
  playBeat(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
    duration: number,
    start: number,
    beat: Beat,
    following?: BeatRef | null,
    target: PlayTarget = { player: samplePlayer, secondsPerWhole: spw(Song.bpm) },
  ): void {
    if (!isAudible(trackId)) return
    const chord = beat.notes
    const next = following === undefined ? nextBeatRef(Song, trackId, blockId, voiceId, beatId) : following
    const nextBeat = beatAt(trackId, voiceId, next)
    const after =
      target.after ?? ((ref: BeatRef) => nextBeatRef(Song, trackId, ref.blockId, voiceId, ref.beatId))

    target.player.beatStart = start
    try {
      for (let string = 0; string < Song.tracks[trackId].numStrings; string += 1) {
        const note = chord[string]
        if (note == null || note.tied) continue
        const length = tiedLength(trackId, voiceId, string, duration, next, target, after)
        playNote(target, trackId, voiceId, string, beat, note, start, length, volumeOf(note), nextBeat)
      }
      // notes recorded from MIDI that fit no string
      for (const note of beat.otherNotes ?? []) {
        target.player.playPitch(trackId, voiceId, note.height, volumeOf(note), start, duration, beat, note)
      }
    } finally {
      target.player.beatStart = null
    }
  },
}
