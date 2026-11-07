import type { Beat, MeasureMetaInfo } from '../../stores/song'
import Duration from '../../utils/duration'

/** Beats before the trailing rests, which are padding in a pickup. */
function notesEnd(beats: Beat[]): number {
  let last = beats.length
  while (last > 0 && beats[last - 1].notes.every((note) => note == null)) last -= 1
  return last
}

/** The longest stretch of notes any voice of the first bar holds, in ticks. */
function pickupLength(measures: Beat[][][][]): number {
  let content = 0
  for (const bars of measures)
    for (const beats of bars[0] ?? []) {
      if (beats.length === 0 || beats[0]?.empty) continue
      const length = beats
        .slice(0, notesEnd(beats))
        .reduce((sum, beat) => sum + Duration.getDurationOfNote(beat, false), 0)
      content = Math.max(content, length)
    }
  return content
}

/**
 * A pickup (anacrusis) bar as the song can hold it: the first bar gets a time signature as
 * long as its notes, and the second bar the song's real one again. The model has no pickup
 * flag; a shorter first bar plays and exports the same (Guitar Pro 5 and TuxGuitar do this too).
 * Readers call it only for bars the file marks as a pickup (GPIF `Anacrusis`, MusicXML
 * `implicit="yes"`). `measures` is [track][bar][voice][beat].
 */
export function shortenPickupBar(meta: MeasureMetaInfo[], measures: Beat[][][][]): void {
  const first = meta[0]
  if (first == null) return
  const content = pickupLength(measures)
  if (content <= 0 || content >= Duration.getDurationOfBar(first)) return
  const denominator = [first.denominator, 8, 16, 32].find((value) => Number.isInteger((content * value) / 64))
  if (denominator == null) return
  // Every bar stores its signature; the second one only has to show it again.
  if (meta[1] != null) meta[1].timeMeterPresent = true
  first.numerator = (content * denominator) / 64
  first.denominator = denominator
  for (const bars of measures)
    for (const beats of bars[0] ?? []) {
      const last = notesEnd(beats)
      // Drop the padding rests, keep a voice that is all rest (the load fills it again).
      if (last > 0 && !beats[0]?.empty) beats.splice(last)
    }
}
