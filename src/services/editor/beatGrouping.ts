import Song, { type Beat } from '../../assets/js/songData'
import { tab } from '../../assets/js/tab'
import { getBeatRenderPosition } from '../../stores/tabRenderLayout'
import Duration from '../../utils/duration'
import { barLeftOffset } from '../../utils/measureBeatLayout'

const QUARTER = Duration.getDurationOfType('q')

/**
 * Groups a bar's beats for beaming (tuplets together; short notes up to a
 * quarter) and records each beat's position in width units in
 * `Song.measureMoveHelper`, which the layout engine reads.
 */
export function groupMeasureBeats(trackId: number, blockId: number, voiceId: number): Beat[][] {
  const beats = Song.measures[trackId][blockId][voiceId]
  const walk = new BeatWalk(
    beats,
    (((Song.measureMoveHelper[trackId] ??= [])[blockId] ??= [])[voiceId] ??= []),
  )
  const groupings: Beat[][] = []
  for (let i = 0; i < beats.length; i += 1) {
    const group: Beat[] = []
    groupings.push(group)
    if (beats[i].tuplet != null) i = walk.tuplet(i, group)
    else if (Duration.getDurationOfNote(beats[i], false) >= QUARTER || beats[i].duration.length > 1)
      walk.place(i, group)
    else i = walk.shortNotes(i, group)
  }
  return groupings
}

/** Walks a bar beat by beat, recording each beat's position in width units. */
class BeatWalk {
  private position = 0
  private ticksSoFar = 0

  constructor(
    private readonly beats: Beat[],
    private readonly positions: number[],
  ) {}

  place(index: number, group: Beat[]): void {
    if (!Number.isFinite(this.position)) {
      console.warn(`Invalid beat position ${this.position}, resetting to 0`)
      this.position = 0
    }
    this.positions[index] = this.position
    const width = Duration.getDurationWidth(this.beats[index])
    if (Number.isFinite(width)) this.position += width
    this.ticksSoFar += Duration.getDurationOfNote(this.beats[index], false)
    group.push(this.beats[index])
  }

  /** The whole tuplet is one group; returns the index of its last beat. */
  tuplet(start: number, group: Beat[]): number {
    const { tupletId } = this.beats[start]
    let last = start
    for (let j = start; j < this.beats.length; j += 1) {
      if (this.beats[j].tuplet == null || this.beats[j].tupletId !== tupletId) break
      this.place(j, group)
      last = j
    }
    return last
  }

  /** Short notes (no rests, no tuplets) are grouped until a quarter is full; returns the last index. */
  shortNotes(start: number, group: Beat[]): number {
    let filled = this.ticksSoFar % QUARTER
    let last = start
    for (let j = start; j < start + QUARTER && j < this.beats.length; j += 1) {
      const beat = this.beats[j]
      const ticks = Duration.getDurationOfNote(beat, false)
      if (ticks >= QUARTER || beat.duration.length > 1 || beat.tuplet != null) break
      filled += ticks
      this.place(j, group)
      last = j
      if (filled >= QUARTER) break
    }
    return last
  }
}

/**
 * Bar-local x of a beat. Uses the rendered layout when there is one, otherwise
 * the width-unit position from `groupMeasureBeats` times the bar's unit width.
 */
export function beatXInBar(trackId: number, blockId: number, voiceId: number, beatId: number): number {
  const rendered = getBeatRenderPosition(trackId, voiceId, blockId, beatId)
  if (rendered != null && Number.isFinite(rendered)) return rendered

  const position = Song.measureMoveHelper[trackId]?.[blockId]?.[voiceId]?.[beatId]
  if (position == null || !Number.isFinite(position)) {
    console.warn(`No beat position for track ${trackId}, bar ${blockId}, voice ${voiceId}, beat ${beatId}`)
    return 0
  }
  const left = barLeftOffset(blockId)
  const unitWidth = tab.measureOffset[trackId]?.[blockId]?.[voiceId]
  if (unitWidth == null || !Number.isFinite(unitWidth) || unitWidth === 0) return left
  return left + position * unitWidth
}
