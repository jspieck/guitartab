import type { TabBeat } from '../types/tab'
import { beatHasNotes, getBeamCount, getDurationBeats } from './durationUtils'

export interface BeamGroupBeat {
  beatIndex: number
  beamCount: number
}

const QUARTER_NOTE_BEATS = 1
const FLOAT_EPSILON = 0.0001

function isTupletBeat(beat: TabBeat | undefined): boolean {
  return Boolean(beat && beat.tuplet != null && beat.tupletId != null && beat.tupletId >= 0)
}

function finalizeGroup(groups: BeamGroupBeat[][], group: BeamGroupBeat[]): BeamGroupBeat[] {
  if (group.length >= 2) {
    groups.push(group)
  }

  return []
}

export function getBeamedBeatGroups(beats: TabBeat[]): BeamGroupBeat[][] {
  const groups: BeamGroupBeat[][] = []
  let currentGroup: BeamGroupBeat[] = []
  let currentTupletId: number | null = null
  let groupedBeatProgress = 0

  beats.forEach((beat, beatIndex) => {
    if (!beat) {
      currentGroup = finalizeGroup(groups, currentGroup)
      currentTupletId = null
      groupedBeatProgress = 0
      return
    }

    const beamCount = getBeamCount(beat.duration)
    const hasNotes = beatHasNotes(beat)

    if (beamCount === 0 || !hasNotes) {
      currentGroup = finalizeGroup(groups, currentGroup)
      currentTupletId = null
      groupedBeatProgress = 0
      return
    }

    const isTuplet = isTupletBeat(beat)
    const tupletId = isTuplet ? beat.tupletId ?? null : null
    const durationInBeats = getDurationBeats(beat.duration)

    if (!isTuplet && currentTupletId != null) {
      currentGroup = finalizeGroup(groups, currentGroup)
      currentTupletId = null
      groupedBeatProgress = 0
    }

    if (isTuplet) {
      if (currentTupletId != null && tupletId !== currentTupletId) {
        currentGroup = finalizeGroup(groups, currentGroup)
      }

      currentTupletId = tupletId
      currentGroup.push({ beatIndex, beamCount })
      return
    }

    if (groupedBeatProgress > 0 && groupedBeatProgress + durationInBeats > QUARTER_NOTE_BEATS + FLOAT_EPSILON) {
      currentGroup = finalizeGroup(groups, currentGroup)
      groupedBeatProgress = 0
    }

    currentGroup.push({ beatIndex, beamCount })
    groupedBeatProgress += durationInBeats

    if (groupedBeatProgress >= QUARTER_NOTE_BEATS - FLOAT_EPSILON) {
      currentGroup = finalizeGroup(groups, currentGroup)
      groupedBeatProgress = 0
    }
  })

  finalizeGroup(groups, currentGroup)
  return groups
}

export function getBeamedBeatIndices(beats: TabBeat[]): Set<number> {
  const indices = new Set<number>()

  getBeamedBeatGroups(beats).forEach((group) => {
    group.forEach(({ beatIndex }) => indices.add(beatIndex))
  })

  return indices
}