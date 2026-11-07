import Song from '../../stores/song'
import Settings from '../../stores/settingsState'
import { scoreViewState } from '../../stores/scoreViewState'
import { selectionState } from '../../stores/selectionState'
import { beatAtSameTime } from '../../utils/otherVoiceNotes'
import { typedEventBus } from '../../utils/typedEventBus'
import { classicalNotation } from '../notation/classicalNotationAdapter'
import { announce } from '../../stores/announcerState'
import { redrawTrack } from './layoutInvalidation'
import { scoreTrackIds } from './scoreLayout'
import { switchTrack } from './trackLoading'

/**
 * Score view commands: switching it on and off, choosing its tracks, and moving the cursor
 * from track to track (Alt+↑/↓; also without the score view, where it shows the next track).
 */

/** Switches the score view; it shows tab staves only, so classical notation goes off. */
export async function setScoreView(on: boolean): Promise<void> {
  if (on && Settings.vexFlowIsActive) await classicalNotation.toggleClassicalVisibility()
  Settings.scoreView = on
  redrawTrack(Song.currentTrackId, Song.currentVoiceId)
}

/** Classical notation and the score view exclude each other (see `setScoreView`). */
export async function toggleClassicalNotation(): Promise<void> {
  if (!Settings.vexFlowIsActive && Settings.scoreView) await setScoreView(false)
  await classicalNotation.toggleClassicalVisibility()
}

/** Whether the score view shows a track (the edited one always). */
export function isTrackInScore(trackId: number): boolean {
  const chosen = scoreViewState.trackIds
  return chosen == null || chosen.includes(trackId) || trackId === Song.currentTrackId
}

/** Shows or hides a track in the score; the edited track stays. Turns the score view on. */
export function toggleScoreTrack(trackId: number): void {
  if (trackId === Song.currentTrackId) return
  const all = Song.measures.map((_, id) => id)
  const chosen = new Set(scoreViewState.trackIds ?? all)
  if (isTrackInScore(trackId)) chosen.delete(trackId)
  else chosen.add(trackId)
  scoreViewState.trackIds = chosen.size === all.length ? null : [...chosen].sort((a, b) => a - b)
  if (!Settings.scoreView) void setScoreView(true)
  else redrawTrack(Song.currentTrackId, Song.currentVoiceId)
}

/**
 * Moves the cursor to the next (`step` 1) or previous (-1) track: the shown ones in the score
 * view, else every track. It stays in its bar, at the beat sounding at the same time, on the
 * same string counted from the top (voice 1 of the new track).
 */
export function moveCursorToTrack(step: 1 | -1): boolean {
  const tracks = scoreTrackIds() ?? Song.measures.map((_, id) => id)
  const { trackId, voiceId, blockId, beatId, string } = selectionState.cursor
  const target = tracks[tracks.indexOf(trackId) + step]
  if (target == null) return false

  const targetBlock = Math.min(blockId, Song.measures[target].length - 1)
  const targetBeat = beatAtSameTime(
    Song.measures[trackId]?.[blockId]?.[voiceId] ?? [],
    beatId,
    Song.measures[target][targetBlock][0] ?? [],
  )
  const fromTop = (Song.tracks[trackId]?.numStrings ?? 6) - 1 - string
  const numStrings = Song.tracks[target]?.numStrings ?? 6
  const targetString = Math.max(0, numStrings - 1 - Math.min(fromTop, numStrings - 1))

  switchTrack(target, 0)
  const position = {
    trackId: target,
    voiceId: 0,
    blockId: targetBlock,
    beatId: targetBeat,
    string: targetString,
  }
  Object.assign(selectionState.cursor, position)
  // the tab view's selection follows (and scrolls there)
  typedEventBus.emit('navigation.setClickedPos', position)
  announce(Song.tracks[target]?.name || `Track ${target + 1}`)
  return true
}
