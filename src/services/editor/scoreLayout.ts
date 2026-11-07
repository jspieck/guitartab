import Song from '../../stores/song'
import Settings from '../../stores/settingsState'
import { scoreSystems, scoreViewState } from '../../stores/scoreViewState'
import type { RenderedTabRow } from '../../types/tab'
import {
  beginTrackLayout,
  breakIntoRows,
  isDrumLayout,
  type MeasureLayoutOptions,
} from './measureLayoutEngine'

/**
 * Score view (audit Big win 25): the shown tracks stacked per system. One row-breaking pass
 * over the widest bar of all shown tracks, so every track has the same rows and bar widths
 * and a bar starts at the same x in each of them; each track keeps its own lanes (effects,
 * chords, lyrics), so a system is as tall as its tracks need. The edited track (the song's
 * current track) is drawn in its edited voice, the others in voice 1.
 */

/** Space between the staves of one system, and between systems. */
export const SCORE_STAFF_GAP = 6
export const SCORE_SYSTEM_GAP = 30

/** The tracks the score view shows, in song order; null when it is off or shows one track. */
export function scoreTrackIds(): number[] | null {
  if (!Settings.scoreView) return null
  const chosen = scoreViewState.trackIds
  const ids: number[] = []
  for (let trackId = 0; trackId < Song.measures.length; trackId += 1) {
    if (chosen == null || chosen.includes(trackId) || trackId === Song.currentTrackId) ids.push(trackId)
  }
  return ids.length > 1 ? ids : null
}

/** The voice a track is laid out in: the edited voice for the edited track, else voice 1. */
export function scoreVoiceOf(trackId: number, editedTrack: number, editedVoice: number): number {
  return trackId === editedTrack ? editedVoice : 0
}

/** Lays out the shown tracks as a score; rows come in reading order (system by system, track by track). */
export function computeScoreLayout(
  trackIds: number[],
  editedTrack: number,
  editedVoice: number,
  options: MeasureLayoutOptions,
): RenderedTabRow[] {
  // a drum staff names its lines on every system; the other staves keep the same room, so bars line up
  const labelEveryRow = trackIds.some(isDrumLayout)
  const passes = trackIds.map((trackId) => ({
    trackId,
    pass: beginTrackLayout(
      trackId,
      scoreVoiceOf(trackId, editedTrack, editedVoice),
      Song.measures[trackId] ?? [],
      options,
      true,
      labelEveryRow,
    ),
  }))
  const numBars = Math.max(...passes.map(({ pass }) => pass.displayWidths.length))
  const shared = Array.from({ length: numBars }, (_, blockId) =>
    Math.max(...passes.map(({ pass }) => pass.displayWidths[blockId] ?? 0)),
  )

  scoreSystems.length = 0
  let top = options.headerHeight
  if (numBars > 0) {
    for (const span of breakIntoRows(shared, new Set(), options.availableWidth, labelEveryRow)) {
      const systemTop = top
      passes.forEach(({ pass }, index) => {
        const lower = index > 0
        top = pass.layoutRow(span, lower ? top + SCORE_STAFF_GAP : top, {
          widths: shared,
          lower,
          ...(lower ? { row: { lowerStaff: true } } : {}),
        })
      })
      scoreSystems.push({ top: systemTop, bottom: top })
      top += SCORE_SYSTEM_GAP
    }
  }

  // `tabLayout.allWidths` is the last laid-out track's: the edited one's, as edits compare against it
  const order = [...passes].sort(
    (a, b) => Number(a.trackId === editedTrack) - Number(b.trackId === editedTrack),
  )
  const rows = order.flatMap(({ pass }) => pass.finish().rows)
  return rows.sort((a, b) => (a.top ?? a.yOffset) - (b.top ?? b.yOffset))
}
