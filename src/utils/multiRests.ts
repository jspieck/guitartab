import type { Beat, MeasureMetaInfo, Track } from '../types/song'
import { clefChangesAt } from './clefs'
import { keyChanges } from './keySignature'
import { voicePlays } from './otherVoiceNotes'

/**
 * Multi-bar rests (a view option): a run of empty bars is drawn as its first bar with an
 * H-bar and the number of bars; the others take no room. Playback, the cursor and editing
 * still see every bar. A run needs two bars and breaks where something must stay visible: a
 * bar after the first one may not carry a time, key or clef change, a tempo, marker, repeat,
 * volta or navigation sign; the first one may not end a repeat.
 */

/** Whether a bar of a track is empty in every voice (no notes, slashes, texts or chords). */
export function barIsEmpty(voices: readonly (readonly Beat[] | undefined)[] | undefined): boolean {
  return (voices ?? []).every(
    (beats) => !voicePlays(beats) && !(beats ?? []).some((beat) => beat.text != null || beat.chord != null),
  )
}

function startsSomething(
  meta: MeasureMetaInfo,
  previous: MeasureMetaInfo | undefined,
  track: Pick<Track, 'numStrings' | 'clefs'>,
  blockId: number,
  isDrums: boolean,
): boolean {
  return (
    meta.timeMeterPresent ||
    meta.bpm != null ||
    meta.marker != null ||
    meta.repeatOpen ||
    meta.repeatClose != null ||
    meta.repeatAlternative != null ||
    (meta.directionTargets?.length ?? 0) > 0 ||
    (meta.directionJumps?.length ?? 0) > 0 ||
    keyChanges(meta, previous) ||
    clefChangesAt(track, blockId, isDrums)
  )
}

/** First bar of each run → number of bars in it. */
export function multiRestRuns(
  bars: readonly (readonly (readonly Beat[] | undefined)[] | undefined)[],
  metas: readonly MeasureMetaInfo[],
  track: Pick<Track, 'numStrings' | 'clefs'>,
  isDrums: boolean,
): Map<number, number> {
  const runs = new Map<number, number>()
  let blockId = 0
  while (blockId < bars.length) {
    const first = metas[blockId]
    if (first == null || !barIsEmpty(bars[blockId]) || first.repeatClose != null) {
      blockId += 1
      continue
    }
    let end = blockId + 1
    while (
      end < bars.length &&
      metas[end] != null &&
      barIsEmpty(bars[end]) &&
      !startsSomething(metas[end], metas[end - 1], track, end, isDrums)
    ) {
      end += 1
    }
    if (end - blockId >= 2) runs.set(blockId, end - blockId)
    blockId = end
  }
  return runs
}

/** Bars hidden inside runs (every bar of a run but its first). */
export function hiddenBars(runs: Map<number, number>): Set<number> {
  const hidden = new Set<number>()
  for (const [start, count] of runs) for (let bar = start + 1; bar < start + count; bar += 1) hidden.add(bar)
  return hidden
}
