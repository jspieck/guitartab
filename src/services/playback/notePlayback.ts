import Song, { type Beat, type Note } from '../../stores/song'
import Duration from '../../utils/duration'
import { samplePlayer } from '../audio/samplePlayer'
import { nextBeatRef } from './songCursor'
import { spw } from './tempo'

/**
 * How a scheduled beat sounds: which of its notes play (mute/solo, ties), how long (a tie
 * into the next beat adds its length), strums, grace notes and ghost notes, handed to the
 * sample player with their start on the audio clock.
 */

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
  let start = startIn
  let duration = durationIn
  const stroke = beat.effects?.stroke
  if (string !== -1 && stroke != null) {
    // strokeLength is 128 for 1/128 and 8 for an eighth; spread over the strings
    const delay = (1 / stroke.strokeLength / (2 * 6)) * spw(Song.bpm)
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
    samplePlayer.playFret(
      trackId,
      voiceId,
      string,
      playFret,
      volume,
      at,
      length,
      beat,
      effects,
      instr,
      nextFret,
    )
  if (instr === 'drums') {
    samplePlayer.playFret(trackId, voiceId, 0, fret, volume, start, duration, beat, null, instr, nextFret)
    return
  }
  if (note.graceObj == null) {
    play(fret, start, duration, note)
    return
  }
  // the grace note sounds for its own length, then the note itself with its effects
  const graceLength = (Duration.getDurationOfType(note.graceObj.duration) / 64) * spw(Song.bpm)
  play(note.graceObj.fret, start, graceLength, null)
  play(fret, start + graceLength, duration, note)
}

function beatAt(
  trackId: number,
  voiceId: number,
  ref: { blockId: number; beatId: number } | null,
): Beat | null {
  if (ref == null) return null
  return Song.measures[trackId][ref.blockId]?.[voiceId]?.[ref.beatId] ?? null
}

/** An object, so tests can spy on what gets scheduled. */
export const notePlayback = {
  /**
   * Plays the notes of a beat at `start` (audio clock) for `duration` seconds. `following` is
   * the beat played after it (after a repeat or D.S. not the next one in the bar order; null
   * when none follows); without it, the next beat in bar order.
   */
  playBeat(
    trackId: number,
    blockId: number,
    voiceId: number,
    beatId: number,
    duration: number,
    start: number,
    beat: Beat,
    following?: { blockId: number; beatId: number } | null,
  ): void {
    if (!isAudible(trackId)) return
    const chord = beat.notes
    // a tie into the next beat lengthens the note (only one tie: longer chains would outlast the sample)
    const next = following === undefined ? nextBeatRef(Song, trackId, blockId, voiceId, beatId) : following
    const nextBeat = beatAt(trackId, voiceId, next)
    const tiedLength =
      nextBeat != null ? (Duration.getDurationOfNote(nextBeat, false) / 64) * spw(Song.bpm) : 0

    for (let string = 0; string < Song.tracks[trackId].numStrings; string += 1) {
      const note = chord[string]
      if (note == null || note.tied) continue
      const length = nextBeat?.notes[string]?.tied ? duration + tiedLength : duration
      playNote(trackId, voiceId, string, beat, note, start, length, volumeOf(note), nextBeat)
    }
    // notes recorded from MIDI that fit no string
    for (const note of beat.otherNotes ?? []) {
      samplePlayer.playPitch(trackId, voiceId, note.height, volumeOf(note), start, duration, beat, note)
    }
  },
}
